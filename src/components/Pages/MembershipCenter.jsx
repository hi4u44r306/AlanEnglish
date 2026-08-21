import React, { useCallback, useEffect, useMemo, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { createBillingPortal, createCheckoutSession } from "../../services/billingService";
import { getMembershipProfile, getPublicPlans, redeemActivationCode } from "../../services/membershipService";
import "./css/Platform.scss";

const STATUS_LABELS = { pending_verification: "等待 Email 驗證", trialing: "免費試用中", active: "使用中", past_due: "付款待處理", cancelled: "已取消，期限前可使用", expired: "已到期", suspended: "已停用", complimentary: "贈送使用權" };
const formatDate = value => value ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeZone: "Asia/Taipei" }).format(new Date(value)) : "無期限";

function MembershipCenter() {
    const { firebaseUser, setStudentProfile } = useAuth();
    const [profile, setProfile] = useState(null);
    const [plans, setPlans] = useState([]);
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState("");

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(true);
        try {
            const [profileResult, planResult] = await Promise.all([getMembershipProfile(firebaseUser), getPublicPlans(firebaseUser)]);
            setProfile(profileResult.profile);
            setStudentProfile(profileResult.profile);
            setPlans(planResult.plans || []);
        } catch (error) {
            toast.error(error.message || "會員資料讀取失敗");
        } finally {
            setLoading(false);
        }
    }, [firebaseUser, setStudentProfile]);

    useEffect(() => { load(); }, [load]);
    const membership = profile?.membership;
    const publicPlans = useMemo(() => plans.filter(plan => plan.is_public), [plans]);

    const redeem = async event => {
        event.preventDefault();
        if (!code.trim()) return toast.error("請輸入啟用碼");
        setWorking("redeem");
        try {
            await redeemActivationCode(firebaseUser, code);
            setCode("");
            toast.success("啟用成功，使用期限已更新");
            await load();
        } catch (error) {
            toast.error(error.message || "啟用碼無法使用");
        } finally {
            setWorking("");
        }
    };

    const checkout = async plan => {
        setWorking(`plan-${plan.id}`);
        try {
            const result = await createCheckoutSession(firebaseUser, plan.id);
            window.location.assign(result.url);
        } catch (error) {
            toast.error(error.message || "目前無法前往付款");
            setWorking("");
        }
    };

    const portal = async () => {
        setWorking("portal");
        try {
            const result = await createBillingPortal(firebaseUser);
            window.location.assign(result.url);
        } catch (error) {
            toast.error(error.message || "目前無法開啟訂閱管理");
            setWorking("");
        }
    };

    const resendVerification = async () => {
        setWorking("verification");
        try {
            await sendEmailVerification(firebaseUser, { url: `${window.location.origin}/` });
            toast.success("驗證信已重新寄出，請檢查收件匣與垃圾郵件");
        } catch (error) {
            toast.error(error?.code === "auth/too-many-requests" ? "寄送次數過多，請稍後再試" : error.message || "驗證信寄送失敗");
        } finally {
            setWorking("");
        }
    };

    if (loading) return <div className="platform-loading">會員資料載入中…</div>;

    return (
        <main className="platform-page">
            <header className="platform-hero"><div><span className="platform-eyebrow">MEMBERSHIP</span><h1>會員方案與啟用碼</h1><p>查看試用期限、輸入教材附贈啟用碼，或管理月費訂閱。</p></div></header>
            <section className={`platform-status-card ${membership?.is_active ? "is-active" : "is-expired"}`}>
                <div><span>目前狀態</span><h2>{STATUS_LABELS[membership?.status] || membership?.status || "尚未建立"}</h2><p>{membership?.plan?.name || "尚未選擇方案"}</p></div>
                <div className="platform-status-meta"><div><span>可使用至</span><strong>{formatDate(membership?.effective_access_end)}</strong></div><div><span>剩餘天數</span><strong>{membership?.days_remaining == null ? "不限" : `${membership.days_remaining} 天`}</strong></div></div>
            </section>
            {membership?.requires_email_verification && <section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">EMAIL VERIFICATION</span><h2>先完成 Email 驗證</h2><p>驗證完成後重新登入，7 天免費試用才會開始計時。</p></div><button className="platform-secondary" onClick={resendVerification} disabled={working === "verification"}>{working === "verification" ? "寄送中…" : "重新寄送驗證信"}</button></div></section>}
            <section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">ACTIVATION CODE</span><h2>教材啟用碼</h2></div><p>購買實體教材附贈的聽力權限，可在這裡啟用。</p></div><form className="platform-inline-form" onSubmit={redeem}><input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="AE-XXXX-XXXX-XXXX" autoComplete="off" /><button className="platform-primary" disabled={working === "redeem"}>{working === "redeem" ? "啟用中…" : "啟用權限"}</button></form></section>
            <section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">PLANS</span><h2>月費方案</h2></div>{membership?.stripe_subscription_status && <button className="platform-secondary" onClick={portal} disabled={working === "portal"}>管理目前訂閱</button>}</div>{publicPlans.length === 0 ? <div className="platform-empty"><strong>線上訂閱尚未開放</strong><p>目前可以使用免費試用或教材啟用碼。正式價格完成設定後，月費方案會自動顯示在這裡。</p></div> : <div className="platform-plan-grid">{publicPlans.map(plan => <article className="platform-plan" key={plan.id}><span>{plan.trial_days} 天試用</span><h3>{plan.name}</h3><p>{plan.description}</p><strong>NT$ {Number(plan.price_twd || 0).toLocaleString()}<small>／月</small></strong><ul>{Object.entries(plan.features || {}).filter(([, enabled]) => enabled).map(([feature]) => <li key={feature}>✓ {feature.replaceAll("_", " ")}</li>)}</ul><button className="platform-primary" onClick={() => checkout(plan)} disabled={!plan.checkout_ready || working === `plan-${plan.id}`}>{working === `plan-${plan.id}` ? "前往付款中…" : "選擇方案"}</button></article>)}</div>}</section>
        </main>
    );
}

export default MembershipCenter;
