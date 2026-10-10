import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { loginWithIdentifier } from "../../auth/authService";
import { useAuth } from "../../auth/AuthContext";
import HeadPhone from "../assets/img/Login2.png";
import Brand from "../fragment/Brand";
import "react-toastify/dist/ReactToastify.css";
import "./css/Login.scss";

function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { authLoading, isAuthenticated } = useAuth();
    const [identifier, setIdentifier] = useState(() => new URLSearchParams(location.search).get("username") || "");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const loginAttemptRef = useRef(false);
    const accountActivated = new URLSearchParams(location.search).get("activated") === "1";
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

        const cleanIdentifier = identifier.trim().toLowerCase();

        if (!cleanIdentifier) return showError("請輸入帳號或 Email");
        if (!password) return showError("請輸入密碼");

        loginAttemptRef.current = true;
        setIsLoading(true);

        try {
            const { student } = await loginWithIdentifier(cleanIdentifier, password);
            showSuccess(student.name || "同學");
            window.scrollTo(0, 0);
            loginAttemptRef.current = false;
            if (student?.onboarding?.required === true) {
                navigate("/student/onboarding", {
                    replace: true,
                    state: {
                        firstLogin: true,
                        ...(requestedLocation ? { from: requestedLocation } : {})
                    }
                });
            } else {
                navigate(destination, { replace: true });
            }
        } catch (error) {
            loginAttemptRef.current = false;
            console.error("Login error:", error);

            switch (error.code) {
                case "auth/invalid-email":
                case "auth/invalid-login-identifier":
                    showError("帳號或 Email 格式不正確");
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
                    showError("網路連線失敗，請確認網路後再試一次");
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
                            <Brand className="login-brand-word" />
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
                            <Brand className="mobile-brand-word" />
                        </div>

                        <div className="login-title">
                            <span>WELCOME BACK</span>
                            <h2>歡迎回來 👋</h2>
                            <p>登入 Alan English，開始今天的英文練習。</p>
                        </div>

                        {accountActivated && (
                            <div className="login-activation-success" role="status">
                                <strong>帳號已開通</strong>
                            <span>請使用剛才設定的帳號與密碼登入。</span>
                            </div>
                        )}

                        <div className="login-field">
                            <label htmlFor="identifier">帳號或 Email</label>
                            <div className="login-input-wrapper">
                                <span className="login-input-icon">✉</span>
                                <input
                                    id="identifier"
                                    name="identifier"
                                    type="text"
                                    placeholder="英文班帳號或 Email"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    disabled={isLoading}
                                    autoComplete="username"
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
                                    aria-pressed={showPassword}
                                    aria-controls="password"
                                    disabled={isLoading}
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

                        <details className="login-help">
                            <summary>第一次使用或需要協助？</summary>
                            <nav aria-label="登入協助">
                                <Link to="/academy/student-setup">掃描登入卡啟用</Link>
                                <Link to="/academy/recover">使用登入卡復原碼</Link>
                                <Link to="/support">聯絡客服</Link>
                            </nav>
                        </details>

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
