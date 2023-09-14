import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import Containerfull from './Containerfull';
import firebase from 'firebase/app';
import '../assets/scss/Dashboard.scss';

const Dashboard = () => {
    const [studentsA, setStudentsA] = useState([]);
    const [studentsB, setStudentsB] = useState([]);
    const [studentsC, setStudentsC] = useState([]);
    const [studentsD, setStudentsD] = useState([]);
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [editingStudentRef, setEditingStudentRef] = useState(null);
    const [updatedStudentData, setUpdatedStudentData] = useState({});



    useEffect(() => {
        const db = firebase.firestore();
        const getStudents = (classParam, orderByParam, setStateFunc) => {
            db.collection("student")
                .where("class", "==", classParam)
                .orderBy(orderByParam, "desc")
                .get()
                .then((snapshot) => {
                    const students = [];
                    snapshot.forEach((doc) => {
                        const data = doc;
                        students.push(data);
                    });
                    setStateFunc(students);
                })
                .catch((err) => {
                    console.log(err);
                });
        };

        getStudents("A", 'totaltimeplayed', (students) => {
            setStudentsA(students);
        });
        getStudents("B", 'totaltimeplayed', (students) => {
            setStudentsB(students);
        });
        getStudents("C", 'totaltimeplayed', (students) => {
            setStudentsC(students);
        });
        getStudents("D", 'totaltimeplayed', (students) => {
            setStudentsD(students);
        });
    }, []);

    const editStudent = (id) => {
        const db = firebase.firestore();
        const studentRef = db.collection("student").doc(id);
        studentRef.get().then((doc) => {
            if (doc.exists) {
                const student = doc.data();
                setEditingStudent(student);
                setEditingStudentRef(studentRef);
                setUpdatedStudentData(student);
                setShowEditForm(true); // add this line to show the edit form
            } else {
                console.log("No such document!");
            }
        });
    };

    const deleteStudent = (id) => {
        const db = firebase.firestore();
        window.confirm('確認要刪除嗎?');
        if (window.confirm() === true) {
            // 刪除Firestore中的資料
            db.collection("student").doc(id).delete().then(() => {
                console.log("成功刪除");
            }).catch((error) => {
                console.error("刪除失敗 ", error);
            });
            // 刪除Auth資料

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
                            <input type="text" value={updatedStudentData.onlinetime} onChange={(e) => setUpdatedStudentData({ ...updatedStudentData, onlinetime: e.target.value })} />
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
                <Containerfull>
                    <div className='leaderboardtitle'>
                        Dashboard
                    </div>
                    <div className='notice'>
                        ⚠️ 若名字沒有在上面表示從來沒有上線過 ⚠️
                    </div>
                    <div className='classtitle'>A班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='coltitlerank'>日期</th>
                                <th className='coltitlerank'>班別</th>
                                <th className='coltitlerank'>姓名</th>
                                <th className='coltitlerank'>次數</th>
                                <th className='coltitlerank'>編輯</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentsA && studentsA.map((student, index) => (
                                <tr key={index}>
                                    {['onlinetime', 'class', 'name', 'totaltimeplayed'].map(key => (
                                        <td key={key}>
                                            <div className='studentmain'>
                                                <div className="studentsecond">
                                                    {key === 'totaltimeplayed' ? (
                                                        <span className='font-weight-bold'>{student.data()[key]}</span>
                                                    ) : (
                                                        <span className={student.data()[key] ? 'text-success' : 'text-danger'}>
                                                            {student.data()[key] || '近期無上線'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    ))}
                                    <td>
                                        <div className='studentmain'>
                                            <div className="studentsecond">
                                                <button className='editstudentbtn' onClick={() => editStudent(student.id)}>編輯</button>
                                            </div>

                                            <div className="studentsecond">
                                                <button className='editstudentbtn' onClick={() => deleteStudent(student.id)}>刪除</button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是A班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                    <div className='classtitle'>B班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='coltitlerank'>日期</th>
                                <th className='coltitlerank'>班別</th>
                                <th className='coltitlerank'>姓名</th>
                                <th className='coltitlerank'>次數</th>
                                <th className='coltitlerank'>編輯</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentsB && studentsB.map((student, index) => (
                                <tr key={index}>
                                    {['onlinetime', 'class', 'name', 'totaltimeplayed'].map(key => (
                                        <td key={key}>
                                            <div className='studentmain'>
                                                <div className="studentsecond">
                                                    {key === 'totaltimeplayed' ? (
                                                        <span className='font-weight-bold'>{student.data()[key]}</span>
                                                    ) : (
                                                        <span className={student.data()[key] ? 'text-success' : 'text-danger'}>
                                                            {student.data()[key] || '近期無上線'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    ))}
                                    <td>
                                        <div className='studentmain'>
                                            <div className="studentsecond">
                                                <button className='editstudentbtn' onClick={() => editStudent(student.id)}>編輯</button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是B班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                    <div className='classtitle'>C班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='coltitlerank'>日期</th>
                                <th className='coltitlerank'>班別</th>
                                <th className='coltitlerank'>姓名</th>
                                <th className='coltitlerank'>次數</th>
                                <th className='coltitlerank'>編輯</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentsC && studentsC.map((student, index) => (
                                <tr key={index}>
                                    {['onlinetime', 'class', 'name', 'totaltimeplayed'].map(key => (
                                        <td key={key}>
                                            <div className='studentmain'>
                                                <div className="studentsecond">
                                                    {key === 'totaltimeplayed' ? (
                                                        <span className='font-weight-bold'>{student.data()[key]}</span>
                                                    ) : (
                                                        <span className={student.data()[key] ? 'text-success' : 'text-danger'}>
                                                            {student.data()[key] || '近期無上線'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    ))}
                                    <td>
                                        <div className='studentmain'>
                                            <div className="studentsecond">
                                                <button className='editstudentbtn' onClick={() => editStudent(student.id)}>編輯</button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是C班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                    <div className='classtitle'>D班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='coltitlerank'>日期</th>
                                <th className='coltitlerank'>班別</th>
                                <th className='coltitlerank'>姓名</th>
                                <th className='coltitlerank'>次數</th>
                                <th className='coltitlerank'>編輯</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentsD && studentsD.map((student, index) => (
                                <tr key={index}>
                                    {['onlinetime', 'class', 'name', 'totaltimeplayed'].map(key => (
                                        <td key={key}>
                                            <div className='studentmain'>
                                                <div className="studentsecond">
                                                    {key === 'totaltimeplayed' ? (
                                                        <span className='font-weight-bold'>{student.data()[key]}</span>
                                                    ) : (
                                                        <span className={student.data()[key] ? 'text-success' : 'text-danger'}>
                                                            {student.data()[key] || '近期無上線'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    ))}
                                    <td>
                                        <div className='studentmain'>
                                            <div className="studentsecond">
                                                <button className='editstudentbtn' onClick={() => editStudent(student.id)}>編輯</button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是D班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>

                </Containerfull>
            )}
        </>
    )
}


export default Dashboard


// import React, { useState } from "react";

// const Dashboard = () => {
//     const [users, setUsers] = useState([
//         {
//             id: 1,
//             classType: "Class A",
//             name: "John Smith",
//             onlineTime: "2h 30m",
//             musicPlayedTime: "30m",
//         },
//         {
//             id: 2,
//             classType: "Class B",
//             name: "Jane Doe",
//             onlineTime: "1h 45m",
//             musicPlayedTime: "15m",
//         },
//         {
//             id: 3,
//             classType: "Class C",
//             name: "Bob Johnson",
//             onlineTime: "3h 10m",
//             musicPlayedTime: "45m",
//         },
//     ]);

//     const [editing, setEditing] = useState(false);
//     const [currentUser, setCurrentUser] = useState({
//         id: null,
//         classType: "",
//         name: "",
//         onlineTime: "",
//         musicPlayedTime: "",
//     });

//     const editRow = (user) => {
//         setEditing(true);
//         setCurrentUser({
//             id: user.id,
//             classType: user.classType,
//             name: user.name,
//             onlineTime: user.onlineTime,
//             musicPlayedTime: user.musicPlayedTime,
//         });
//     };

//     const updateUser = (id, updatedUser) => {
//         setEditing(false);
//         setUsers(users.map((user) => (user.id === id ? updatedUser : user)));
//     };

//     return (
//         <div>
//             <table>
//                 <thead>
//                     <tr>
//                         <th>Class Type</th>
//                         <th>Name</th>
//                         <th>Online Time</th>
//                         <th>Music Played Time</th>
//                         <th>Edit</th>
//                     </tr>
//                 </thead>
//                 <tbody>
//                     {users.map((user) => (
//                         <tr key={user.id}>
//                             <td>{user.classType}</td>
//                             <td>{user.name}</td>
//                             <td>{user.onlineTime}</td>
//                             <td>{user.musicPlayedTime}</td>
//                             <td>
//                                 <button onClick={() => editRow(user)}>Edit</button>
//                             </td>
//                         </tr>
//                     ))}
//                 </tbody>
//             </table>
//             {editing && (
//                 <div>
//                     <h2>Edit user</h2>
//                     <form
//                         onSubmit={(e) => {
//                             e.preventDefault();
//                             updateUser(currentUser.id, currentUser);
//                         }}
//                     >
//                         <label htmlFor="classType">Class Type</label>
//                         <input
//                             type="text"
//                             name="classType"
//                             value={currentUser.classType}
//                             onChange={(e) =>
//                                 setCurrentUser({
//                                     ...currentUser,
//                                     classType: e.target.value,
//                                 })
//                             }
//                         />
//                         <label htmlFor="name">Name</label>
//                         <input
//                             type="text"
//                             name="name"
//                             value={currentUser.name}
//                             onChange={(e) =>
//                                 setCurrentUser({ ...currentUser, name: e.target.value })
//                             }
//                         />
//                         <label htmlFor="onlineTime">Online Time</label>
//                         <input
//                             type="text"
//                             name="onlineTime"
//                             value={currentUser.onlineTime}
//                             onChange={(e) =>
//                                 setCurrentUser({
//                                     ...currentUser,
//                                     onlineTime: e.target.value,
//                                 })
//                             }
//                         />
//                         <label htmlFor="musicPlayedTime">Music Played Time</label>
//                         <input
//                             type="text"
//                             name="musicPlayedTime"
//                             value={currentUser.musicPlayedTime}
//                             onChange={(e) =>
//                                 setCurrentUser({
//                                     ...currentUser,
//                                     musicPlayedTime: e.target.value,
//                                 })
//                             }
//                         />
//                         <button>Update</button>
//                         <button onClick={() => setEditing(false)}>Cancel</button>
//                     </form>
//                 </div>
//             )}
//         </div>
//     );
// };
// export default Dashboard