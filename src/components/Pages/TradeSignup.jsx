import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import './css/TradeSignup.scss';

import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, update } from "firebase/database";

function TradeSignup() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [team, setTeam] = useState("");

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
            const rtdb = getDatabase();
            const databaseRef = ref(rtdb, 'Trade/TradeTeam/' + useruid);
            await update(databaseRef, {
                name: team,
                money: 1000,
                meatShares: 0,
                vegetableShares: 0,
                eggShares: 0,
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
        if (name === "team") setTeam(value);
    }

    return (
        <div className="Signup">
            <div className="background-image"></div>
            <div className="signupsection">
                <span>理財達人組別帳號創建</span>
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
                    <label>組別</label>
                    <input
                        name="team"
                        type="team"
                        id="team"
                        placeholder="輸入組別..."
                        onChange={handleChange}
                        value={team}
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
            </div>
        </div>
    );
}

export default TradeSignup;
