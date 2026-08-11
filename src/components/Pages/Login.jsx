import React, { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ToastContainer, toast } from "react-toastify";
import { authentication } from "./firebase-config";
import { supabase } from "./supabase-config";
import HeadPhone from "../assets/img/Login2.png";
import "react-toastify/dist/ReactToastify.css";
import "./css/Login.scss";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const showError = (message) => {
        toast.error(message, {
            position: "top-center",
            autoClose: 2500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            theme: "colored"
        });
    };

    const showSuccess = (name) => {
        toast.success(`歡迎回來 ${name}！`, {
            position: "top-center",
            autoClose: 1200,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            theme: "colored"
        });
    };

    const saveUserToLocalStorage = (firebaseUser, student) => {
        localStorage.setItem("ae-useruid", firebaseUser.uid);
        localStorage.setItem("ae-studentid", String(student.id || ""));
        localStorage.setItem("ae-username", student.name || firebaseUser.email?.split("@")[0] || "");
        localStorage.setItem("ae-class", student.class || "");
        localStorage.setItem("ae-userimage", student.user_image || "");
        localStorage.setItem("ae-plan", student.plan || "");
        localStorage.setItem("ae-role", student.role || "student");
    };

    const findStudentByUid = async (uid) => {
        return await supabase
            .from("students")
            .select("*")
            .eq("firebase_uid", uid)
            .maybeSingle();
    };

    const findStudentByEmail = async (studentEmail) => {
        return await supabase
            .from("students")
            .select("*")
            .ilike("email", studentEmail)
            .maybeSingle();
    };

    const login = async (e) => {
        e.preventDefault();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanEmail) return showError("請輸入 Email");
        if (!password) return showError("請輸入密碼");

        setIsLoading(true);

        try {
            const credential = await signInWithEmailAndPassword(authentication, cleanEmail, password);
            const firebaseUser = credential.user;

            console.log("🔥 Firebase 登入成功");
            console.log("Firebase UID:", firebaseUser.uid);
            console.log("Firebase Email:", firebaseUser.email);

            let student = null;

            const { data: studentByUid, error: uidError } = await findStudentByUid(firebaseUser.uid);

            if (uidError) {
                console.error("Supabase UID 查詢失敗:", uidError);
                await signOut(authentication);
                showError(`Supabase 讀取失敗：${uidError.message}`);
                return;
            }

            if (studentByUid) {
                student = studentByUid;
                console.log("✅ 使用 UID 找到學生:", student);
            }

            if (!student) {
                console.log("⚠️ UID 找不到，改用 Email 搜尋");

                const { data: studentByEmail, error: emailError } = await findStudentByEmail(
                    firebaseUser.email || cleanEmail
                );

                if (emailError) {
                    console.error("Supabase Email 查詢失敗:", emailError);
                    await signOut(authentication);
                    showError(`Supabase 讀取失敗：${emailError.message}`);
                    return;
                }

                if (studentByEmail) {
                    if (studentByEmail.firebase_uid && studentByEmail.firebase_uid !== firebaseUser.uid) {
                        await signOut(authentication);
                        showError("這個 Email 已綁定其他 Firebase 帳號");
                        return;
                    }

                    if (!studentByEmail.firebase_uid) {
                        const { data: updatedStudent, error: bindError } = await supabase
                            .from("students")
                            .update({
                                firebase_uid: firebaseUser.uid,
                                updated_at: new Date().toISOString()
                            })
                            .eq("id", studentByEmail.id)
                            .select("*")
                            .single();

                        if (bindError) {
                            console.error("UID 綁定失敗:", bindError);
                            await signOut(authentication);
                            showError(`UID 綁定失敗：${bindError.message}`);
                            return;
                        }

                        student = updatedStudent;
                        console.log("🔗 已自動綁定 Firebase UID:", student);
                    } else {
                        student = studentByEmail;
                    }
                }
            }

            if (!student) {
                console.error("❌ Supabase 完全找不到學生資料");
                await signOut(authentication);
                showError("Firebase 登入成功，但 Supabase 找不到這位學生");
                return;
            }

            saveUserToLocalStorage(firebaseUser, student);

            const { error: updateError } = await supabase
                .from("students")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", student.id);

            if (updateError) console.warn("更新 updated_at 失敗:", updateError);

            console.log("✅ 登入完成:", student);
            showSuccess(student.name || "同學");

            setTimeout(() => {
                window.location.href = "/userinfo";
            }, 900);
        } catch (error) {
            console.error("❌ Login error:", error);

            switch (error.code) {
                case "auth/invalid-email":
                    showError("Email 格式不正確");
                    break;
                case "auth/invalid-credential":
                case "auth/wrong-password":
                case "auth/user-not-found":
                    showError("帳號或密碼錯誤");
                    break;
                case "auth/user-disabled":
                    showError("此帳號已被停用");
                    break;
                case "auth/too-many-requests":
                    showError("登入失敗次數過多，請稍後再試");
                    break;
                case "auth/network-request-failed":
                    showError("Firebase 登入服務連線失敗");
                    break;
                default:
                    showError(error?.message || "登入失敗");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="Login">
            <div className="login-bg-circle login-bg-circle-one"></div>
            <div className="login-bg-circle login-bg-circle-two"></div>

            <div className="login-container">
                <div className="login-left">
                    <div className="login-left-content">
                        <div className="login-brand">
                            <div className="login-brand-word">
                                <span>A</span><span>L</span><span>A</span><span>N</span>
                                <i></i>
                                <span>E</span><span>N</span><span>G</span><span>L</span><span>I</span><span>S</span><span>H</span>
                            </div>
                            <div className="login-brand-subtitle">Learn English · Listen Better</div>
                        </div>

                        <div className="login-hero">
                            <div className="login-hero-text">
                                <span className="login-badge">ALAN ENGLISH</span>
                                <h1>每天聽一點，<br />英文進步一點。</h1>
                                <p>透過反覆聆聽與口語練習，讓英文從「聽得懂」慢慢變成「說得出來」。</p>
                            </div>
                            <img className="login-headphone" src={HeadPhone} alt="Alan English" />
                        </div>

                        <div className="login-methods">
                            <div className="login-method">
                                <div className="method-number">01</div>
                                <div>
                                    <strong>聽清楚</strong>
                                    <span>理解單字、句型與完整內容</span>
                                </div>
                            </div>

                            <div className="login-method">
                                <div className="method-number">02</div>
                                <div>
                                    <strong>快速回答</strong>
                                    <span>訓練聽到問題後立即反應</span>
                                </div>
                            </div>

                            <div className="login-method">
                                <div className="method-number">03</div>
                                <div>
                                    <strong>反覆練習</strong>
                                    <span>透過重複聆聽建立英文語感</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="login-right">
                    <form className="login-card" onSubmit={login}>
                        <div className="mobile-brand">
                            <div className="mobile-brand-word">
                                <span>A</span><span>L</span><span>A</span><span>N</span>
                                <i></i>
                                <span>E</span><span>N</span><span>G</span><span>L</span><span>I</span><span>S</span><span>H</span>
                            </div>
                        </div>

                        <div className="login-title">
                            <span>WELCOME BACK</span>
                            <h2>歡迎回來 👋</h2>
                            <p>登入 Alan English，開始今天的英文練習。</p>
                        </div>

                        <div className="login-field">
                            <label htmlFor="email">Email</label>
                            <div className="login-input-wrapper">
                                <span className="login-input-icon">✉</span>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="輸入你的 Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="login-field">
                            <div className="password-label">
                                <label htmlFor="password">密碼</label>
                                <a href="/solve">忘記密碼？</a>
                            </div>

                            <div className="login-input-wrapper">
                                <span className="login-input-icon password-icon">●</span>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="輸入你的密碼"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="show-password-button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                >
                                    {showPassword ? "隱藏" : "顯示"}
                                </button>
                            </div>
                        </div>

                        <button className="login-button" type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <span className="login-spinner"></span>
                                    登入中...
                                </>
                            ) : "登入"}
                        </button>

                        <div className="login-tip">
                            <span>🎧</span>
                            每一次聆聽，都讓英文更自然。
                        </div>

                        <div className="login-copyright">
                            © 2020–2026 Alan English Inc.
                        </div>
                    </form>
                </div>
            </div>

            <ToastContainer
                position="top-center"
                autoClose={2000}
                limit={1}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss={false}
                draggable
                pauseOnHover={false}
            />
        </section>
    );
}

export default Login;