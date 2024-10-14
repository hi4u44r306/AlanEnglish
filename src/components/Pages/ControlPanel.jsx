import React, { useEffect, useState } from "react";
import { rtdb } from "./firebase-config";
import { onValue, ref, update, remove } from "firebase/database";
import './css/ControlPanel.scss';
import { FcCollapse } from "react-icons/fc";
import { FcExpand } from "react-icons/fc";
import { FcFilledFilter } from "react-icons/fc";

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';




const ControlPanel = () => {
    const [students, setStudents] = useState([]);
    const [editStudentId, setEditStudentId] = useState(null);
    const [editableStudent, setEditableStudent] = useState(null);

    const [selectedStudents, setSelectedStudents] = useState([]);  // 選中的學生
    const [isAllSelected, setIsAllSelected] = useState(false);     // 全選狀態
    const [batchEditFields, setBatchEditFields] = useState({
        class: '',
        Monthtotaltimeplayed: ''
    });

    const [highlightedClass, setHighlightedClass] = useState(null); // 優先顯示的班級
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Fetch students from Firebase (Read)
    useEffect(() => {
        const studentsRef = ref(rtdb, 'student');
        onValue(studentsRef, (snapshot) => {
            const students = [];
            snapshot.forEach((childSnapshot) => {
                const studentData = childSnapshot.val();
                students.push({ id: childSnapshot.key, ...studentData });
            });
            setStudents(students);
        });
    }, []);

    // Handle selecting or deselecting a student
    const handleSelectStudent = (id) => {
        if (selectedStudents.includes(id)) {
            setSelectedStudents(selectedStudents.filter(studentId => studentId !== id));
        } else {
            setSelectedStudents([...selectedStudents, id]);
        }
    };

    // Handle selecting all students
    const handleSelectAll = () => {
        if (isAllSelected) {
            setSelectedStudents([]);  // 清空選擇
        } else {
            setSelectedStudents(students.map(student => student.id));  // 選擇所有學生
        }
        setIsAllSelected(!isAllSelected);
    };

    // Handle selecting all students from a specific class and highlight the class
    const handleSelectClass = (className) => {
        const studentsInClass = students.filter(student => student.class === className);
        const studentsInClassIds = studentsInClass.map(student => student.id);
        setSelectedStudents(studentsInClassIds);  // 選擇該班級所有學生
        setHighlightedClass(className);           // 優先顯示該班級
    };

    // Handle batch update with double check
    const handleBatchUpdate = () => {
        const isConfirmed = window.confirm("你確定要批量修改這些學生的資料嗎？");
        if (isConfirmed) {
            selectedStudents.forEach(studentId => {
                const updateStudentRef = ref(rtdb, `student/${studentId}`);
                update(updateStudentRef, {
                    class: batchEditFields.class || undefined,
                    Monthtotaltimeplayed: batchEditFields.Monthtotaltimeplayed || undefined,
                }).catch(error => console.log(error));
            });
            setSelectedStudents([]);  // 清空選擇
            setIsAllSelected(false);  // 重置全選狀態
            setBatchEditFields({ class: '', Monthtotaltimeplayed: '' });  // 重置表單
        }
    };

    // Handle batch delete with double check
    const handleBatchDelete = () => {
        const isConfirmed = window.confirm("你確定要批量刪除這些學生嗎？");
        if (isConfirmed) {
            selectedStudents.forEach(studentId => {
                const deleteStudentRef = ref(rtdb, `student/${studentId}`);
                remove(deleteStudentRef).catch(error => console.log(error));
            });
            setSelectedStudents([]);  // 清空選擇
            setIsAllSelected(false);  // 重置全選狀態
        }
    };

    // Edit Student
    const handleEditStudent = (student) => {
        setEditStudentId(student.id);
        setEditableStudent({ ...student });
    };

    // Save Updated Student Information (Update)
    const handleSaveStudent = () => {
        const isConfirmed = window.confirm("你確定要保存這個學生的更改嗎？");
        if (isConfirmed) {
            const updateStudentRef = ref(rtdb, `student/${editStudentId}`);
            update(updateStudentRef, editableStudent)
                .then(() => {
                    toast.success('學生資料編輯成功!', {
                        position: "top-center",
                        autoClose: 3000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                    });
                    setEditStudentId(null);
                    setEditableStudent(null);
                })
                .catch(error => {
                    toast.error('學生資料編輯失敗!', {
                        position: "top-center",
                        autoClose: 3000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                    });
                    console.log(error);
                });
        }
    };


    // Delete Student with confirmation
    const handleDeleteStudent = (id) => {
        const isConfirmed = window.confirm("你確定要刪除此學生嗎？");
        if (isConfirmed) {
            const deleteStudentRef = ref(rtdb, `student/${id}`);
            remove(deleteStudentRef)
                .then(() => console.log("Student deleted successfully"))
                .catch(error => console.log(error));
        } else {
            console.log("Delete action cancelled.");
        }
    };

    // Sort Students
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Apply sorting logic
    const sortedStudents = [...students].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Re-arrange students to prioritize the highlighted class
    const rearrangedStudents = highlightedClass
        ? sortedStudents.sort((a, b) => {
            if (a.class === highlightedClass && b.class !== highlightedClass) {
                return -1; // A班級學生排在前面
            }
            if (a.class !== highlightedClass && b.class === highlightedClass) {
                return 1; // 非A班級學生排在後面
            }
            return 0; // 保持其他排序
        })
        : sortedStudents;

    const handleClearSelection = () => {
        setSelectedStudents([]);
        setHighlightedClass(null);  // 清除班級排序的優先顯示
        setIsAllSelected(false);    // 清除全選狀態
    };

    const getSortIcon = (key) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'asc' ? <FcCollapse size={20} /> : <FcExpand size={20} />;
        }
        return <FcFilledFilter size={20} />;
    };

    return (
        <div className="control-panel">
            <h1>學生資料控制台</h1>

            {/* 批量編輯表單 */}
            <div className="batch-edit-form">
                <input
                    type="text"
                    placeholder="班級"
                    value={batchEditFields.class}
                    onChange={(e) => setBatchEditFields({ ...batchEditFields, class: e.target.value })}
                />
                <input
                    type="number"
                    placeholder="總播放次數"
                    value={batchEditFields.Monthtotaltimeplayed}
                    onChange={(e) => setBatchEditFields({ ...batchEditFields, Monthtotaltimeplayed: e.target.value })}
                />
                <button onClick={handleBatchUpdate} disabled={selectedStudents.length === 0}>
                    批量修改
                </button>
                <button onClick={handleBatchDelete} disabled={selectedStudents.length === 0}>
                    批量刪除
                </button>
                <button onClick={handleClearSelection}>全不選</button>
                <button onClick={() => handleSelectClass('A')}>全選 A班</button>
                <button onClick={() => handleSelectClass('B')}>全選 B班</button>
                <button onClick={() => handleSelectClass('C')}>全選 C班</button>
                <button onClick={() => handleSelectClass('D')}>全選 D班</button>
            </div>

            {/* 顯示學生列表 */}
            <table className="student-table">
                <thead>
                    <tr>
                        <th>
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={handleSelectAll}
                            /> 全選
                        </th>
                        <th onClick={() => handleSort('class')}>
                            班級 {getSortIcon('class')}
                        </th>
                        <th onClick={() => handleSort('name')}>
                            姓名 {getSortIcon('name')}
                        </th>
                        <th onClick={() => handleSort('onlinetime')}>
                            上線日 {getSortIcon('onlinetime')}
                        </th>
                        <th onClick={() => handleSort('Monthtotaltimeplayed')}>
                            總播放次數 {getSortIcon('Monthtotaltimeplayed')}
                        </th>
                        <th>
                            通過率
                        </th>
                        <th>編輯</th>
                    </tr>
                </thead>
                <tbody>
                    {rearrangedStudents.map((student) => (
                        <React.Fragment key={student.id}>
                            <tr>
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={selectedStudents.includes(student.id)}
                                        onChange={() => handleSelectStudent(student.id)}
                                    />
                                </td>
                                <td>{student.class}</td>
                                <td>{student.name}</td>
                                <td>{student.onlinetime}</td>
                                <td>{student.Monthtotaltimeplayed}</td>
                                <td>
                                    {student.BookLogfile
                                        ? Object.entries(student.BookLogfile)
                                            .filter(([, value]) => parseFloat(value.passRate) > 0)
                                            .map(([key, value], index) => (
                                                <div key={index}>
                                                    {key} : {value.passRate}%
                                                </div>
                                            ))
                                        : '全部未通過'}
                                </td>

                                <td>
                                    <button className="controlpaneleditbutton" onClick={() => handleEditStudent(student)}>編輯</button>
                                    <button className="controlpaneldeletebutton" onClick={() => handleDeleteStudent(student.id)}>刪除</button>
                                </td>
                            </tr>

                            {/* Show input fields only for the student being edited */}
                            {editStudentId === student.id && (
                                <tr className="edit-row">
                                    <td colSpan="6">
                                        <div className="edit-form">
                                            <input
                                                type="text"
                                                placeholder="Class"
                                                value={editableStudent.class}
                                                onChange={(e) => setEditableStudent({ ...editableStudent, class: e.target.value })}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Total Times Played"
                                                value={editableStudent.Monthtotaltimeplayed}
                                                onChange={(e) => setEditableStudent({ ...editableStudent, Monthtotaltimeplayed: e.target.value })}
                                            />
                                            <button className="controlpanelsavebutton" onClick={handleSaveStudent}>儲存</button>
                                            <button className="controlpanelcancelbutton" onClick={() => setEditStudentId(null)}>取消</button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
            <ToastContainer />
        </div>
    );
};

export default ControlPanel;
