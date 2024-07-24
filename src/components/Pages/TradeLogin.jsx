import React, { useState } from "react";
import HeadPhone from '../assets/img/Login2.png';
import './css/TradeLogin.scss';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { authentication, rtdb } from "./firebase-config";
import { child, get, ref } from "firebase/database";


function TradeLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        if (e.target.name === "email") setEmail(e.target.value);
        if (e.target.name === "password") setPassword(e.target.value);
    }

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && email && password) login();
    }

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


            const dbRef = ref(rtdb);
            get(child(dbRef, `Trade/TradeTeam/${userid}`)).then((snapshot) => {
                const userName = snapshot.val().name.toUpperCase();

                toast.promise(
                    new Promise(resolve => setTimeout(resolve, 500)),
                    {
                        success: { render: () => <div className="notification">歡迎回來 {userName} !!</div> }
                    },
                    setTimeout(() => window.location = "/trade", 2500)
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
                    <div className="Right">
                        <div className="loginbrand">
                            <div className="loginbrandword">
                                <span>理</span>
                                <span>財</span>
                                <span>達</span>
                                <span>人</span>
                                <span> </span>
                                <span>投</span>
                                <span>資</span>
                                <span>遊</span>
                                <span>戲</span>
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
                                <span className="logincopyright" href="/">© 2024 Taoyuan Cram School Inc.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}

export default TradeLogin