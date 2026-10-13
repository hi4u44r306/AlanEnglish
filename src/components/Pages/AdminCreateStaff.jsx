import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FiCheck, FiCopy, FiUserPlus } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import { createAcademyStaffAccount } from "../../services/academyStudentService";
import "./css/Attendance.scss";

const CLASS_CODES = ["E1", "E3", "E5", "E7"];
const emptyForm = { role: "teacher", chineseName: "", englishName: "", loginUsername: "", classCodes: [] };

const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" });
};

const AdminCreateStaff = () => {
    const { firebaseUser } = useAuth();
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [created, setCreated] = useState(null);
    const [copied, setCopied] = useState(false);
    const isTeacher = form.role === "teacher";

    const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
    const toggleClass = code => setForm(current => ({
        ...current,
        classCodes: current.classCodes.includes(code)
            ? current.classCodes.filter(item => item !== code)
            : [...current.classCodes, code].sort()
    }));

    const validate = () => {
        const username = form.loginUsername.trim().toLowerCase();
        if (!form.chineseName.trim()) return "請輸入中文姓名";
        if (!/^[A-Za-z][A-Za-z .'-]*$/.test(form.englishName.trim())) return "英文姓名請使用英文字母";
        if (username && !/^[a-z][a-z0-9]{2,31}$/.test(username)) return "登入帳號需為 3～32 個小寫英文字母或數字，且第一個字必須是英文字母";
        if (isTeacher && form.classCodes.length === 0) return "請至少選擇一個教師可以管理的班級";
        return "";
    };

    const submit = async event => {
        event.preventDefault();
        const problem = validate();
        if (problem) return setError(problem);
        if (!isTeacher && !window.confirm(`確定要把「${form.chineseName.trim()}」建立為管理員嗎？管理員可以查看與修改所有帳號、班級和設定。`)) return undefined;
        setSaving(true);
        setError("");
        try {
            const result = await createAcademyStaffAccount(firebaseUser, form);
            setCreated({ ...result, roleLabel: isTeacher ? "教師" : "管理員", name: form.chineseName.trim() });
            setForm(emptyForm);
            setCopied(false);
        } catch (createError) {
            setError(createError.message || "建立帳號失敗");
        } finally {
            setSaving(false);
        }
        return undefined;
    };

    const copyCard = async () => {
        const credentials = created.credentials;
        const text = [
            `Alan English ${created.roleLabel}帳號`,
            `姓名：${created.name}`,
            `登入帳號：${credentials.username}`,
            `啟用連結（設定密碼用）：${credentials.activation_url}`,
            `啟用期限：${formatDate(credentials.activation_expires_at)}`,
            `復原碼 1：${credentials.recovery_codes?.[0]}`,
            `復原碼 2：${credentials.recovery_codes?.[1]}`
        ].join("\n");
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
        } catch {
            setError("無法自動複製，請手動選取下方文字複製。");
        }
    };

    return (
        <main className="attendance-page">
            <header className="attendance-hero">
                <div>
                    <span>STAFF ACCOUNT</span>
                    <h1>新增教師／管理員</h1>
                    <p>建立後會得到一個啟用連結，把它交給本人設定密碼就能登入。</p>
                </div>
                <Link className="attendance-ghost" to="/admin/accounts">回到帳號管理</Link>
            </header>

            {error && <p className="attendance-message error" role="alert">{error}</p>}

            {created && <section className="attendance-card staff-create-result" aria-label="新帳號的登入資料">
                <div className="attendance-card-heading">
                    <h2>已建立{created.roleLabel}：{created.name}</h2>
                    <button type="button" className="attendance-secondary" onClick={copyCard}>{copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}{copied ? "已複製" : "複製全部"}</button>
                </div>
                <p className="attendance-message error">這些資料只會顯示這一次，離開或重新整理後就看不到了，請先複製並交給本人。</p>
                <dl>
                    <div><dt>登入帳號</dt><dd>{created.credentials.username}</dd></div>
                    <div><dt>啟用連結</dt><dd>{created.credentials.activation_url}</dd></div>
                    <div><dt>啟用期限</dt><dd>{formatDate(created.credentials.activation_expires_at)}</dd></div>
                    <div><dt>復原碼</dt><dd>{created.credentials.recovery_codes?.join("、")}</dd></div>
                    {created.account?.class_codes?.length > 0 && <div><dt>可管理班級</dt><dd>{created.account.class_codes.join("、")}</dd></div>}
                </dl>
                <p className="attendance-hint">本人打開啟用連結、設定密碼後，就能用登入帳號登入。復原碼是忘記密碼時用的，請一併交給本人保管。</p>
            </section>}

            <form className="attendance-card staff-create-form" onSubmit={submit}>
                <div className="attendance-card-heading"><h2>帳號資料</h2></div>

                <div className="attendance-tabs staff-create-roles" role="group" aria-label="帳號角色">
                    <button type="button" aria-pressed={isTeacher} onClick={() => update("role", "teacher")}>教師</button>
                    <button type="button" aria-pressed={!isTeacher} onClick={() => update("role", "admin")}>管理員</button>
                </div>
                <p className="attendance-hint">{isTeacher
                    ? "教師可以點名、發作業、查看報表，但只限於下面勾選的班級。"
                    : "管理員可以查看與修改所有帳號、班級、教材和設定，請只給完全信任的人。"}</p>

                <div className="staff-create-fields">
                    <label>中文姓名<input type="text" maxLength={100} autoComplete="off" value={form.chineseName} onChange={event => update("chineseName", event.target.value)} /></label>
                    <label>英文姓名<input type="text" maxLength={100} autoComplete="off" placeholder="例如：Leo" value={form.englishName} onChange={event => update("englishName", event.target.value)} /></label>
                    <label>登入帳號（可不填，由系統產生）<input type="text" maxLength={32} autoComplete="off" autoCapitalize="none" placeholder="例如：leo" value={form.loginUsername} onChange={event => update("loginUsername", event.target.value)} /></label>
                </div>

                {isTeacher && <fieldset className="staff-create-classes">
                    <legend>可以管理的班級</legend>
                    <div>
                        {CLASS_CODES.map(code => <button type="button" key={code} className="attendance-status present" aria-pressed={form.classCodes.includes(code)} onClick={() => toggleClass(code)}>{code}</button>)}
                        <button type="button" className="attendance-ghost" onClick={() => update("classCodes", CLASS_CODES)}>全部</button>
                    </div>
                </fieldset>}

                <button type="submit" className="attendance-primary" disabled={saving}><FiUserPlus aria-hidden="true" />{saving ? "建立中…" : `建立${isTeacher ? "教師" : "管理員"}帳號`}</button>
            </form>
        </main>
    );
};

export default AdminCreateStaff;
