import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import './css/Signup.scss';

import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, update } from "firebase/database";
// import { getDatabase, onValue, ref, update } from "firebase/database";
// import { rtdb } from "./firebase-config";

function Signup() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [classtype, setClassType] = useState("");
    // const [studentView, setStudentView] = useState([]);

    // useEffect(() => {
    //     const starCountRef = ref(rtdb, 'student');
    //     onValue(starCountRef, (snapshot) => {
    //         const data = snapshot.val();
    //         const studentNames = Object.values(data).map((child) => child);
    //         setStudentView(studentNames);
    //     });
    // }, [])


    const success = () => {
        toast.success('創建成功', {
            className: "notification",
            position: "top-center",
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
        });
    };

    const error = () => {
        toast.error('失敗', {
            className: "notification",
            position: "top-center",
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
        });
    };

    const signupUser = async (e) => {
        e.preventDefault();
        const auth = getAuth()
        try {
            const credentials = await createUserWithEmailAndPassword(auth, email, password);
            const useruid = credentials.user.uid;
            // const db = getFirestore();
            // await setDoc(doc(db, 'student', useruid), {
            //     Resetallmusic: '',
            //     class: classtype,
            //     currdatetimeplayed: 0,
            //     email: email,
            //     name: name,
            //     onlinemonth: '',
            //     onlinetime: '',
            //     totaltimeplayed: 0,
            //     userimage: '',
            // });
            const rtdb = getDatabase();
            const currentDate = new Date().toJSON().slice(0, 10);
            const currentMonth = new Date().toJSON().slice(0, 7);
            const databaseRef = ref(rtdb, 'student/' + useruid);
            await update(databaseRef, {
                Resetallmusic: currentMonth + 'alreadyupdated',
                onlinemonth: currentMonth,
                onlinetime: currentDate,
                name: name,
                class: classtype,
                email: email,
                Daytotaltimeplayed: 0,
                Monthtotaltimeplayed: 0,
                userimage: '6C9570CC-B276-424C-857F-11BBDD21C99B.png',
                totaltimeplayed: 0,
            });
            success();
        } catch {
            error();
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === "email") setEmail(value);
        if (name === "password") setPassword(value);
        if (name === "name") setName(value);
        if (name === "classtype") setClassType(value);
    }

    return (
        <div className="Signup">
            <div className="background-image"></div>
            <div className="signupsection">
                <span>新增學生資料</span>
                <div className="signupinput">
                    <label>帳號</label>
                    <input
                        name="email"
                        type="email"
                        id="email"
                        placeholder="輸入電子郵件或帳號..."
                        onChange={handleChange}
                        value={email}
                    />
                </div>

                <div className="signupinput">
                    <label>密碼</label>
                    <input
                        name="password"
                        type="password"
                        id="password"
                        placeholder="輸入密碼..."
                        onChange={handleChange}
                        value={123456}
                    />
                </div>

                <div className="signupinput">
                    <label>English Name</label>
                    <input
                        name="name"
                        type="name"
                        id="name"
                        placeholder="輸入姓名..."
                        onChange={handleChange}
                        value={name}
                    />
                </div>

                <div className="signupinput">
                    <label>ClassType</label>
                    <input
                        name="classtype"
                        type="classtype"
                        id="classtype"
                        placeholder="輸入Class..."
                        onChange={handleChange}
                        value={classtype}
                    />
                </div>

                <button onClick={signupUser} className="signupbtn">
                    創建學生資料
                </button>
                <ToastContainer
                    position="top-center"
                    autoClose={2000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                />
                {/* <div className="nav-item">
                    <span className="copyright" href="/">Copyright © 2022 Alan English Inc.</span>
                </div> */}
            </div>
            {/* <div className="student-table-container">
                <h5>學生名單</h5>
                <table className="student-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        {studentView.map((student) => (
                            <tr key={student.name}>
                                <td>{student.name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div> */}
        </div>
    );
}

export default Signup;
