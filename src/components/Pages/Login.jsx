import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { loginWithEmail } from "../../auth/authService";
import { useAuth } from "../../auth/AuthContext";
import HeadPhone from "../assets/img/Login2.png";
import "react-toastify/dist/ReactToastify.css";
import "./css/Login.scss";

function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { authLoading, isAuthenticated } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const loginAttemptRef = useRef(false);
    const requestedLocation = location.state?.from;
    const destination = requestedLocation
        ? `${requestedLocation.pathname || ""}${requestedLocation.search || ""}`
        : "/userinfo";

    useEffect(() => {
        if (
            !authLoading &&
            isAuthenticated &&
            !loginAttemptRef.current
        ) {
            navigate(destination, { replace: true });
        }
    }, [authLoading, destination, isAuthenticated, navigate]);

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
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            theme: "colored"
        });
    };

    const releaseFormFocus = () => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) activeElement.blur();
    };

    const login = async (e) => {
        e.preventDefault();
        releaseFormFocus();

        const cleanEmail = email.trim().toLowerCase();

        if (!cleanEmail) return showError("請輸入 Email");
        if (!password) return showError("請輸入密碼");

        loginAttemptRef.current = true;
        setIsLoading(true);

        try {
            const { student } = await loginWithEmail(cleanEmail, password);
            showSuccess(student.name || "同學");
            window.scrollTo(0, 0);
            loginAttemptRef.current = false;
            navigate(destination, { replace: true });
        } catch (error) {
            loginAttemptRef.current = false;
            console.error("Login error:", error);

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

    if (authLoading) {
        return (
            <section className="Login">
                <div className="login-container">
                    <div className="login-right" style={{ width: "100%" }}>
                        <div className="login-card" style={{ textAlign: "center" }}>
                            <span className="login-spinner"></span>
                            <p style={{ marginTop: "16px" }}>正在確認登入狀態...</p>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    if (
        isAuthenticated &&
        !loginAttemptRef.current
    ) {
        return <Navigate to={destination} replace />;
    }

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
                                <Link to="/forgot-password">忘記密碼？</Link>
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

                        <div className="login-trial">
                            <span>還沒有帳號？</span>
                            <Link to="/freetrial">自行註冊／輸入教材兌換碼</Link>
                        </div>

                        <div className="login-trial">
                            <span>登入或付款遇到問題？</span>
                            <Link to="/support">聯絡客服</Link>
                        </div>

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

        </section>
    );
}

export default Login;
