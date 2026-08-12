import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./css/Signup.scss";

import {
    createUserWithEmailAndPassword,
    deleteUser,
    getAuth,
    signInWithEmailAndPassword,
    signOut
} from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import { authentication, firebaseConfig } from "./firebase-config";
import { supabaseKey, supabaseUrl } from "./supabase-config";
import { useAuth } from "../../auth/AuthContext";

function Signup() {
    const { role: currentRole } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [accountRole, setAccountRole] = useState("student");
    const [classtype, setClassType] = useState("");
    const [plan, setPlan] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const isAdmin = currentRole === "admin";
    const isStudentAccount = accountRole === "student";

    const showSuccess = (message = "帳號建立成功") => {
        toast.success(message, {
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
            autoClose: 3000,
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
        setAccountRole("student");
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
            showError("請輸入 English Name");
            return false;
        }

        if (!isAdmin && accountRole !== "student") {
            showError("教師只能建立學生帳號");
            return false;
        }

        if (isStudentAccount) {
            if (!classtype) {
                showError("請選擇 Class");
                return false;
            }

            if (!plan) {
                showError("請選擇 Plan");
                return false;
            }
        }

        return true;
    };

    const createUserInDatabase = async (firebaseUid) => {
        const creatorUser = authentication.currentUser;

        if (!creatorUser) {
            throw new Error("找不到目前登入狀態，請重新登入");
        }

        const creatorIdToken = await creatorUser.getIdToken(true);

        const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${creatorIdToken}`,
                "apikey": supabaseKey
            },
            body: JSON.stringify({
                firebase_uid: firebaseUid,
                email: email.trim().toLowerCase(),
                name: name.trim(),
                role: accountRole,
                class: isStudentAccount ? classtype : null,
                plan: isStudentAccount ? plan : null
            })
        });

        let result = null;

        try {
            result = await response.json();
        } catch (error) {
            console.error("create-user 回傳格式錯誤:", error);
        }

        if (!response.ok) {
            throw new Error(result?.error || `帳號資料建立失敗（HTTP ${response.status}）`);
        }

        return result;
    };

    const signupUser = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsLoading(true);

        let secondaryApp = null;
        let secondaryAuth = null;
        let secondaryUser = null;
        let firebaseAccountCreatedNow = false;

        try {
            const secondaryAppName = `accountCreator-${Date.now()}`;
            secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
            secondaryAuth = getAuth(secondaryApp);

            try {
                const credentials = await createUserWithEmailAndPassword(
                    secondaryAuth,
                    email.trim().toLowerCase(),
                    password
                );

                secondaryUser = credentials.user;
                firebaseAccountCreatedNow = true;
            } catch (firebaseCreateError) {
                if (firebaseCreateError.code !== "auth/email-already-in-use") {
                    throw firebaseCreateError;
                }

                console.warn("Firebase 帳號已存在，嘗試修復既有帳號資料");

                try {
                    const existingCredentials = await signInWithEmailAndPassword(
                        secondaryAuth,
                        email.trim().toLowerCase(),
                        password
                    );

                    secondaryUser = existingCredentials.user;
                } catch (existingLoginError) {
                    if (
                        existingLoginError.code === "auth/invalid-credential" ||
                        existingLoginError.code === "auth/wrong-password"
                    ) {
                        throw new Error(
                            "這個 Email 已存在 Firebase，但輸入的密碼不正確。請確認原本建立此帳號時使用的密碼。"
                        );
                    }

                    throw existingLoginError;
                }
            }

            if (!secondaryUser?.uid) {
                throw new Error("無法取得 Firebase UID");
            }

            try {
                const result = await createUserInDatabase(secondaryUser.uid);

                if (secondaryAuth.currentUser) {
                    await signOut(secondaryAuth);
                }

                if (result?.repaired) {
                    showSuccess("既有帳號已修復並同步完成");
                } else if (accountRole === "teacher") {
                    showSuccess("教師帳號建立成功");
                } else if (accountRole === "admin") {
                    showSuccess("管理員帳號建立成功");
                } else {
                    showSuccess("學生帳號建立成功");
                }

                clearForm();
            } catch (databaseError) {
                if (firebaseAccountCreatedNow && secondaryUser) {
                    try {
                        await deleteUser(secondaryUser);
                        console.warn("資料庫建立失敗，已回滾剛建立的 Firebase 帳號");
                    } catch (rollbackError) {
                        console.error("Firebase 帳號回滾失敗:", rollbackError);
                    }
                }

                throw databaseError;
            }
        } catch (err) {
            console.error("建立帳號發生錯誤:", err);

            if (err.code === "auth/invalid-email") {
                showError("Email 格式不正確");
            } else if (err.code === "auth/weak-password") {
                showError("密碼強度不足");
            } else if (err.code === "auth/too-many-requests") {
                showError("操作次數過多，請稍後再試");
            } else if (err.code === "auth/network-request-failed") {
                showError("Firebase 連線失敗，請確認網路後再試");
            } else if (err.message) {
                showError(err.message);
            } else {
                showError("建立帳號失敗");
            }
        } finally {
            if (secondaryAuth?.currentUser) {
                try {
                    await signOut(secondaryAuth);
                } catch (signOutError) {
                    console.warn("Secondary Firebase Auth 登出失敗:", signOutError);
                }
            }

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

    const handleRoleChange = (e) => {
        const nextRole = e.target.value;
        setAccountRole(nextRole);

        if (nextRole !== "student") {
            setClassType("");
            setPlan("");
        }
    };

    return (
        <div className="Signup">
            <div className="background-image" />

            <form className="signupsection" onSubmit={signupUser}>
                <div className="signup-header">
                    <div className="signup-badge">Account Management</div>
                    <h1>建立 Alan English 帳號</h1>
                    <p>
                        {isAdmin
                            ? "管理員可以建立學生、教師與管理員帳號。"
                            : "教師可以建立學生登入帳號並同步新增至 Alan English 資料庫。"}
                    </p>
                </div>

                {isAdmin && (
                    <div className="signupinput">
                        <label>帳號角色</label>
                        <select
                            value={accountRole}
                            onChange={handleRoleChange}
                            disabled={isLoading}
                        >
                            <option value="student">Student 學生</option>
                            <option value="teacher">Teacher 教師</option>
                            <option value="admin">Admin 管理員</option>
                        </select>
                    </div>
                )}

                <div className="signupinput">
                    <label>帳號 Email</label>
                    <input
                        type="email"
                        placeholder="user@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="off"
                        disabled={isLoading}
                    />
                </div>

                <div className="signupinput">
                    <label>初始密碼</label>
                    <input
                        type="password"
                        placeholder="至少 6 個字元"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        disabled={isLoading}
                    />
                </div>

                <div className="signupinput">
                    <label>English Name</label>
                    <input
                        type="text"
                        placeholder="例如 Alan"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                {isStudentAccount && (
                    <div className="signup-row">
                        <div className="signupinput">
                            <label>Class</label>
                            <select
                                value={classtype}
                                onChange={(e) => setClassType(e.target.value)}
                                disabled={isLoading}
                            >
                                <option value="" disabled>選擇 Class...</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                            </select>
                        </div>

                        <div className="signupinput">
                            <label>Plan</label>
                            <select
                                value={plan}
                                onChange={(e) => setPlan(e.target.value)}
                                disabled={isLoading}
                            >
                                <option value="" disabled>選擇 Plan...</option>
                                <option value="listeningonly">純聽力</option>
                                <option value="allcover">全方位</option>
                            </select>
                        </div>
                    </div>
                )}

                {!isStudentAccount && (
                    <div className="signup-role-note">
                        {accountRole === "teacher"
                            ? "教師帳號不需要 Class 與 Plan。"
                            : "管理員帳號不需要 Class 與 Plan。"}
                    </div>
                )}

                <button type="submit" className="signupbtn" disabled={isLoading}>
                    {isLoading ? "建立中..." : `建立${accountRole === "student" ? "學生" : accountRole === "teacher" ? "教師" : "管理員"}帳號`}
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