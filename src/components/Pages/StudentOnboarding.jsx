import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { FiCheck, FiLock, FiMail, FiShield } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import {
    confirmGuardianEmailVerification,
    requestGuardianEmailVerification,
    updateStudentProfile
} from "../../services/membershipService";
import { markAcademyPasswordChanged } from "../../services/academyStudentService";
import BirthdaySelect from "../fragment/BirthdaySelect";
import "./css/StudentOnboarding.scss";

const passwordError = error => {
    if (["auth/invalid-credential", "auth/wrong-password"].includes(error?.code)) {
        return "目前密碼不正確，請使用登入卡上的一次性臨時密碼。";
    }
    if (error?.code === "auth/too-many-requests") return "嘗試次數過多，請稍後再試。";
    if (error?.code === "auth/requires-recent-login") return "登入狀態已過期，請登出後重新登入。";
    return error?.message || "目前無法更新密碼，請稍後再試。";
};

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
    const [birthday, setBirthday] = useState(studentProfile?.date_of_birth || "");
    const [guardianEmail, setGuardianEmail] = useState(studentProfile?.guardian?.email || "");
    const [verification, setVerification] = useState({ requestId: null, maskedEmail: "", code: "" });
    const [working, setWorking] = useState("");
    const [message, setMessage] = useState({ type: "", text: "" });

    const completedCount = [
        steps.password_complete,
        steps.birthday_complete,
        steps.guardian_email_complete
    ].filter(Boolean).length;

    useEffect(() => {
        setBirthday(studentProfile?.date_of_birth || "");
        setGuardianEmail(studentProfile?.guardian?.email || "");
    }, [studentProfile?.date_of_birth, studentProfile?.guardian?.email]);

    useEffect(() => {
        if (studentProfile?.onboarding?.required !== false || completedCount < 3) return;
        const requested = location.state?.from;
        const destination = requested?.pathname?.startsWith("/student/")
            ? `${requested.pathname}${requested.search || ""}`
            : "/student/leaderboard";
        navigate(destination, { replace: true });
    }, [completedCount, location.state, navigate, studentProfile?.onboarding?.required]);

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
        if (passwordForm.current === passwordForm.next) {
            return setMessage({ type: "error", text: "新密碼不可與一次性臨時密碼相同。" });
        }

        setWorking("password");
        try {
            await reauthenticateWithCredential(
                firebaseUser,
                EmailAuthProvider.credential(firebaseUser.email, passwordForm.current)
            );
            await updatePassword(firebaseUser, passwordForm.next);
            await firebaseUser.getIdToken(true);
            await markAcademyPasswordChanged(firebaseUser);
            await refreshStudentProfile();
            setPasswordForm({ current: "", next: "", confirm: "" });
            setMessage({ type: "success", text: "新密碼已設定。請繼續完成下面的資料。" });
        } catch (error) {
            setMessage({ type: "error", text: passwordError(error) });
        } finally {
            setWorking("");
        }
    };

    const saveBirthday = async event => {
        event.preventDefault();
        setMessage({ type: "", text: "" });
        if (!birthday) return setMessage({ type: "error", text: "請選擇正確的出生年月日。" });
        setWorking("birthday");
        try {
            await updateStudentProfile(firebaseUser, { date_of_birth: birthday });
            await refreshStudentProfile();
            setMessage({ type: "success", text: "生日已保存。設定後不可自行修改。" });
        } catch (error) {
            setMessage({ type: "error", text: error?.message || "目前無法保存生日。" });
        } finally {
            setWorking("");
        }
    };

    const sendGuardianCode = async event => {
        event.preventDefault();
        setMessage({ type: "", text: "" });
        setWorking("guardian-send");
        try {
            const result = await requestGuardianEmailVerification(firebaseUser, guardianEmail);
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
                    <p>完成三個步驟後，就可以開始使用 Alan English。</p>
                    <div className="student-onboarding-progress" aria-label={`已完成 ${completedCount} 個步驟，共 3 個`}>
                        <div style={{ width: `${(completedCount / 3) * 100}%` }} />
                    </div>
                    <strong>{completedCount}／3 已完成</strong>
                </header>

                {message.text && (
                    <div className={`student-onboarding-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>
                        {message.text}
                    </div>
                )}

                <article className={`student-onboarding-card ${steps.password_complete ? "complete" : ""}`}>
                    <header><div><FiLock /><span>步驟 1</span><h2>設定自己的密碼</h2></div><StepStatus complete={steps.password_complete} /></header>
                    {steps.password_complete ? (
                        <p>密碼已更換完成。之後請使用新密碼登入。</p>
                    ) : (
                        <form onSubmit={changePassword}>
                            <label><span>目前的一次性臨時密碼</span><input type="password" autoComplete="current-password" value={passwordForm.current} onChange={event => setPasswordForm(current => ({ ...current, current: event.target.value }))} required /></label>
                            <div className="student-onboarding-form-grid">
                                <label><span>新密碼</span><input type="password" autoComplete="new-password" minLength={6} value={passwordForm.next} onChange={event => setPasswordForm(current => ({ ...current, next: event.target.value }))} required /></label>
                                <label><span>再輸入一次</span><input type="password" autoComplete="new-password" minLength={6} value={passwordForm.confirm} onChange={event => setPasswordForm(current => ({ ...current, confirm: event.target.value }))} required /></label>
                            </div>
                            <small>至少 6 個字元，不要使用姓名或生日。</small>
                            <button type="submit" disabled={Boolean(working)}>{working === "password" ? "更新中…" : "設定新密碼"}</button>
                        </form>
                    )}
                </article>

                <article className={`student-onboarding-card ${steps.birthday_complete ? "complete" : ""}`}>
                    <header><div><FiShield /><span>步驟 2</span><h2>確認出生年月日</h2></div><StepStatus complete={steps.birthday_complete} /></header>
                    {steps.birthday_complete ? (
                        <p>生日已保存為 {studentProfile?.date_of_birth}。為保護獎勵紀錄，學生無法自行修改。</p>
                    ) : (
                        <form onSubmit={saveBirthday}>
                            <BirthdaySelect value={birthday} onChange={setBirthday} disabled={Boolean(working)} required idPrefix="student-onboarding-birthday" />
                            <small>生日會影響生日獎勵。送出前請確認正確，設定後不可自行修改。</small>
                            <button type="submit" disabled={Boolean(working)}>{working === "birthday" ? "保存中…" : "確認並保存生日"}</button>
                        </form>
                    )}
                </article>

                <article className={`student-onboarding-card ${steps.guardian_email_complete ? "complete" : ""}`}>
                    <header><div><FiMail /><span>步驟 3</span><h2>驗證家長 Email</h2></div><StepStatus complete={steps.guardian_email_complete} /></header>
                    {steps.guardian_email_complete ? (
                        <p>家長 Email 已完成驗證：{studentProfile?.guardian?.email}</p>
                    ) : verification.requestId ? (
                        <form onSubmit={verifyGuardianCode}>
                            <p>驗證碼已寄到 {verification.maskedEmail}。</p>
                            <label><span>6 位數驗證碼</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={verification.code} onChange={event => setVerification(current => ({ ...current, code: event.target.value.replace(/\D/g, "") }))} required /></label>
                            <button type="submit" disabled={Boolean(working)}>{working === "guardian-verify" ? "驗證中…" : "確認驗證碼"}</button>
                            <button type="button" className="secondary" disabled={Boolean(working)} onClick={() => setVerification({ requestId: null, maskedEmail: "", code: "" })}>更換 Email／重新寄送</button>
                        </form>
                    ) : (
                        <form onSubmit={sendGuardianCode}>
                            <label><span>家長 Email</span><input type="email" autoComplete="email" value={guardianEmail} onChange={event => setGuardianEmail(event.target.value)} placeholder="parent@example.com" required /></label>
                            <small>我們會寄送驗證碼。驗證成功前，不會把這個 Email 設為正式聯絡信箱。</small>
                            <button type="submit" disabled={Boolean(working)}>{working === "guardian-send" ? "寄送中…" : "寄送驗證碼"}</button>
                        </form>
                    )}
                </article>

                <button type="button" className="student-onboarding-logout" onClick={logout}>先登出，稍後再完成</button>
            </section>
        </main>
    );
}

export default StudentOnboarding;
