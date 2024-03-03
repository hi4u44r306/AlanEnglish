import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import '../assets/scss/Dashboard.scss';
import { deleteDoc, doc, getDoc, getFirestore } from 'firebase/firestore';
import { getDatabase, ref, remove } from 'firebase/database';

import Trophy from '../assets/img/trophy.png';
import Sun from '../assets/img/sun.png';
import Sparkles from '../assets/img/sparkles.png';
import Headphone from '../assets/img/leaderboardheadphone.png';

const Dashboard = () => {
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [editingStudentRef, setEditingStudentRef] = useState(null);
    const [updatedStudentData, setUpdatedStudentData] = useState({});

    const editStudent = async (id) => {
        console.log(id)

        const db = getFirestore();
        const studentRef = doc(db, "student", id);
        try {
            const docSnapshot = await getDoc(studentRef);
            if (docSnapshot.exists()) {
                const student = docSnapshot.data();
                setEditingStudent(student);
                setEditingStudentRef(studentRef);
                setUpdatedStudentData(student);
                setShowEditForm(true);
            } else {
                console.log("No such document!");
            }
        } catch (error) {
            console.log("Error getting document:", error);
        }
    };

    const deleteStudent = (id) => {
        if (window.confirm('確認要刪除嗎?')) {
            const db = getFirestore();
            const studentDocRef = doc(db, "student", id);
            deleteDoc(studentDocRef).then(() => {
                console.log("成功刪除");
            }).catch((error) => {
                console.error("刪除失敗 ", error);
            });

            const realtimeDb = getDatabase();
            const studentRealtimeRef = ref(realtimeDb, `student/${id}`);
            remove(studentRealtimeRef);

            // Delete Auth data if applicable
        } else {
            window.alert("取消刪除")
        }
    }

    const success = () => {
        toast.success('修改成功', {
            position: "top-center",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            theme: "light",
        });
        setTimeout(() => {
            setEditingStudent(null);
            window.location.reload();
        }, 1000);
    }

    const [classFilters, setClassFilters] = useState({
        A: false,
        B: false,
        C: false,
        D: false,
        // Teacher: true,
    });
    const [AllStudent, setAllStudentData] = useState([]);

    useEffect(() => {
        const AllStudent = localStorage.getItem('AllStudent');
        if (AllStudent) {
            setAllStudentData(JSON.parse(AllStudent));
        }
    }, []);

    const handleCheckboxChange = (event) => {
        const { name, checked } = event.target;
        if (name === "selectAll") {
            const updatedFilters = {};
            for (const className in classFilters) {
                updatedFilters[className] = checked;
            }
            setClassFilters(updatedFilters);
        } else {
            setClassFilters(prevFilters => ({
                ...prevFilters,
                [name]: checked
            }));
        }
    };

    return (
        <>
            {editingStudent ? (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        editingStudentRef.update(updatedStudentData).then(() => {
                            success();
                        })
                    }}
                    className={`Editcontainer ${showEditForm ? 'show' : ''}`}
                >
                    <div className='Editform'>
                        <ToastContainer />
                        <div className='Edittitle'>
                            資料更新
                        </div>
                        <div className='Editinputcontainer'>
                            <label>
                                Email Address
                            </label>
                            <input type="text" value={updatedStudentData.email} onChange={(e) => setUpdatedStudentData({ ...updatedStudentData, email: e.target.value })} />
                        </div>

                        <div className='Editinputcontainer'>
                            <label>
                                上線時間 / Onlinetime
                            </label>
                            <input type="text" value={updatedStudentData.onlinetime} onChange={(e) => setUpdatedStudentData({ ...updatedStudentData, onlinetime: e.target.value || 0 })} />
                        </div>

                        <div className='Editinputcontainer'>
                            <label>
                                班級 / Class
                            </label>
                            <input type="text" value={updatedStudentData.class} onChange={(e) => setUpdatedStudentData({ ...updatedStudentData, class: e.target.value })} />
                        </div>

                        <div className='Editinputcontainer'>
                            <label>
                                姓名 / Name
                            </label>
                            <input type="text" value={updatedStudentData.name} onChange={(e) => setUpdatedStudentData({ ...updatedStudentData, name: e.target.value })} />
                        </div>

                        <div className='Editinputcontainer'>
                            <label>
                                播放次數 / Totaltimeplayed
                            </label>
                            <input type="text" value={updatedStudentData.totaltimeplayed} onChange={(e) => setUpdatedStudentData({ ...updatedStudentData, totaltimeplayed: e.target.value })} />
                        </div>
                        <div className='Editbtn'>
                            <button className="updatebtn" type="submit">Save</button>
                        </div>
                        <div className='Editbtn'>
                            <button className="cancelbtn" onClick={() => setEditingStudent(null)}>Cancel</button>
                        </div>
                    </div>
                </form>
            ) : (

                <div className='leaderboard'>
                    <div className='leaderboardmaintitle'>
                        <div className='leaderboardtitle'>
                            控制台
                        </div>
                    </div>
                    <div className="class-filters">
                        <label className="class-filter">
                            <input
                                type="checkbox"
                                name="selectAll"
                                checked={Object.values(classFilters).every(val => val)}
                                onChange={handleCheckboxChange}
                            />
                            All
                        </label>
                        {Object.keys(classFilters).map(className => (
                            <label key={className} className="class-filter">
                                <input
                                    type="checkbox"
                                    name={className}
                                    checked={classFilters[className]}
                                    onChange={handleCheckboxChange}
                                />
                                {className}班
                            </label>
                        ))}
                    </div>

                    {/* Online Data */}
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                {[
                                    { text: '排名', icon: Trophy },
                                    { text: '姓名', icon: Sun },
                                    { text: '日期', icon: Sparkles },
                                    { text: '月次數', icon: Headphone },
                                    { text: '編輯', icon: Headphone },
                                ].map((col, index) => (
                                    <th className='coltitle' key={index}>
                                        <span className='d-flex align-items-center justify-content-center'>
                                            <img style={{ marginRight: 7, marginBottom: 5 }} src={col.icon} alt={col.text} />
                                            {col.text}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {
                                AllStudent.map((student, index) => {
                                    if (classFilters[student.class]) {
                                        return (
                                            <tr key={index}>
                                                <td>
                                                    <div className='d-flex justify-content-center'>
                                                        <div className="align-self-center pl-3">
                                                            <b>
                                                                <span className='font-weight-bold'>{student.class}</span>
                                                            </b>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className='d-flex justify-content-center'>
                                                        <div className="align-self-center pl-3">
                                                            <b>
                                                                <span className='font-weight-bold'>{student.name}</span>
                                                            </b>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className='d-flex justify-content-center'>
                                                        <div className="align-self-center pl-3">
                                                            <b>
                                                                <span className={`font-weight-bold ${student.onlinetime ? 'text-success' : 'text-danger'}`}>
                                                                    {student.onlinetime || '近期無上線'}
                                                                </span>
                                                            </b>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className='d-flex justify-content-center'>
                                                        <div className="align-self-center pl-3">
                                                            <b>
                                                                <span className='font-weight-bold'>{student.totaltimeplayed}次</span>
                                                            </b>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className='studentmain'>
                                                        <div className="studentsecond">
                                                            <button className='editstudentbtn' onClick={() => editStudent(student.uid)}>編輯</button>
                                                        </div>
                                                        <div className="studentsecond">
                                                            <button className='deletestudentbtn' onClick={() => deleteStudent(student.uid)}>刪除</button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }
                                    return null;
                                })
                            }
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!! 這是最底部了 !!</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )
            }
        </>
    )
}


export default Dashboard

// <Containerfull  >
//                 <div className='leaderboardtitle'>
//                     Dashboard
//                 </div>
//                 <div className='notice'>
//                     ⚠️ 若名字沒有在上面表示從來沒有上線過 ⚠️
//                 </div>
//                 <div className='classtitle'>A班</div>
//                 <table className='table table-border'>
//                     <thead>
//                         <tr>
//                             <th className='coltitlerank'>日期</th>
//                             <th className='coltitlerank'>班別</th>
//                             <th className='coltitlerank'>姓名</th>
//                             <th className='coltitlerank'>次數</th>
//                             <th className='coltitlerank'>編輯</th>
//                         </tr>
//                     </thead>
//                     <tbody>
//                         {studentsA && studentsA.map((student, index) => (
//                             <tr key={index}>
//                                 {['onlinetime', 'class', 'name', 'totaltimeplayed'].map(key => (
//                                     <td key={key}>
//                                         <div className='studentmain'>
//                                             <div className="studentsecond">
//                                                 {key === 'totaltimeplayed' ? (
//                                                     <span className='font-weight-bold'>{student.data()[key]}</span>
//                                                 ) : (
//                                                     <span className={student.data()[key] ? 'text-success' : 'text-danger'}>
//                                                         {student.data()[key] || '近期無上線'}
//                                                     </span>
//                                                 )}
//                                             </div>
//                                         </div>
//                                     </td>
//                                 ))}
//                                 <td>
//                                     <div className='studentmain'>
//                                         <div className="studentsecond">
//                                             <button className='editstudentbtn' onClick={() => editStudent(student.id)}>編輯</button>
//                                         </div>

//                                         <div className="studentsecond">
//                                             <button className='deletestudentbtn' onClick={() => deleteStudent(student.id)}>刪除</button>
//                                         </div>
//                                     </div>
//                                 </td>
//                             </tr>
//                         ))}

//                     </tbody>
//                     <tfoot>
//                         <tr>
//                             <td className='coltitle' colSpan="5">!!這是A班最後一筆資料了!!</td>
//                         </tr>
//                     </tfoot>
//                 </table>

//                 <div className='classtitle'>B班</div>
//                 <table className='table table-border'>
//                     <thead>
//                         <tr>
//                             <th className='coltitlerank'>日期</th>
//                             <th className='coltitlerank'>班別</th>
//                             <th className='coltitlerank'>姓名</th>
//                             <th className='coltitlerank'>次數</th>
//                             <th className='coltitlerank'>編輯</th>
//                         </tr>
//                     </thead>
//                     <tbody>
//                         {studentsB && studentsB.map((student, index) => (
//                             <tr key={index}>
//                                 {['onlinetime', 'class', 'name', 'totaltimeplayed'].map(key => (
//                                     <td key={key}>
//                                         <div className='studentmain'>
//                                             <div className="studentsecond">
//                                                 {key === 'totaltimeplayed' ? (
//                                                     <span className='font-weight-bold'>{student.data()[key]}</span>
//                                                 ) : (
//                                                     <span className={student.data()[key] ? 'text-success' : 'text-danger'}>
//                                                         {student.data()[key] || '近期無上線'}
//                                                     </span>
//                                                 )}
//                                             </div>
//                                         </div>
//                                     </td>
//                                 ))}
//                                 <td>
//                                     <div className='studentmain'>
//                                         <div className="studentsecond">
//                                             <button className='editstudentbtn' onClick={() => editStudent(student.id)}>編輯</button>
//                                         </div>
//                                         <div className="studentsecond">
//                                             <button className='deletestudentbtn' onClick={() => deleteStudent(student.id)}>刪除</button>
//                                         </div>
//                                     </div>
//                                 </td>
//                             </tr>
//                         ))}

//                     </tbody>
//                     <tfoot>
//                         <tr>
//                             <td className='coltitle' colSpan="5">!!這是B班最後一筆資料了!!</td>
//                         </tr>
//                     </tfoot>
//                 </table>
//                 <div className='classtitle'>C班</div>
//                 <table className='table table-border'>
//                     <thead>
//                         <tr>
//                             <th className='coltitlerank'>日期</th>
//                             <th className='coltitlerank'>班別</th>
//                             <th className='coltitlerank'>姓名</th>
//                             <th className='coltitlerank'>次數</th>
//                             <th className='coltitlerank'>編輯</th>
//                         </tr>
//                     </thead>
//                     <tbody>
//                         {studentsC && studentsC.map((student, index) => (
//                             <tr key={index}>
//                                 {['onlinetime', 'class', 'name', 'totaltimeplayed'].map(key => (
//                                     <td key={key}>
//                                         <div className='studentmain'>
//                                             <div className="studentsecond">
//                                                 {key === 'totaltimeplayed' ? (
//                                                     <span className='font-weight-bold'>{student.data()[key]}</span>
//                                                 ) : (
//                                                     <span className={student.data()[key] ? 'text-success' : 'text-danger'}>
//                                                         {student.data()[key] || '近期無上線'}
//                                                     </span>
//                                                 )}
//                                             </div>
//                                         </div>
//                                     </td>
//                                 ))}
//                                 <td>
//                                     <div className='studentmain'>
//                                         <div className="studentsecond">
//                                             <button className='editstudentbtn' onClick={() => editStudent(student.id)}>編輯</button>
//                                         </div>
//                                         <div className="studentsecond">
//                                             <button className='deletestudentbtn' onClick={() => deleteStudent(student.id)}>刪除</button>
//                                         </div>
//                                     </div>
//                                 </td>
//                             </tr>
//                         ))}

//                     </tbody>
//                     <tfoot>
//                         <tr>
//                             <td className='coltitle' colSpan="5">!!這是C班最後一筆資料了!!</td>
//                         </tr>
//                     </tfoot>
//                 </table>
//                 <div className='classtitle'>D班</div>
//                 <table className='table table-border'>
//                     <thead>
//                         <tr>
//                             <th className='coltitlerank'>日期</th>
//                             <th className='coltitlerank'>班別</th>
//                             <th className='coltitlerank'>姓名</th>
//                             <th className='coltitlerank'>次數</th>
//                             <th className='coltitlerank'>編輯</th>
//                         </tr>
//                     </thead>
//                     <tbody>
//                         {studentsD && studentsD.map((student, index) => (
//                             <tr key={index}>
//                                 {['onlinetime', 'class', 'name', 'totaltimeplayed'].map(key => (
//                                     <td key={key}>
//                                         <div className='studentmain'>
//                                             <div className="studentsecond">
//                                                 {key === 'totaltimeplayed' ? (
//                                                     <span className='font-weight-bold'>{student.data()[key]}</span>
//                                                 ) : (
//                                                     <span className={student.data()[key] ? 'text-success' : 'text-danger'}>
//                                                         {student.data()[key] || '近期無上線'}
//                                                     </span>
//                                                 )}
//                                             </div>
//                                         </div>
//                                     </td>
//                                 ))}
//                                 <td>
//                                     <div className='studentmain'>
//                                         <div className="studentsecond">
//                                             <button className='editstudentbtn' onClick={() => editStudent(student.id)}>編輯</button>
//                                         </div>
//                                         <div className="studentsecond">
//                                             <button className='deletestudentbtn' onClick={() => deleteStudent(student.id)}>刪除</button>
//                                         </div>
//                                     </div>
//                                 </td>
//                             </tr>
//                         ))}

//                     </tbody>
//                     <tfoot>
//                         <tr>
//                             <td className='coltitle' colSpan="5">!!這是D班最後一筆資料了!!</td>
//                         </tr>
//                     </tfoot>
//                 </table>

//             </Containerfull > 