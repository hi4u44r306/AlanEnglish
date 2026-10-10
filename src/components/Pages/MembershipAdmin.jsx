import useUnsavedChanges from "../../hooks/useUnsavedChanges";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getGuardianEmailStatus, sendGuardianReportBatch } from "../../services/guardianEmailService";
import { generateActivationCodes, getMembershipAdminDashboard, grantMembershipAccess, setMembershipStatus, updateGuardianEmailSettings, updateSubscriptionPlan } from "../../services/membershipService";
import { getPrimaryAccessPlanLabel, isLegacyMembershipPlanCode } from "../../constants/membershipPlans";
import "./css/Platform.scss";
import ManagementWorkspace from "../fragment/ManagementWorkspace";

const planSnapshot = plan => JSON.stringify([plan?.name || "", plan?.description || "", plan?.price_twd ?? null, plan?.trial_days ?? 0, plan?.stripe_price_id || null, Boolean(plan?.is_public)]);
const STATUS_LABELS = { pending_verification: "待驗證", trialing: "試用中", active: "使用中", past_due: "付款逾期", cancelled: "已取消", expired: "已到期", suspended: "已停用", complimentary: "贈送" };
const getAdminMembershipStatus = membership => {
    const status = membership?.status;
    if (["pending_verification", "trialing", "past_due", "suspended"].includes(status)) {
        return status;
    }
    if (membership?.is_active === true) {
        return status === "cancelled" ? "cancelled" : "active";
    }
    return status || "expired";
};

function MembershipAdmin() {
    const { firebaseUser } = useAuth();
    const [data, setData] = useState(null);
    const [emailStatus, setEmailStatus] = useState(null);
    const [planDrafts, setPlanDrafts] = useState({});
    const [codeForm, setCodeForm] = useState({ quantity: 1, duration_days: 90, max_redemptions: 1, plan_id: "", book_id: "", expires_at: "", note: "" });
    const [generatedCodes, setGeneratedCodes] = useState([]);
    const [grantForm, setGrantForm] = useState({ student_id: "", plan_id: "", duration_days: 30, source: "material_purchase" });
    const [emailForm, setEmailForm] = useState({ enabled: false, send_weekday: 1, send_hour: 9, from_name: "Alan English", from_email: "", reply_to: "" });
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [emailStatusError, setEmailStatusError] = useState("");
    const [working, setWorking] = useState("");
    const planBaseline = useRef({}), emailBaseline = useRef(null), codeBaseline = useRef(codeForm), grantBaseline = useRef(grantForm), hasLoaded = useRef(false);
    const dirty = Object.entries(planDrafts).some(([id, draft]) => planBaseline.current[id] && planSnapshot(draft) !== planSnapshot(planBaseline.current[id]))
        || Boolean(emailBaseline.current && JSON.stringify(emailForm) !== JSON.stringify(emailBaseline.current))
        || JSON.stringify(codeForm) !== JSON.stringify(codeBaseline.current) || JSON.stringify(grantForm) !== JSON.stringify(grantBaseline.current);
    useUnsavedChanges(dirty, { enabled: Boolean(firebaseUser?.uid && data) });

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(!hasLoaded.current);
        setLoadError("");
        setEmailStatusError("");
        try {
            const dashboard = await getMembershipAdminDashboard(firebaseUser);
            const currentPlans = (dashboard.plans || []).filter(plan => !isLegacyMembershipPlanCode(plan.code));
            const currentMembers = (dashboard.members || []).map(member => ({
                ...member,
                membership: member.membership ? {
                    ...member.membership,
                    status: getAdminMembershipStatus(member.membership),
                    plan: {
                        ...(member.membership.plan || {}),
                        name: getPrimaryAccessPlanLabel(member.membership) || "尚未啟用方案"
                    }
                } : member.membership
            }));
            setData({ ...dashboard, plans: currentPlans, members: currentMembers });
            const previousPlans = planBaseline.current;
            setPlanDrafts(current => Object.fromEntries(currentPlans.map(plan => [plan.id,
                current[plan.id] && previousPlans[plan.id] && planSnapshot(current[plan.id]) !== planSnapshot(previousPlans[plan.id]) ? current[plan.id] : { ...plan }
            ])));
            planBaseline.current = Object.fromEntries(currentPlans.map(plan => [plan.id, { ...plan }]));
            hasLoaded.current = true;
            const settings = dashboard.email_settings || {};
            const nextEmail = { enabled: Boolean(settings.enabled), send_weekday: Number(settings.send_weekday ?? 1), send_hour: Number(settings.send_hour ?? 9), from_name: settings.from_name || "Alan English", from_email: settings.from_email || "", reply_to: settings.reply_to || "" };
            const previousEmail = emailBaseline.current;
            setEmailForm(current => previousEmail && JSON.stringify(current) !== JSON.stringify(previousEmail) ? current : nextEmail);
            emailBaseline.current = nextEmail;
            try {
                setEmailStatus(await getGuardianEmailStatus(firebaseUser));
            } catch (error) {
                setEmailStatus(null);
                setEmailStatusError(error.message || "家長週報狀態讀取失敗");
            }
        } catch (error) {
            if ([401, 403].includes(Number(error?.status))) {
                setData(null); setPlanDrafts({}); setGeneratedCodes([]); setEmailStatus(null);
                setEmailForm({ enabled: false, send_weekday: 1, send_hour: 9, from_name: "Alan English", from_email: "", reply_to: "" });
                planBaseline.current = {}; emailBaseline.current = null; hasLoaded.current = false;
            }
            setLoadError(error.message || "會員管理資料讀取失敗");
            toast.error(error.message || "會員管理資料讀取失敗");
        }
        finally { setLoading(false); }
    }, [firebaseUser]);

    useEffect(() => { load(); }, [load]);
    const students = useMemo(() => (data?.members || []).filter(member => member.role === "student"), [data]);

    const savePlan = async planId => {
        const submitted = { ...planDrafts[planId] };
        setWorking(`plan-${planId}`);
        try { await updateSubscriptionPlan(firebaseUser, submitted); planBaseline.current = { ...planBaseline.current, [planId]: submitted }; toast.success("方案已更新"); await load(); }
        catch (error) { toast.error(error.message || "方案更新失敗"); }
        finally { setWorking(""); }
    };

    const makeCodes = async event => {
        event.preventDefault(); const submitted = { ...codeForm }; setWorking("codes");
        try { const result = await generateActivationCodes(firebaseUser, { ...codeForm, plan_id: codeForm.plan_id || null, book_id: codeForm.book_id || null, expires_at: codeForm.expires_at || null }); setGeneratedCodes(result.codes || []); codeBaseline.current = submitted; toast.success(`已產生 ${result.codes?.length || 0} 組啟用碼`); await load(); }
        catch (error) { toast.error(error.message || "啟用碼產生失敗"); }
        finally { setWorking(""); }
    };

    const grant = async event => {
        event.preventDefault(); const submitted = { ...grantForm }; setWorking("grant");
        try { await grantMembershipAccess(firebaseUser, { ...grantForm, student_id: Number(grantForm.student_id), plan_id: grantForm.plan_id ? Number(grantForm.plan_id) : null, duration_days: Number(grantForm.duration_days) }); grantBaseline.current = submitted; toast.success("會員期限已延長"); await load(); }
        catch (error) { toast.error(error.message || "延長權限失敗"); }
        finally { setWorking(""); }
    };

    const suspend = async (studentId, nextStatus) => {
        if (!window.confirm(nextStatus === "suspended" ? "確定停用這個會員嗎？" : "確定將這個會員標記為到期嗎？")) return;
        setWorking(`member-${studentId}`);
        try { await setMembershipStatus(firebaseUser, { student_id: studentId, status: nextStatus }); toast.success("會員狀態已更新"); await load(); }
        catch (error) { toast.error(error.message || "會員狀態更新失敗"); }
        finally { setWorking(""); }
    };

    const saveEmail = async event => {
        event.preventDefault(); const submitted = { ...emailForm }; setWorking("email");
        try { await updateGuardianEmailSettings(firebaseUser, submitted); emailBaseline.current = submitted; toast.success("家長週報設定已更新"); await load(); }
        catch (error) { toast.error(error.message || "寄信設定更新失敗"); }
        finally { setWorking(""); }
    };

    const sendBatch = async () => {
        if (!window.confirm("確定現在寄送本週家長報告給所有已啟用的家長嗎？")) return;
        setWorking("send-batch");
        try { const result = await sendGuardianReportBatch(firebaseUser); toast.success(`批次完成：成功 ${result.totals?.sent || 0}、略過 ${result.totals?.skipped || 0}、失敗 ${result.totals?.failed || 0}`); await load(); }
        catch (error) { toast.error(error.message || "批次寄信失敗"); }
        finally { setWorking(""); }
    };

    if (loading) return <div className="platform-loading">會員管理資料載入中…</div>;
    if (!data && loadError) return <main className="platform-page"><section className="platform-alert" role="alert"><h1>會員資料暫時無法讀取</h1><p>請確認網路或目前登入帳號的使用權限，再試一次。</p><button type="button" className="platform-secondary" onClick={() => load()}>重新讀取</button></section></main>;
    return <main className="platform-page membership-admin"><header className="platform-hero"><div><span className="platform-eyebrow">MEMBERSHIP ADMIN</span><h1>會員、方案與啟用碼</h1><p>集中管理免費試用、教材附贈權限、訂閱方案與家長週報。</p></div><div className="platform-summary-pills"><span>總帳號 {data?.summary?.total || 0}</span><span>可使用 {data?.summary?.active_total || 0}</span></div></header>{loadError && <section className="platform-alert" role="alert"><strong>{data ? "目前顯示上次會員資料，最新資料暫時無法同步。" : "會員資料載入失敗"}</strong><p>請確認網路或登入權限後再試一次。</p><button type="button" className="platform-secondary" onClick={() => load()} disabled={Boolean(working)}>重新讀取</button></section>}{dirty && <p className="platform-help" role="status">有未儲存的修改，切換工作區仍會保留。</p>}<ManagementWorkspace label="會員管理工作區" disabled={Boolean(working)} tabs={[{ id: "members", label: "會員狀態" }, { id: "plans", label: "方案與價格" }, { id: "access", label: "啟用碼與授權" }, { id: "reports", label: "家長週報" }]}><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">MEMBERS</span><h2>會員狀態</h2></div></div><div className="platform-table-wrap"><table className="platform-table"><thead><tr><th>學生</th><th>班級</th><th>方案</th><th>狀態</th><th>剩餘</th><th>操作</th></tr></thead><tbody>{students.map(student => <tr key={student.id}><td data-label="學生">{student.name}<small>{student.email}</small></td><td data-label="班級">{student.class || "-"}</td><td data-label="方案">{student.membership?.plan?.name || "-"}</td><td data-label="狀態">{STATUS_LABELS[student.membership?.status] || student.membership?.status}</td><td data-label="剩餘">{student.membership?.days_remaining == null ? "不限" : `${student.membership.days_remaining} 天`}</td><td data-label="操作"><button className="platform-link-button danger" onClick={() => suspend(student.id, "suspended")} disabled={working === `member-${student.id}`}>停用</button><button className="platform-link-button" onClick={() => suspend(student.id, "expired")} disabled={working === `member-${student.id}`}>標記到期</button></td></tr>)}</tbody></table></div></section>
<section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">PLANS</span><h2>方案與價格</h2></div></div><div className="platform-admin-grid">{(data?.plans || []).map(plan => { const draft = planDrafts[plan.id] || plan; return <article className="platform-admin-card" key={plan.id}><h3>{plan.code}</h3><label><span>顯示名稱</span><input value={draft.name || ""} onChange={event => setPlanDrafts(current => ({ ...current, [plan.id]: { ...draft, name: event.target.value } }))} /></label><label><span>說明</span><textarea value={draft.description || ""} onChange={event => setPlanDrafts(current => ({ ...current, [plan.id]: { ...draft, description: event.target.value } }))} /></label><div className="platform-form-grid"><label><span>月費 TWD</span><input type="number" value={draft.price_twd ?? ""} onChange={event => setPlanDrafts(current => ({ ...current, [plan.id]: { ...draft, price_twd: event.target.value === "" ? null : Number(event.target.value) } }))} /></label><label><span>試用天數</span><input type="number" min="0" max="90" value={draft.trial_days} onChange={event => setPlanDrafts(current => ({ ...current, [plan.id]: { ...draft, trial_days: Number(event.target.value) } }))} /></label></div><label><span>Stripe Price ID</span><input value={draft.stripe_price_id || ""} placeholder="price_…" onChange={event => setPlanDrafts(current => ({ ...current, [plan.id]: { ...draft, stripe_price_id: event.target.value || null } }))} /></label><label className="platform-check"><input type="checkbox" checked={Boolean(draft.is_public)} onChange={event => setPlanDrafts(current => ({ ...current, [plan.id]: { ...draft, is_public: event.target.checked } }))} /><span>公開此方案</span></label><button className="platform-primary" onClick={() => savePlan(plan.id)} disabled={working === `plan-${plan.id}`}>儲存方案</button></article>; })}</div></section>
<div className="platform-two-column"><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">CODES</span><h2>產生教材啟用碼</h2></div></div><form className="platform-form" onSubmit={makeCodes}><div className="platform-form-grid"><label><span>組數</span><input type="number" min="1" max="100" value={codeForm.quantity} onChange={event => setCodeForm(current => ({ ...current, quantity: Number(event.target.value) }))} /></label><label><span>使用天數</span><input type="number" min="1" max="3660" value={codeForm.duration_days} onChange={event => setCodeForm(current => ({ ...current, duration_days: Number(event.target.value) }))} /></label></div><label><span>套用方案</span><select value={codeForm.plan_id} onChange={event => setCodeForm(current => ({ ...current, plan_id: event.target.value }))}><option value="">保留目前方案</option>{(data?.plans || []).map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label><span>綁定教材擁有權（選填）</span><select value={codeForm.book_id} onChange={event => setCodeForm(current => ({ ...current, book_id: event.target.value }))}><option value="">不綁定教材</option>{(data?.books || []).map(book => <option key={book.id} value={book.id}>{book.name} · {book.code}</option>)}</select></label><label><span>備註</span><input value={codeForm.note} onChange={event => setCodeForm(current => ({ ...current, note: event.target.value }))} /></label><button className="platform-primary" disabled={working === "codes"}>產生啟用碼</button></form>{generatedCodes.length > 0 && <div className="platform-code-result"><strong>完整代碼只顯示這一次，請立即保存：</strong>{generatedCodes.map(item => <code key={item.id}>{item.code}</code>)}</div>}</section><section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">GRANT ACCESS</span><h2>直接贈送權限</h2></div></div><form className="platform-form" onSubmit={grant}><label><span>學生</span><select required value={grantForm.student_id} onChange={event => setGrantForm(current => ({ ...current, student_id: event.target.value }))}><option value="">選擇學生</option>{students.map(student => <option key={student.id} value={student.id}>{student.name} · {student.email}</option>)}</select></label><label><span>方案</span><select value={grantForm.plan_id} onChange={event => setGrantForm(current => ({ ...current, plan_id: event.target.value }))}><option value="">維持目前方案</option>{(data?.plans || []).map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><div className="platform-form-grid"><label><span>延長天數</span><input type="number" min="1" max="3660" value={grantForm.duration_days} onChange={event => setGrantForm(current => ({ ...current, duration_days: Number(event.target.value) }))} /></label><label><span>來源</span><select value={grantForm.source} onChange={event => setGrantForm(current => ({ ...current, source: event.target.value }))}><option value="material_purchase">購買教材</option><option value="admin_grant">管理員贈送</option></select></label></div><button className="platform-primary" disabled={working === "grant"}>延長會員權限</button></form></section></div>
<section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">GUARDIAN EMAIL</span><h2>家長週報自動寄送</h2></div><span className={`platform-provider ${emailStatus?.provider_configured ? "ready" : "pending"}`}>{emailStatus?.provider_configured ? "寄信服務已設定" : "尚缺 RESEND_API_KEY／寄件 Email"}</span></div>{emailStatusError && <div className="platform-alert" role="alert"><strong>週報狀態載入失敗</strong><p>{emailStatusError}</p></div>}<form className="platform-form-grid platform-compact-form" onSubmit={saveEmail}><label className="platform-check"><input type="checkbox" checked={emailForm.enabled} onChange={event => setEmailForm(current => ({ ...current, enabled: event.target.checked }))} /><span>啟用自動寄送</span></label><label><span>星期（0 日～6 六）</span><input type="number" min="0" max="6" value={emailForm.send_weekday} onChange={event => setEmailForm(current => ({ ...current, send_weekday: Number(event.target.value) }))} /></label><label><span>台北時間</span><input type="number" min="0" max="23" value={emailForm.send_hour} onChange={event => setEmailForm(current => ({ ...current, send_hour: Number(event.target.value) }))} /></label><label><span>寄件人</span><input value={emailForm.from_name} onChange={event => setEmailForm(current => ({ ...current, from_name: event.target.value }))} /></label><label><span>寄件 Email</span><input type="email" value={emailForm.from_email} onChange={event => setEmailForm(current => ({ ...current, from_email: event.target.value }))} /></label><label><span>回覆 Email</span><input type="email" value={emailForm.reply_to} onChange={event => setEmailForm(current => ({ ...current, reply_to: event.target.value }))} /></label><button className="platform-primary" disabled={working === "email"}>儲存寄信設定</button><button type="button" className="platform-secondary" onClick={sendBatch} disabled={!emailStatus?.provider_configured || working === "send-batch"}>立即批次寄送</button></form></section></ManagementWorkspace></main>;
}

export default MembershipAdmin;
