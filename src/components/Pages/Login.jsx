// import React from "react";
// // import HeadPhone from '../assets/img/headphones.svg';
// // import HeadPhone from '../assets/img/User-Image1.png';
// import HeadPhone from '../assets/img/Login2.png';
// import './css/Login.scss';
// import firebase from "./firebase";
// import { ToastContainer, toast } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';

// class Login extends React.Component {

//     constructor(props) {
//         super(props)
//         this.login = this.login.bind(this);
//         this.handleChange = this.handleChange.bind(this);
//         this.handleKeyDown = this.handleKeyDown.bind(this);
//         this.state = {
//             email: "",
//             password: "",
//             isLoading: false,
//         }
//     }

//     // success = (userCredential) =>  {
//     //     toast.success('😻Welcome😻',{
//     //         className:"notification",
//     //         position: "top-center",
//     //         autoClose: 500,
//     //         hideProgressBar: false,
//     //         closeOnClick: true,
//     //         pauseOnHover: false,
//     //         draggable: true,
//     //         progress: undefined,
//     //         theme: "colored",
//     //         });
//     //         setTimeout(function(){window.location = "/home/leaderboard";} ,500); 

//     //     };

//     error = () => {
//         toast.error('帳號密碼錯誤 🤯', {
//             className: "notification",
//             position: "top-center",
//             autoClose: 3000,
//             hideProgressBar: false,
//             closeOnClick: true,
//             pauseOnHover: false,
//             draggable: true,
//             progress: undefined,
//             theme: "colored",
//         });
//     };
//     expire = () => {
//         toast.error('此帳號已註銷', {
//             className: "notification",
//             position: "top-center",
//             autoClose: 3000,
//             hideProgressBar: false,
//             closeOnClick: true,
//             pauseOnHover: false,
//             draggable: true,
//             progress: undefined,
//             theme: "colored",
//         });
//     };

//     async login(e) {
//         e.preventDefault();

//         if (!this.state.email || !this.state.password) {
//             toast.error('Please enter email and password', {
//                 className: "notification",
//                 position: "top-center",
//                 autoClose: 3000,
//                 hideProgressBar: false,
//                 closeOnClick: true,
//                 pauseOnHover: false,
//                 draggable: true,
//                 progress: undefined,
//                 theme: "colored",
//             });
//             return;
//         }

//         this.setState({ isLoading: true });

//         setTimeout(() => {
//             this.setState({ isLoading: false });
//         }, 2000);

//         const { email, password } = this.state;
//         const db = firebase.firestore();
//         const currentDate = new Date().toJSON().slice(0, 10);
//         const currentMonth = new Date().toJSON().slice(0, 7);

//         try {
//             const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
//             const userDoc = await db.collection('student').doc(userCredential.user.uid).get();
//             const userName = userDoc.data().name.toUpperCase();
//             const userRef = db.collection('student').doc(userCredential.user.uid);

//             userRef.get().then((doc) => {
//                 const onlinetime = doc.data().onlinetime;
//                 if (onlinetime !== currentDate) {
//                     userRef.update({
//                         onlinemonth: currentMonth,
//                         onlinetime: currentDate,
//                         currdatetimeplayed: 0,
//                     });
//                 }
//             });

//             userRef.get().then((doc) => {
//                 if (doc.data().Resetallmusic === 'notupdated' || doc.data().Resetallmusic !== currentMonth + 'alreadyupdated') {
//                     userRef.set({
//                         totaltimeplayed: 0,
//                         Resetallmusic: currentMonth + 'alreadyupdated',
//                     }, { merge: true })
//                     firebase.database().ref().child("student").child(userCredential.user.uid).child("totaltimeplayed").update({
//                         totaltimeplayed: 0,
//                     });
//                 } else {
//                 }
//             }).catch((error) => {
//                 console.log(error);
//             })

//             toast.promise(
//                 new Promise(resolve => setTimeout(resolve, 500)),
//                 {
//                     success: { render: () => <div className="notification">歡迎回來 {userName}!!</div> }
//                 },
//                 setTimeout(() => window.location = "/home/leaderboard", 2500)
//             );

//         } catch (error) {
//             toast.promise(
//                 new Promise((resolve, reject) => setTimeout(reject, 2500)),
//                 { pending: 'Loading...', error: { render: () => <div className="notification">帳號密碼錯誤 🤯</div> } }
//             );
//         }
//     }


//     handleChange(e) {
//         this.setState({
//             [e.target.name]: e.target.value
//         })
//     }

//     handleKeyDown(event) {
//         if (event.key === 'Enter' && this.state.email && this.state.password) {
//             this.login(event);
//         }
//     }

//     render() {
//         const { isLoading } = this.state;
//         return (
//             <>

//                 <section className="Login">
//                     <div className="Logincontainer">
//                         <div className="Left">
//                             <div className="english-method">
//                                 <p>步驟一：能聽清楚句子中每個單字,並瞭解中文句意。</p>
//                                 <p>步驟二：聽問句與提示後,能馬上完整地回答！回答速度可以比MP3更快！</p>
//                                 <p>步驟三：只唸幾次所強記的單字忘得快!!!!所以，依學生個別的專注能力，前兩個步驟需要 20～80 次反覆地聽讀跟唸,
//                                     才能有效地背誦並牢記單字！
//                                 </p>
//                             </div>
//                             <img className="head-phone-img" src={HeadPhone} alt="" />
//                         </div>

//                         <div className="Right">
//                             <div className="loginbrand">
//                                 <div className="loginbrandword">
//                                     <span>A</span>
//                                     <span>L</span>
//                                     <span>A</span>
//                                     <span>N</span>
//                                     <span> </span>
//                                     <span>E</span>
//                                     <span>N</span>
//                                     <span>G</span>
//                                     <span>L</span>
//                                     <span>I</span>
//                                     <span>S</span>
//                                     <span>H</span>
//                                 </div>
//                                 <div className="loginbrandbottom">
//                                     <div className="loginbrandbottomtext">系統化 | 口語化 | 聽力導向 </div>
//                                 </div>
//                             </div>
//                             <div className="loginsection">
//                                 <label>帳號</label>
//                                 <input
//                                     className="rightinput"
//                                     name="email"
//                                     type="email"
//                                     id="email"
//                                     placeholder="輸入電子郵件或帳號..."
//                                     onChange={this.handleChange}
//                                     onKeyDown={this.handleKeyDown}
//                                     value={this.state.email}
//                                 />

//                                 <label>密碼</label>
//                                 <input
//                                     className="rightinput"
//                                     name="password"
//                                     type="password"
//                                     id="password"
//                                     placeholder="輸入密碼..."
//                                     onChange={this.handleChange}
//                                     onKeyDown={this.handleKeyDown}
//                                     value={this.state.password}
//                                 />

//                                 <button
//                                     onClick={this.login}
//                                     className="loginbtn"
//                                     type="submit"
//                                     disabled={isLoading}
//                                 >
//                                     {isLoading ? "登入中..." : "登入"}

//                                 </button>
//                                 <a style={{ fontSize: 18, fontWeight: 700 }} href="/solve" alt="/solve" >無法登入嗎 ? 點這裡</a>
//                                 <ToastContainer
//                                     position="top-center"
//                                     autoClose={2000}
//                                     limit={1}
//                                     hideProgressBar={false}
//                                     newestOnTop={false}
//                                     closeOnClick
//                                     rtl={false}
//                                     pauseOnFocusLoss
//                                     draggable
//                                     pauseOnHover
//                                 />
//                                 <div className="logincopyrightcontainer">
//                                     <span className="logincopyright" href="/">© 2023 Alan English Inc.</span>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 </section>
//             </>

//         );
//     }
// }

// export default Login;

import React, { useState } from "react";
import HeadPhone from '../assets/img/Login2.png';
import './css/Login.scss';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { authentication, rtdb } from "./firebase-config";
import { child, get, ref, remove, update } from "firebase/database";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);


    // // 找出有在規定時間內上線的學生
    // useEffect(() => {
    //     const db = getFirestore();
    //     const currentDate = new Date();
    //     const currentMonthFormatted = currentDate.toJSON().slice(0, 7);

    //     const getStudents = async () => {
    //         const q = query(collection(db, 'student'),
    //             where('onlinemonth', '==', currentMonthFormatted),
    //             where('totaltimeplayed', '>', 0));

    //         try {
    //             const querySnapshot = await getDocs(q);
    //             const students = [];
    //             querySnapshot.forEach((doc) => {
    //                 students.push(doc.data());
    //             });
    //             localStorage.setItem('OnlineStudentData', JSON.stringify(students));
    //         } catch (error) {
    //             console.log(error);
    //         }
    //     };

    //     getStudents();
    // }, []);

    // // 找出未上線的學生
    // useEffect(() => {
    //     const db = getFirestore();

    //     const date = new Date();
    //     date.setDate(date.getDate() - 3);
    //     const offlineLimit = date.toJSON().slice(0, 10);

    //     const getOfflineStudents = async () => {
    //         const q = query(collection(db, 'student'),
    //             where('onlinetime', '<=', offlineLimit));

    //         try {
    //             const querySnapshot = await getDocs(q);
    //             const students = [];
    //             querySnapshot.forEach((doc) => {
    //                 students.push(doc.data());
    //             });
    //             localStorage.setItem('OfflineStudentData', JSON.stringify(students));
    //         } catch (error) {
    //             console.log(error);
    //         }
    //     }
    //     getOfflineStudents();
    // }, []);

    // 找出所有學生
    // useEffect(() => {
    //     const db = getFirestore();

    //     const getAllStudent = async () => {
    //         const q = collection(db, 'student');

    //         try {
    //             const querySnapshot = await getDocs(q);
    //             const students = [];
    //             querySnapshot.forEach((doc) => {
    //                 students.push(doc.data());
    //             });
    //             localStorage.setItem('AllStudent', JSON.stringify(students));
    //         } catch (error) {
    //             console.log(error);
    //         }
    //     }
    //     getAllStudent();
    // }, []);

    const handleChange = (e) => {
        if (e.target.name === "email") setEmail(e.target.value);
        if (e.target.name === "password") setPassword(e.target.value);
    }

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && email && password) login();
    }

    // async function getOnlineStudents() {
    //     try {
    //         // Create a reference to the "student" node
    //         const studentRef = ref(rtdb, '/student');

    //         // Use `orderByChild` and `equalTo` to filter online students
    //         const onlineStudentsRef = query(studentRef, orderByChild('onlinemonth'), equalTo(new Date().toJSON().slice(0, 7)));

    //         // Create a snapshot listener to get online students
    //         const unsubscribe = onValue(onlineStudentsRef, (snapshot) => {
    //             const students = [];
    //             snapshot.forEach((childSnapshot) => {
    //                 const data = childSnapshot.val();
    //                 // Check if totaltimeplayed is greater than 0
    //                 if (data.totaltimeplayed > 0) {
    //                     students.push(data);
    //                 }
    //             });
    //             // Store data in localStorage (optional)
    //             localStorage.setItem('OnlineStudentData', JSON.stringify(students));
    //         });

    //         // Remember to clean up the listener when necessary
    //         return unsubscribe; // Return the unsubscribe function for cleanup

    //     } catch (error) {
    //         console.error("Error getting online students:", error);
    //     }
    // }

    // const getOfflineStudents = async () => {
    //     const db = getFirestore();
    //     const date = new Date();
    //     date.setDate(date.getDate() - 3);
    //     const offlineLimit = date.toJSON().slice(0, 10);
    //     const q = query(collection(db, 'student'),
    //         where('onlinetime', '<=', offlineLimit));

    //     try {
    //         const querySnapshot = await getDocs(q);
    //         const students = [];
    //         querySnapshot.forEach((doc) => {
    //             students.push(doc.data());
    //         });
    //         localStorage.setItem('OfflineStudentData', JSON.stringify(students));
    //     } catch (error) {
    //         console.log(error);
    //     }
    // }

    const login = async () => {
        if (!email || !password) {
            toast.error('Please enter email and password', {
                className: "notification",
                position: "top-center",
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: false,
                draggable: true,
                progress: undefined,
                theme: "colored",
            });
            return;
        }

        setIsLoading(true);

        setTimeout(() => {
            setIsLoading(false);
        }, 2000);

        const currentDate = new Date().toJSON().slice(0, 10);
        const currentMonth = new Date().toJSON().slice(0, 7);

        try {
            const userCredential = await signInWithEmailAndPassword(authentication, email, password);
            const userid = userCredential.user.uid;

            // const userName = userDoc.data().name.toUpperCase();
            // const userRef = doc(db, 'student', userCredential.user.uid);

            // const onlinetime = userDoc.data().onlinetime;

            // 更新所有學生資料
            // const userRTDBRef = ref(rtdb, '/student/' + userCredential.user.uid);
            // await update(userRTDBRef, {
            //     Resetallmusic: "2024-03alreadyupdated",
            //     class: userDoc.data().class,
            //     Daytotaltimeplayed: userDoc.data().currdatetimeplayed || 0,
            //     email: userDoc.data().email,
            //     name: userDoc.data().name,
            //     onlinemonth: currentMonth,
            //     onlinetime: currentDate,
            //     Monthtotaltimeplayed: 0,
            // })



            const dbRef = ref(rtdb);
            get(child(dbRef, `student/${userid}`)).then((snapshot) => {
                const userName = snapshot.val().name.toUpperCase();
                const onlinetime = snapshot.val().onlinetime;
                const musicRef = ref(rtdb, '/student/' + userid);
                if (onlinetime !== currentDate) {
                    // await updateDoc(userRef, {
                    //     onlinemonth: currentMonth,
                    //     onlinetime: currentDate,
                    //     // currdatetimeplayed: 0,
                    // });

                    update(musicRef, {
                        Daytotaltimeplayed: 0,
                        onlinemonth: currentMonth,
                        onlinetime: currentDate,
                    })
                }

                if (snapshot.val().Resetallmusic === 'notupdated' || snapshot.val().Resetallmusic !== currentMonth + 'alreadyupdated') {
                    // setDoc(userRef, {
                    //     // totaltimeplayed: 0,
                    //     Resetallmusic: currentMonth + 'alreadyupdated',
                    // }, { merge: true });
                    const databaseRef = ref(rtdb, `student/${userid}`);
                    update(databaseRef, {
                        Monthtotaltimeplayed: 0,
                        Resetallmusic: currentMonth + 'alreadyupdated',
                    });
                    const musicLogfileRef = ref(rtdb, `student/${userid}/MusicLogfile`);
                    remove(musicLogfileRef);
                }

                // if (snapshot.val().class === 'Teacher') {
                //     getOnlineStudents();
                //     getOfflineStudents();
                // }
                toast.promise(
                    new Promise(resolve => setTimeout(resolve, 500)),
                    {
                        success: { render: () => <div className="notification">歡迎回來 {userName} !!</div> }
                    },
                    setTimeout(() => window.location = "/home/playlist/userinfo", 2500)
                );
            })

        } catch (error) {
            toast.promise(
                new Promise((resolve, reject) => setTimeout(reject, 2500)),
                { pending: 'Loading...', error: { render: () => <div className="notification">帳號密碼錯誤 🤯</div> } }
            );
        }
    }

    return (
        <>
            <section className="Login">
                <div className="Logincontainer">

                    <div className="Left">
                        <div className="english-method">
                            <p>步驟一：能聽清楚句子中每個單字,並瞭解中文句意。</p>
                            <p>步驟二：聽問句與提示後,能馬上完整地回答！回答速度可以比MP3更快！</p>
                            <p>步驟三：只唸幾次所強記的單字忘得快!!!!所以，依學生個別的專注能力，前兩個步驟需要 20～80 次反覆地聽讀跟唸,
                                才能有效地背誦並牢記單字！
                            </p>
                        </div>
                        <img className="head-phone-img" src={HeadPhone} alt="" />
                    </div>

                    <div className="Right">
                        {/* <a className="game-title" href="/tradelogin" alt="/tradelogin" >奕彬老師 理財達人投資遊戲點這裡!!!</a> */}
                        <div className="loginbrand">
                            <div className="loginbrandword">
                                <span>A</span>
                                <span>L</span>
                                <span>A</span>
                                <span>N</span>
                                <span> </span>
                                <span>E</span>
                                <span>N</span>
                                <span>G</span>
                                <span>L</span>
                                <span>I</span>
                                <span>S</span>
                                <span>H</span>
                            </div>
                            <div className="loginbrandbottom">
                                <div className="loginbrandbottomtext">系統化 | 口語化 | 聽力導向 </div>
                            </div>
                        </div>
                        <div className="loginsection">
                            <label>帳號</label>
                            <input
                                className="rightinput"
                                name="email"
                                type="email"
                                id="email"
                                placeholder="輸入電子郵件或帳號..."
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                value={email}
                            />

                            <label>密碼</label>
                            <input
                                className="rightinput"
                                name="password"
                                type="password"
                                id="password"
                                placeholder="輸入密碼..."
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                value={password}
                            />

                            <button
                                onClick={login}
                                className="loginbtn"
                                type="submit"
                                disabled={isLoading}
                            >
                                {isLoading ? "登入中..." : "登入"}
                            </button>
                            <a style={{ fontSize: 18, fontWeight: 700 }} href="/solve" alt="/solve" >無法登入嗎 ? 點這裡</a>
                            <ToastContainer
                                position="top-center"
                                autoClose={2000}
                                limit={1}
                                hideProgressBar={false}
                                newestOnTop={false}
                                closeOnClick
                                rtl={false}
                                pauseOnFocusLoss
                                draggable
                                pauseOnHover
                            />
                            <div className="logincopyrightcontainer">
                                <span className="logincopyright" href="/">© 2024 Alan English Inc.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

export default Login;
