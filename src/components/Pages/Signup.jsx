import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./css/Signup.scss";

import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import { firebaseConfig } from "./firebase-config";
import { supabase } from "./supabase-config";

function Signup() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [classtype, setClassType] = useState("");
    const [plan, setPlan] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const showSuccess = () => {
        toast.success("學生帳號建立成功", {
            className: "notification",
            position: "top-center",
            autoClose: 1800,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true
        });
    };

    const showError = (message) => {
        toast.error(message || "建立失敗", {
            className: "notification",
            position: "top-center",
            autoClose: 2500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true
        });
    };

    const clearForm = () => {
        setEmail("");
        setPassword("");
        setName("");
        setClassType("");
        setPlan("");
    };

    const validateForm = () => {
        if (!email.trim()) {
            showError("請輸入 Email");
            return false;
        }
        if (!password) {
            showError("請輸入密碼");
            return false;
        }
        if (password.length < 6) {
            showError("密碼至少需要 6 個字元");
            return false;
        }
        if (!name.trim()) {
            showError("請輸入學生 English Name");
            return false;
        }
        if (!classtype) {
            showError("請選擇 Class");
            return false;
        }
        if (!plan) {
            showError("請選擇 Plan");
            return false;
        }
        return true;
    };

    const signupUser = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsLoading(true);
        let secondaryApp = null;

        try {
            const secondaryAppName = `studentCreator-${Date.now()}`;
            secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
            const secondaryAuth = getAuth(secondaryApp);

            const credentials = await createUserWithEmailAndPassword(
                secondaryAuth,
                email.trim().toLowerCase(),
                password
            );

            const firebaseUid = credentials.user.uid;

            const { error: studentError } = await supabase.from("students").insert({
                firebase_uid: firebaseUid,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                class: classtype,
                role: "student",
                plan,
                user_image: "6C9570CC-B276-424C-857F-11BBDD21C99B.png",
                total_time_played: 0,
                current_time_played: 0
            });

            if (studentError) {
                console.error("Supabase 新增學生失敗:", studentError);
                throw new Error(`學生資料寫入失敗：${studentError.message}`);
            }

            await signOut(secondaryAuth);
            showSuccess();
            clearForm();
        } catch (err) {
            console.error("建立學生發生錯誤:", err);

            if (err.code === "auth/email-already-in-use") {
                showError("這個 Email 已經建立過帳號");
            } else if (err.code === "auth/invalid-email") {
                showError("Email 格式不正確");
            } else if (err.code === "auth/weak-password") {
                showError("密碼強度不足");
            } else if (err.message) {
                showError(err.message);
            } else {
                showError("建立學生失敗");
            }
        } finally {
            if (secondaryApp) {
                try {
                    await deleteApp(secondaryApp);
                } catch (deleteError) {
                    console.warn("Secondary Firebase App 移除失敗:", deleteError);
                }
            }
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === "email") setEmail(value);
        else if (name === "password") setPassword(value);
        else if (name === "name") setName(value);
        else if (name === "classtype") setClassType(value);
        else if (name === "plan") setPlan(value);
    };

    return (
        <div className="Signup">
            <div className="background-image" />

            <form className="signupsection" onSubmit={signupUser}>
                <div className="signup-header">
                    <div className="signup-badge">Student Management</div>
                    <h1>新增學生資料</h1>
                    <p>建立學生登入帳號並同步新增至 Alan English 資料庫。</p>
                </div>

                <div className="signupinput">
                    <label>帳號 Email</label>
                    <input
                        name="email"
                        type="email"
                        placeholder="student@example.com"
                        value={email}
                        onChange={handleChange}
                        autoComplete="off"
                    />
                </div>

                <div className="signupinput">
                    <label>初始密碼</label>
                    <input
                        name="password"
                        type="password"
                        placeholder="至少 6 個字元"
                        value={password}
                        onChange={handleChange}
                        autoComplete="new-password"
                    />
                </div>

                <div className="signupinput">
                    <label>English Name</label>
                    <input
                        name="name"
                        type="text"
                        placeholder="例如 Alan"
                        value={name}
                        onChange={handleChange}
                    />
                </div>

                <div className="signup-row">
                    <div className="signupinput">
                        <label>Class</label>
                        <select name="classtype" value={classtype} onChange={handleChange}>
                            <option value="" disabled>選擇 Class...</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                        </select>
                    </div>

                    <div className="signupinput">
                        <label>Plan</label>
                        <select name="plan" value={plan} onChange={handleChange}>
                            <option value="" disabled>選擇 Plan...</option>
                            <option value="listeningonly">純聽力</option>
                            <option value="allcover">全方位</option>
                        </select>
                    </div>
                </div>

                <button type="submit" className="signupbtn" disabled={isLoading}>
                    {isLoading ? "建立中..." : "創建學生資料"}
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
            </form>
        </div>
    );
}

export default Signup;