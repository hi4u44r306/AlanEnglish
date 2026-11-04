import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { FiAlertTriangle, FiBell, FiCheck, FiLock, FiMail } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import {
    confirmGuardianEmailVerification,
    requestGuardianEmailVerification
} from "../../services/membershipService";
import { markAcademyPasswordChanged } from "../../services/academyStudentService";
import {
    enableWebPush,
    getCurrentWebPushStatus,
    getWebPushAvailability,
    getWebPushConfig
} from "../../services/webPushService";
import "./css/StudentOnboarding.scss";

const passwordError = error => {
    if (["auth/invalid-credential", "auth/wrong-password"].includes(error?.code)) {
        return "臨時密碼不正確，請輸入剛剛登入用的那一組一次性臨時密碼。";
    }
    if (error?.code === "auth/too-many-requests") return "嘗試次數過多，請稍後再試。";
    if (error?.code === "auth/requires-recent-login") return "登入狀態已過期，請登出後重新登入。";
    return error?.message || "目前無法更新密碼，請稍後再試。";
};

const normalizeEmail = value => String(value || "").trim().toLowerCase();

function StepStatus({ complete }) {
    return complete
        ? <span className="student-onboarding-status complete"><FiCheck />已完成</span>
        : <span className="student-onboarding-status">待完成</span>;
}

function StudentOnboarding() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        firebaseUser,
        studentProfile,
        refreshStudentProfile,
        logout
    } = useAuth();
    const steps = studentProfile?.onboarding?.steps || {};
    const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
    // 剛用臨時密碼登入時，直接設定新密碼就好；只有登入太久、Firebase 要求重新確認身分時，才請他再輸入一次臨時密碼。
    const [needCurrentPassword, setNeedCurrentPassword] = useState(false);
    const [guardianEmail, setGuardianEmail] = useState(studentProfile?.guardian?.email || "");
    const [guardianEmailAgain, setGuardianEmailAgain] = useState("");
    const [pendingGuardianEmail, setPendingGuardianEmail] = useState("");
    const [verification, setVerification] = useState({ requestId: null, maskedEmail: "", code: "" });
    const [working, setWorking] = useState("");
    const [message, setMessage] = useState({ type: "", text: "" });
    const [shouldOfferPush] = useState(() => (
        location.state?.firstLogin === true || studentProfile?.onboarding?.required === true
    ));
    const [pushConfig, setPushConfig] = useState(null);
    const [pushStatus, setPushStatus] = useState(() => ({
        ...getWebPushAvailability(),
        active: false
    }));
    const [pushDecisionMade, setPushDecisionMade] = useState(false);

    const completedCount = [
        steps.password_complete,
        steps.guardian_email_complete
    ].filter(Boolean).length;

    const activeStep = !steps.password_complete ? "password"
        : !steps.guardian_email_complete ? "guardian" : "done";

    useEffect(() => {
        setGuardianEmail(studentProfile?.guardian?.email || "");
    }, [studentProfile?.guardian?.email]);

    useEffect(() => {
        if (!shouldOfferPush || !firebaseUser || completedCount < 2) return undefined;
        let cancelled = false;
        const availability = getWebPushAvailability();
        setPushStatus({ ...availability, active: false });
        getWebPushConfig(firebaseUser).then(async config => {
            if (cancelled) return;
            setPushConfig(config);
            if (availability.supported && config?.enabled) {
                const status = await getCurrentWebPushStatus(firebaseUser);
                if (!cancelled) {
                    setPushStatus(status);
                    if (status.active) setPushDecisionMade(true);
                }
            }
        }).catch(() => {
            if (!cancelled) setPushConfig({ enabled: false });
        });
        return () => { cancelled = true; };
    }, [completedCount, firebaseUser, shouldOfferPush]);

    useEffect(() => {
        if (
            studentProfile?.onboarding?.required !== false
            || completedCount < 2
            || (shouldOfferPush && !pushDecisionMade)
        ) return;
        const requested = location.state?.from;
        const destination = requested?.pathname?.startsWith("/student/")
            ? `${requested.pathname}${requested.search || ""}`
            : "/student/dashboard";
        navigate(destination, { replace: true });
    }, [completedCount, location.state, navigate, pushDecisionMade, shouldOfferPush, studentProfile?.onboarding?.required]);

    const enableNotifications = async () => {
        if (!firebaseUser || working || !pushConfig?.enabled) return;
        setWorking("push");
        setMessage({ type: "", text: "" });
        try {
            await enableWebPush(firebaseUser, pushConfig.public_key);
            const status = await getCurrentWebPushStatus(firebaseUser);
            setPushStatus(status);
            setPushDecisionMade(true);
            setMessage({ type: "success", text: "此裝置已開啟通知。完成必要資料後就會進入學生首頁。" });
        } catch (error) {
            setPushStatus(getWebPushAvailability());
            setMessage({ type: "error", text: error?.message || "目前無法開啟通知，你可以稍後再設定。" });
        } finally {
            setWorking("");
        }
    };

    const skipNotifications = () => {
        setPushDecisionMade(true);
        setMessage({ type: "success", text: "已略過裝置通知。之後可隨時到選單的「通知設定」開啟。" });
    };

    // 用「新密碼」當作目前密碼重新驗證一次：成功代表新密碼和臨時密碼一樣，不允許。
    const matchesCurrentPassword = async candidate => {
        try {
            await reauthenticateWithCredential(
                firebaseUser,
                EmailAuthProvider.credential(firebaseUser.email, candidate)
            );
            return true;
        } catch (error) {
            if (["auth/invalid-credential", "auth/wrong-password"].includes(error?.code)) return false;
            throw error;
        }
    };

    const changePassword = async event => {
        event.preventDefault();
        setMessage({ type: "", text: "" });
        if (!firebaseUser?.email) return;
        if (passwordForm.next.length < 6) {
            return setMessage({ type: "error", text: "新密碼至少需要 6 個字元。" });
        }
        if (passwordForm.next !== passwordForm.confirm) {
            return setMessage({ type: "error", text: "兩次輸入的新密碼不一致。" });
        }
        if (needCurrentPassword && !passwordForm.current) {
            return setMessage({ type: "error", text: "請輸入剛剛登入用的一次性臨時密碼。" });
        }
        if (needCurrentPassword && passwordForm.current === passwordForm.next) {
            return setMessage({ type: "error", text: "新密碼不可與一次性臨時密碼相同。" });
        }

        setWorking("password");
        try {
            if (needCurrentPassword) {
                await reauthenticateWithCredential(
                    firebaseUser,
                    EmailAuthProvider.credential(firebaseUser.email, passwordForm.current)
                );
            } else if (await matchesCurrentPassword(passwordForm.next)) {
                return setMessage({ type: "error", text: "新密碼不可與一次性臨時密碼相同，請設定你自己的密碼。" });
            }
            try {
                await updatePassword(firebaseUser, passwordForm.next);
            } catch (updateError) {
                if (updateError?.code === "auth/requires-recent-login" && !needCurrentPassword) {
                    setNeedCurrentPassword(true);
                    return setMessage({ type: "error", text: "為了安全，請再輸入一次剛剛登入用的一次性臨時密碼，確認是你本人。" });
                }
                throw updateError;
            }
            await firebaseUser.getIdToken(true);
            await markAcademyPasswordChanged(firebaseUser);
            await refreshStudentProfile();
            setPasswordForm({ current: "", next: "", confirm: "" });
            setNeedCurrentPassword(false);
            setMessage({ type: "success", text: "新密碼已設定。請繼續完成下面的資料。" });
        } catch (error) {
            setMessage({ type: "error", text: passwordError(error) });
        } finally {
            setWorking("");
        }
    };

    const reviewGuardianEmail = event => {
        event.preventDefault();
        setMessage({ type: "", text: "" });
        const first = normalizeEmail(guardianEmail);
        if (first !== normalizeEmail(guardianEmailAgain)) {
            return setMessage({ type: "error", text: "兩次輸入的家長 Email 不一致，請再確認。" });
        }
        setPendingGuardianEmail(first);
    };

    const sendGuardianCode = async () => {
        setMessage({ type: "", text: "" });
        setWorking("guardian-send");
        try {
            const result = await requestGuardianEmailVerification(firebaseUser, pendingGuardianEmail);
            setPendingGuardianEmail("");
            if (result?.already_verified) {
                await refreshStudentProfile();
                setMessage({ type: "success", text: "這個家長 Email 已完成驗證。" });
            } else {
                setVerification({
                    requestId: result?.request_id || null,
                    maskedEmail: result?.masked_email || "家長信箱",
                    code: ""
                });
                setMessage({ type: "success", text: "驗證碼已寄出，請家長查看收件匣與垃圾郵件。" });
            }
        } catch (error) {
            setMessage({ type: "error", text: error?.message || "目前無法寄送驗證碼。" });
        } finally {
            setWorking("");
        }
    };

    const verifyGuardianCode = async event => {
        event.preventDefault();
        setMessage({ type: "", text: "" });
        if (!/^\d{6}$/.test(verification.code)) {
            return setMessage({ type: "error", text: "請輸入信件中的 6 位數驗證碼。" });
        }
        setWorking("guardian-verify");
        try {
            await confirmGuardianEmailVerification(
                firebaseUser,
                verification.requestId,
                verification.code
            );
            await refreshStudentProfile();
            setVerification({ requestId: null, maskedEmail: "", code: "" });
            setMessage({ type: "success", text: "家長 Email 驗證成功！" });
        } catch (error) {
            setMessage({ type: "error", text: error?.message || "驗證碼確認失敗。" });
        } finally {
            setWorking("");
        }
    };

    return (
        <main className="student-onboarding-page">
            <section className="student-onboarding-shell">
                <header className="student-onboarding-hero">
                    <span>FIRST LOGIN</span>
                    <h1>第一次登入，先完成帳號設定</h1>
                    <p>一次完成一個步驟。需要填寫家長資料時，可以請家長一起協助。</p>
                    <div className="student-onboarding-progress" aria-label={`已完成 ${completedCount} 個步驟，共 2 個`}>
                        <div style={{ width: `${(completedCount / 2) * 100}%` }} />
                    </div>
                    <strong>{completedCount}／2 已完成</strong>
                </header>

                <ol className="student-onboarding-steps" aria-label="帳號設定步驟">
                    {[{ key: "password", label: "設定密碼", complete: steps.password_complete }, { key: "guardian", label: "家長信箱", complete: steps.guardian_email_complete }].map((step, index) => (
                        <li key={step.key} aria-current={activeStep === step.key ? "step" : undefined} className={step.complete ? "is-complete" : ""}><span aria-hidden="true">{step.complete ? <FiCheck /> : index + 1}</span>{step.label}</li>
                    ))}
                </ol>
                {message.text && (
                    <div className={`student-onboarding-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>
                        {message.text}
                    </div>
                )}

                <article hidden={activeStep !== "password"} className={`student-onboarding-card ${steps.password_complete ? "complete" : ""}`}>
                    <header><div><FiLock /><span>步驟 1</span><h2>設定自己的密碼</h2></div><StepStatus complete={steps.password_complete} /></header>
                    {steps.password_complete ? (
                        <p>密碼已更換完成。之後請使用新密碼登入。</p>
                    ) : (
                        <form onSubmit={changePassword}>
                            {needCurrentPassword
                                ? <label><span>剛剛登入用的一次性臨時密碼</span><input type="password" autoComplete="current-password" value={passwordForm.current} onChange={event => setPasswordForm(current => ({ ...current, current: event.target.value }))} required /></label>
                                : <p className="student-onboarding-direct-note">你剛剛已經用臨時密碼登入了，現在直接設定自己的新密碼就好，不用再輸入一次臨時密碼。</p>}
                            <div className="student-onboarding-form-grid">
                                <label><span>新密碼</span><input type="password" autoComplete="new-password" minLength={6} value={passwordForm.next} onChange={event => setPasswordForm(current => ({ ...current, next: event.target.value }))} required /></label>
                                <label><span>再輸入一次</span><input type="password" autoComplete="new-password" minLength={6} value={passwordForm.confirm} onChange={event => setPasswordForm(current => ({ ...current, confirm: event.target.value }))} required /></label>
                            </div>
                            <small>至少 6 個字元，不要使用姓名或生日。</small>
                            <button type="submit" disabled={Boolean(working)}>{working === "password" ? "更新中…" : "設定新密碼"}</button>
                        </form>
                    )}
                </article>

                <article hidden={activeStep !== "guardian"} className={`student-onboarding-card ${steps.guardian_email_complete ? "complete" : ""}`}>
                    <header><div><FiMail /><span>步驟 2</span><h2>驗證家長 Email</h2></div><StepStatus complete={steps.guardian_email_complete} /></header>
                    {steps.guardian_email_complete ? (
                        <p>家長 Email 已完成驗證：{studentProfile?.guardian?.email}</p>
                    ) : verification.requestId ? (
                        <form onSubmit={verifyGuardianCode}>
                            <p>驗證碼已寄到 {verification.maskedEmail}。</p>
                            <label><span>6 位數驗證碼</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={verification.code} onChange={event => setVerification(current => ({ ...current, code: event.target.value.replace(/\D/g, "") }))} required /></label>
                            <button type="submit" disabled={Boolean(working)}>{working === "guardian-verify" ? "驗證中…" : "確認驗證碼"}</button>
                            <button type="button" className="secondary" disabled={Boolean(working)} onClick={() => { setVerification({ requestId: null, maskedEmail: "", code: "" }); setGuardianEmailAgain(""); setPendingGuardianEmail(""); }}>更換 Email／重新寄送</button>
                        </form>
                    ) : pendingGuardianEmail ? (
                        <div className="student-onboarding-confirm" role="group" aria-label="確認家長 Email">
                            <p>驗證碼將寄到 <strong>{pendingGuardianEmail}</strong>，請確認沒有打錯。</p>
                            <div className="student-onboarding-push-actions">
                                <button type="button" onClick={sendGuardianCode} disabled={Boolean(working)}>{working === "guardian-send" ? "寄送中…" : "確認寄出"}</button>
                                <button type="button" className="secondary" onClick={() => setPendingGuardianEmail("")} disabled={Boolean(working)}>修改</button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={reviewGuardianEmail}>
                            <div className="student-onboarding-critical" role="note">
                                <FiAlertTriangle aria-hidden="true" />
                                <p><strong>請務必填寫家長常用、收得到信的 Email。</strong>每週學習進度報告會寄到這裡，之後忘記密碼也要靠這個信箱收驗證碼。填錯將收不到報告，也無法找回密碼。</p>
                            </div>
                            <label><span>家長 Email</span><input type="email" autoComplete="email" value={guardianEmail} onChange={event => setGuardianEmail(event.target.value)} placeholder="parent@example.com" required /></label>
                            <label><span>再輸入一次家長 Email</span><input type="email" autoComplete="off" value={guardianEmailAgain} onChange={event => setGuardianEmailAgain(event.target.value)} placeholder="parent@example.com" required /></label>
                            <small>下一步會先請你確認信箱，再寄送驗證碼。驗證成功前，不會把這個 Email 設為正式聯絡信箱。</small>
                            <button type="submit" disabled={Boolean(working)}>下一步：確認信箱</button>
                        </form>
                    )}
                </article>

                {shouldOfferPush && completedCount === 2 && (
                    <article className={`student-onboarding-card student-onboarding-push ${pushStatus?.active ? "complete" : ""}`}>
                        <header>
                            <div><FiBell /><span>可選設定</span><h2>開啟網頁通知</h2></div>
                            <span className={`student-onboarding-status ${pushStatus?.active ? "complete" : ""}`}>
                                {pushStatus?.active ? <><FiCheck />已開啟</> : "可稍後設定"}
                            </span>
                        </header>
                        <p>開啟後，此裝置可收到新作業與教材期限提醒。這不是必填資料，不開啟也能正常使用網站。</p>
                        <small>{pushStatus?.reason || (pushConfig?.enabled === false
                            ? "推播服務目前未開放；網站內通知仍可正常使用。"
                            : "iPhone／iPad 需先用 Safari 將網站加入主畫面，再從主畫面圖示開啟。")}</small>
                        {!pushStatus?.active && !pushDecisionMade && (
                            <div className="student-onboarding-push-actions">
                                <button
                                    type="button"
                                    onClick={enableNotifications}
                                    disabled={working === "push" || !pushConfig?.enabled || !pushStatus?.supported}
                                >
                                    {working === "push" ? "設定中…" : "開啟此裝置通知"}
                                </button>
                                <button type="button" className="secondary" onClick={skipNotifications} disabled={Boolean(working)}>
                                    稍後再說
                                </button>
                            </div>
                        )}
                        {pushDecisionMade && !pushStatus?.active && <p className="student-onboarding-push-skipped">已略過；之後可在選單的<Link to="/student/notification-settings">「通知設定」</Link>開啟。</p>}
                    </article>
                )}

                {/* 必要資料都完成後，就不再顯示「先登出，稍後再完成」。 */}
                {completedCount < 2 && <button type="button" className="student-onboarding-logout" onClick={logout}>先登出，稍後再完成</button>}
            </section>
        </main>
    );
}

export default StudentOnboarding;
