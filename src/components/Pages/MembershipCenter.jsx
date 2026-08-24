import React, { useCallback, useEffect, useMemo, useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { FiCheck, FiCreditCard, FiStar, FiZap } from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { createBillingPortal, createCheckoutSession } from "../../services/billingService";
import { getMembershipProfile, getPublicPlans, redeemActivationCode } from "../../services/membershipService";
import "./css/Platform.scss";

const STATUS_LABELS = { pending_verification: "等待 Email 驗證", trialing: "免費試用中", active: "使用中", past_due: "付款待處理", cancelled: "已取消，期限前可使用", expired: "已到期", suspended: "已停用", complimentary: "贈送使用權" };
const FEATURE_LABELS = {
    listening: "分級教材與聽力",
    ai_materials: "AI 教材生成",
    conversation: "英文情境對話",
    assignments: "英文班作業",
    review: "智慧複習"
};
const formatDate = value => value ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeZone: "Asia/Taipei" }).format(new Date(value)) : "無期限";
const formatRenewalDay = value => {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return new Intl.DateTimeFormat("zh-TW", { day: "numeric", timeZone: "Asia/Taipei" })
        .formatToParts(date)
        .find(part => part.type === "day")?.value || null;
};

function MembershipCenter() {
    const { firebaseUser, setStudentProfile } = useAuth();
    const [profile, setProfile] = useState(null);
    const [plans, setPlans] = useState([]);
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState("");
    const [verificationCooldown, setVerificationCooldown] = useState(0);

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
    useEffect(() => {
        if (verificationCooldown <= 0) return undefined;
        const timer = window.setInterval(() => setVerificationCooldown(current => Math.max(0, current - 1)), 1000);
        return () => window.clearInterval(timer);
    }, [verificationCooldown]);
    const membership = profile?.membership;
    const publicPlans = useMemo(() => plans.filter(plan => plan.is_public), [plans]);
    const activePlanCodes = useMemo(() => new Set(membership?.effective_access?.plan_codes || []), [membership]);
    const academyGrant = useMemo(() => (
        membership?.effective_access?.grants?.find(grant => grant?.plan_code === "academy_internal") || null
    ), [membership]);
    const isActiveAcademyStudent = membership?.is_active === true
        && membership?.effective_access?.learner_type === "academy_student"
        && activePlanCodes.has("academy_internal");
    const membershipStatusLabel = isActiveAcademyStudent
        ? "英文班在校生"
        : STATUS_LABELS[membership?.status] || membership?.status || "尚未建立";
    const membershipPlanLabel = isActiveAcademyStudent
        ? academyGrant?.plan_name || "英文班在學方案"
        : membership?.plan?.name || "尚未選擇方案";
    const hasAiAddon = activePlanCodes.has("ai_materials_addon_monthly");
    const aiAddonGrant = useMemo(() => (
        membership?.effective_access?.grants?.find(grant => grant?.plan_code === "ai_materials_addon_monthly") || null
    ), [membership]);
    const aiAddonSubscription = membership?.ai_addon_subscription;
    const aiRenewalAt = aiAddonSubscription?.current_period_end || (
        aiAddonGrant?.source === "stripe" ? aiAddonGrant?.ends_at : null
    );
    const aiRenewalDay = formatRenewalDay(aiRenewalAt);
    const aiAddonCancelling = aiAddonSubscription?.cancel_at_period_end === true;

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
            firebaseUser.auth.languageCode = "zh-TW";
            await sendEmailVerification(firebaseUser, { url: `${window.location.origin}/student/membership` });
            setVerificationCooldown(60);
            toast.success("驗證信已重新寄出，請檢查收件匣與垃圾郵件");
        } catch (error) {
            toast.error(error?.code === "auth/too-many-requests" ? "寄送次數過多，請稍後再試" : error.message || "驗證信寄送失敗");
        } finally {
            setWorking("");
        }
    };

    const confirmVerification = async () => {
        setWorking("confirm-verification");
        try {
            await firebaseUser.reload();
            await firebaseUser.getIdToken(true);
            if (!firebaseUser.emailVerified) {
                toast.error("目前仍未完成驗證，請先點擊 Email 中的驗證連結");
                return;
            }
            await load();
            toast.success("Email 驗證完成，7 天免費試用已開始");
        } catch (error) {
            toast.error(error.message || "目前無法確認驗證狀態");
        } finally {
            setWorking("");
        }
    };

    if (loading) return <div className="platform-loading">會員資料載入中…</div>;

    return (
        <main className="platform-page">
            <header className="platform-hero"><div><span className="platform-eyebrow">MEMBERSHIP</span><h1>會員方案與啟用碼</h1><p>查看試用期限、輸入教材附贈啟用碼，或管理月費訂閱。</p></div></header>
            <section className={`platform-status-card ${membership?.is_active ? "is-active" : "is-expired"}`}>
                <div><span>目前狀態</span><h2>{membershipStatusLabel}</h2><p>{membershipPlanLabel}</p></div>
                <div className="platform-status-meta">
                    <div>
                        <span>{isActiveAcademyStudent ? "使用期間" : "可使用至"}</span>
                        <strong>{isActiveAcademyStudent ? "在校期間有效" : formatDate(membership?.effective_access_end)}</strong>
                    </div>
                    <div>
                        <span>{isActiveAcademyStudent ? "在學權限" : "剩餘天數"}</span>
                        <strong>{isActiveAcademyStudent ? "已啟用" : membership?.days_remaining == null ? "不限" : `${membership.days_remaining} 天`}</strong>
                    </div>
                </div>
            </section>
            {membership?.requires_email_verification && <section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">EMAIL VERIFICATION</span><h2>先完成 Email 驗證</h2><p>驗證信會寄到 {firebaseUser?.email}。完成驗證後，7 天免費試用才會開始計時。</p></div><div className="platform-verification-actions"><button className="platform-secondary" onClick={resendVerification} disabled={working === "verification" || verificationCooldown > 0}>{working === "verification" ? "寄送中…" : verificationCooldown > 0 ? `${verificationCooldown} 秒後可重寄` : "重新寄送驗證信"}</button><button className="platform-primary" onClick={confirmVerification} disabled={working === "confirm-verification"}>{working === "confirm-verification" ? "確認中…" : "我已完成驗證"}</button></div></div><p className="platform-footnote">仍未收到時，請搜尋寄件者包含 noreply 的郵件，並檢查垃圾郵件或促銷內容。</p></section>}
            <section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">ACTIVATION CODE</span><h2>教材啟用碼</h2></div><p>購買實體教材附贈的聽力權限，可在這裡啟用。</p></div><form className="platform-inline-form" onSubmit={redeem}><input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="AE-XXXX-XXXX-XXXX" autoComplete="off" /><button className="platform-primary" disabled={working === "redeem"}>{working === "redeem" ? "啟用中…" : "啟用權限"}</button></form></section>
            {hasAiAddon && (
                <section className="platform-ai-premium" role="status" aria-label="AI Premium 已啟用">
                    <div className="platform-ai-premium-copy">
                        <span className="platform-ai-premium-badge"><FiStar aria-hidden="true" /> AI PREMIUM</span>
                        <h2><span className="platform-ai-premium-icon"><FiZap aria-hidden="true" /></span>你的 AI 學習力已升級</h2>
                        <p>AI 教材加購已啟用，現在可以生成更貼近自己的專屬練習。</p>
                        <div className="platform-ai-premium-benefits">
                            <span><FiCheck aria-hidden="true" />每日最多 5 次</span>
                            <span><FiCheck aria-hidden="true" />每月最多 150 次</span>
                        </div>
                    </div>
                    <div className="platform-ai-premium-renewal">
                        <span>{aiAddonCancelling ? "方案使用至" : aiRenewalDay ? "自動續訂" : "目前狀態"}</span>
                        <strong>{aiAddonCancelling ? formatDate(aiRenewalAt) : aiRenewalDay ? `每月 ${aiRenewalDay} 日` : "AI 教材已啟用"}</strong>
                        <small>{aiAddonCancelling ? "到期後不會再次扣款" : aiRenewalAt ? `下次預計 ${formatDate(aiRenewalAt)} 續訂` : "可立即使用專屬教材生成"}</small>
                        <Link className="platform-ai-premium-action" to="/student/ai-generator"><FiZap aria-hidden="true" />開始使用 AI 教材</Link>
                    </div>
                </section>
            )}
            <section className="platform-card">
                <div className="platform-section-title"><div><span className="platform-eyebrow">PLANS</span><h2>月費方案</h2></div>{(membership?.has_stripe_customer || membership?.stripe_subscription_status) && <button className="platform-secondary" type="button" onClick={portal} disabled={working === "portal"} aria-busy={working === "portal"}>{working === "portal" && <span className="platform-button-spinner is-dark" aria-hidden="true" />} {working === "portal" ? "正在開啟訂閱管理…" : "管理目前訂閱"}</button>}</div>
                {publicPlans.length === 0
                    ? <div className="platform-empty"><strong>線上訂閱尚未開放</strong><p>目前可以使用免費試用或教材啟用碼。正式價格完成設定後，月費方案會自動顯示在這裡。</p></div>
                    : <div className="platform-plan-grid">{publicPlans.map(plan => {
                        const planActive = activePlanCodes.has(plan.code);
                        const booleanFeatures = Object.entries(plan.features || {}).filter(([, enabled]) => enabled === true);
                        const planWorking = working === `plan-${plan.id}`;
                        return <article className={`platform-plan ${planActive ? "is-active" : ""} ${plan.code === "ai_materials_addon_monthly" ? "is-ai-addon" : ""}`} key={plan.id}>
                            <span>{plan.access_model === "addon" ? "英文班學生加購" : plan.trial_days > 0 ? `${plan.trial_days} 天試用` : "月費訂閱"}</span>
                            <h3>{plan.name}</h3>
                            <p>{plan.description}</p>
                            <strong>NT$ {Number(plan.price_twd || 0).toLocaleString()}<small>／月</small></strong>
                            <ul>{booleanFeatures.map(([feature]) => <li key={feature}>✓ {FEATURE_LABELS[feature] || feature.replaceAll("_", " ")}</li>)}{Number(plan.features?.ai_monthly_limit) > 0 && <li>✓ 每月最多 {Number(plan.features.ai_monthly_limit)} 次</li>}</ul>
                            <button className="platform-primary" type="button" onClick={() => checkout(plan)} disabled={planActive || !plan.checkout_ready || Boolean(working)} aria-busy={planWorking}>
                                {planActive ? <><FiZap aria-hidden="true" />AI Premium 使用中</> : planWorking ? <><span className="platform-button-spinner" aria-hidden="true" />正在開啟安全付款…</> : plan.checkout_ready ? <><FiCreditCard aria-hidden="true" />選擇方案</> : "付款設定中"}
                            </button>
                        </article>;
                    })}</div>}
            </section>
        </main>
    );
}

export default MembershipCenter;
