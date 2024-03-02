// import React from "react";
// import './css/Signup.scss';
// import firebase from "./firebase";
// import { toast, ToastContainer } from "react-toastify"
// import 'react-toastify/dist/ReactToastify.css';
// import { Button } from "react-bootstrap";
// import { Link } from "react-router-dom";

// class Signup extends React.Component {

//     constructor(props) {
//         super(props)
//         this.signupuser = this.signupuser.bind(this);
//         this.handleChange = this.handleChange.bind(this);
//         this.state = {
//             email: "",
//             password: "",
//             name: "",
//             classtype: "",
//         }
//     }

//     success = () => {
//         toast.success('創建成功', {
//             className: "notification",
//             position: "top-center",
//             autoClose: 1000,
//             hideProgressBar: false,
//             closeOnClick: true,
//             pauseOnHover: false,
//             draggable: true,
//             progress: undefined,
//         });
//     };

//     error = () => {
//         toast.error('失敗', {
//             className: "notification",
//             position: "top-center",
//             autoClose: 1000,
//             hideProgressBar: false,
//             closeOnClick: true,
//             pauseOnHover: false,
//             draggable: true,
//             progress: undefined,
//         });
//     };
//     test = () => {
//         for (let i = 0; i < 10; i++) {
//             let j = "'" + i + "'"
//             console.log(j);
//         }
//     }

//     signupuser(e) {
//         e.preventDefault();
//         firebase.auth().createUserWithEmailAndPassword(this.state.email, this.state.password).then((Credentials) => {
//             const useruid = Credentials.user.uid;
//             const db = firebase.firestore();
//             db.collection('student').doc(useruid).set({ // 設定名稱,Email,classtype
//                 name: this.state.name,
//                 class: this.state.classtype,
//                 email: this.state.email,
//                 totaltimeplayed: 0,
//             })
//             firebase.database().ref('student/' + useruid).update({
//                 totaltimeplayed: 0,
//             });
//             this.success();
//         }).catch(() => {
//             this.error();
//         });
//     }


//     handleChange(e) {
//         this.setState({
//             [e.target.name]: e.target.value
//         })
//     }

//     render() {
//         return (
//             <div className="Signup">
//                 <div>
//                     <Button as={Link} to="/home/leaderboard" href="/home/leaderboard">回首頁</Button>
//                 </div>
//                 <div className="signupsection">
//                     <span>Add User</span>
//                     <div className="signupinput">
//                         <label>帳號</label>
//                         <input
//                             name="email"
//                             type="email"
//                             id="email"
//                             placeholder="輸入電子郵件或帳號..."
//                             onChange={this.handleChange}
//                             value={this.state.email}
//                         />
//                     </div>

//                     <div className="signupinput">
//                         <label>密碼</label>
//                         <input
//                             name="password"
//                             type="password"
//                             id="password"
//                             placeholder="輸入密碼..."
//                             onChange={this.handleChange}
//                             value={this.state.password}
//                         />
//                     </div>

//                     <div className="signupinput">
//                         <label>English Name</label>
//                         <input
//                             name="name"
//                             type="name"
//                             id="name"
//                             placeholder="輸入姓名..."
//                             onChange={this.handleChange}
//                             value={this.state.name}
//                         />
//                     </div>

//                     <div className="signupinput">
//                         <label>ClassType</label>
//                         <input
//                             name="classtype"
//                             type="classtype"
//                             id="classtype"
//                             placeholder="輸入Class..."
//                             onChange={this.handleChange}
//                             value={this.state.classtype}
//                         />
//                     </div>

//                     <button onClick={this.signupuser} className="signupbtn">
//                         創建
//                         <ToastContainer
//                             position="top-center"
//                             autoClose={2000}
//                             hideProgressBar={false}
//                             newestOnTop={false}
//                             closeOnClick
//                             rtl={false}
//                             pauseOnFocusLoss
//                             draggable
//                             pauseOnHover
//                         />
//                     </button>
//                     <div className="nav-item">
//                         <span className="copyright" href="/">Copyright © 2022 Alan English Inc.</span>
//                     </div>
//                 </div>
//             </div>
//         );
//     }
// }

// export default Signup;

import React, { useState } from "react";
import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import './css/Signup.scss';

import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { getDatabase, ref, update } from "firebase/database";

function Signup() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [classtype, setClassType] = useState("");

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
            const db = getFirestore();
            await setDoc(doc(db, 'student', useruid), {
                name: name,
                class: classtype,
                email: email,
                totaltimeplayed: 0,
            });
            const rtdb = getDatabase();
            const databaseRef = ref(rtdb, 'student/' + useruid);
            await update(databaseRef, {
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
            <div>
                <Button as={Link} to="/home/playlist/leaderboard" href="/home/playlist/leaderboard">回首頁</Button>
            </div>
            <div className="signupsection">
                <span>Add User</span>
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
                        value={password}
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
                    創建
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
                <div className="nav-item">
                    <span className="copyright" href="/">Copyright © 2022 Alan English Inc.</span>
                </div>
            </div>
        </div>
    );
}

export default Signup;
