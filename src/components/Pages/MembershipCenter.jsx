import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiBookOpen, FiCheck, FiCheckCircle, FiCreditCard, FiHeadphones, FiLock, FiMessageCircle, FiMic, FiRefreshCw, FiStar, FiUsers, FiZap } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { cancelSubscriptionAtPeriodEnd, createBillingPortal, createCheckoutSession, resumeSubscription } from "../../services/billingService";
import { getMembershipProfile, getPublicPlans, redeemActivationCode } from "../../services/membershipService";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { sendBrandedVerificationEmail } from "../../services/authEmailService";
import { hasAiAddonPlan, isAiAddonPlanCode } from "../../constants/membershipPlans";
import "./css/Platform.scss";

const STATUS_LABELS = { pending_verification: "等待 Email 驗證", trialing: "免費試用中", active: "使用中", past_due: "付款待處理", cancelled: "已取消，期限前可使用", expired: "已到期", suspended: "已停用", complimentary: "贈送使用權" };
const FEATURE_LABELS = {
    listening: "分級教材與聽力",
    ai_materials: "AI 教材生成",
    conversation: "英文情境對話",
    assignments: "英文班作業",
    review: "智慧複習",
    requires_book_entitlement: "依已購或已開通教材使用"
};
const formatDate = value => value ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeZone: "Asia/Taipei" }).format(new Date(value)) : "無期限";
const getLatestGrantEnd = grants => {
    if (!grants.length || grants.some(grant => !grant?.ends_at)) return null;
    const timestamps = grants.map(grant => new Date(grant.ends_at).getTime()).filter(Number.isFinite);
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
};
const getDaysRemaining = value => {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return null;
    return Math.max(0, Math.ceil((timestamp - Date.now()) / 86400000));
};
const formatRenewalDay = value => {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return new Intl.DateTimeFormat("zh-TW", { day: "numeric", timeZone: "Asia/Taipei" })
        .formatToParts(date)
        .find(part => part.type === "day")?.value || null;
};

const FEATURE_OVERVIEW = [
    { key: "listening", label: "教材與聽力", description: "使用已取得權限的教材、音檔與學習進度。", path: "/materials", icon: FiHeadphones },
    { key: "conversation", label: "英文情境對話", description: "練習遇到外國人時的聽力與口說反應。", path: "/student/conversation", icon: FiMessageCircle },
    { key: "review", label: "智慧複習", description: "重新練習錯題與還沒完全掌握的內容。", path: "/student/review", icon: FiRefreshCw },
    { key: "assignments", label: "英文班作業", description: "只有有效在學、且老師有發布作業時才會顯示。", path: "/student/assignments", icon: FiUsers },
    { key: "ai_materials", label: "AI 專屬教材", description: "依自己的需求生成個人化英文練習。", path: "/student/ai-generator", icon: FiZap },
    { key: "pronunciation", entitlementKey: "ai_materials", label: "發音練習", description: "朗讀指定句子並查看逐字發音結果。", path: "/student/pronunciation", icon: FiMic }
];

const LOCK_REASON_LABELS = {
    book_entitlement_required: "尚未取得教材",
    level_locked: "尚未達到解鎖等級",
    membership_required: "網站使用權未啟用"
};

function MembershipCenter() {
    const { firebaseUser, setStudentProfile } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [plans, setPlans] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [catalogError, setCatalogError] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState("");
    const [verificationCooldown, setVerificationCooldown] = useState(0);

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(true);
        try {
            const [profileResult, planResult, catalogResult] = await Promise.all([
                getMembershipProfile(firebaseUser),
                getPublicPlans(firebaseUser),
                getAccessibleCatalog(firebaseUser).catch(error => ({ categories: [], error }))
            ]);
            setProfile(profileResult.profile);
            setStudentProfile(profileResult.profile);
            setPlans(planResult.plans || []);
            setCatalog(catalogResult.categories || []);
            setCatalogError(catalogResult.error?.message || "");
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
    const learnerType = profile?.learner_type || membership?.effective_access?.learner_type || null;
    const membershipIdentityLabel = profile?.role === "teacher"
        ? "英文班老師"
        : profile?.role === "admin"
            ? "系統管理員"
            : isActiveAcademyStudent
                ? "英文班在校生"
                : learnerType === "academy_student"
                    ? "英文班離校生"
                    : learnerType === "trial_user"
                        ? "七天試用會員"
                        : "一般會員";
    const effectiveGrants = useMemo(() => membership?.effective_access?.grants || [], [membership]);
    const baseAccessGrants = useMemo(() => effectiveGrants.filter(grant => !isAiAddonPlanCode(grant?.plan_code)), [effectiveGrants]);
    const primaryBaseGrant = useMemo(() => (
        baseAccessGrants.find(grant => grant?.plan_code === "basic_membership_monthly")
        || baseAccessGrants.find(grant => grant?.plan_code === "academy_internal")
        || baseAccessGrants[baseAccessGrants.length - 1]
        || null
    ), [baseAccessGrants]);
    const hasUnlimitedBaseAccess = baseAccessGrants.some(grant => !grant?.ends_at);
    const membershipPlanLabel = isActiveAcademyStudent
        ? academyGrant?.plan_name || "英文班在學方案"
        : primaryBaseGrant?.plan_name || membership?.plan?.name || "尚未選擇方案";
    const baseAccessEnd = isActiveAcademyStudent || hasUnlimitedBaseAccess
        ? null
        : getLatestGrantEnd(baseAccessGrants)
            || membership?.current_period_end
            || membership?.access_ends_at
            || membership?.trial_ends_at
            || membership?.effective_access_end
            || null;
    const baseDaysRemaining = getDaysRemaining(baseAccessEnd);
    const hasEndedMembership = membership?.is_active !== true
        && ["expired", "cancelled"].includes(membership?.status);
    const membershipStatusLabel = ["pending_verification", "trialing", "past_due", "suspended"].includes(membership?.status)
        ? STATUS_LABELS[membership.status]
        : membership?.is_active === true && (membership?.cancel_at_period_end === true || membership?.status === "cancelled")
            ? STATUS_LABELS.cancelled
            : membership?.is_active === true && baseDaysRemaining !== null && baseDaysRemaining <= 7
                ? "即將到期"
                : membership?.is_active === true
                    ? "使用中"
                    : membership?.status === "cancelled"
                        ? STATUS_LABELS.expired
                    : STATUS_LABELS[membership?.status] || membership?.status || "尚未啟用";
    const displayedAccessEnd = isActiveAcademyStudent
        ? "在校期間有效"
        : hasUnlimitedBaseAccess
            ? "無期限"
            : baseAccessEnd
                ? formatDate(baseAccessEnd)
                : hasEndedMembership
                    ? "已結束"
                    : "無期限";
    const displayedDaysRemaining = isActiveAcademyStudent
        ? "不需另外續費"
        : hasUnlimitedBaseAccess
            ? "永久保留"
            : hasEndedMembership
                ? "已到期"
                : baseDaysRemaining == null
                    ? membership?.days_remaining == null ? "無期限" : `${membership.days_remaining} 天`
                    : `${baseDaysRemaining} 天`;
    const hasAiAddon = hasAiAddonPlan([...activePlanCodes]);
    const aiAddonGrant = useMemo(() => (
        membership?.effective_access?.grants?.find(grant => isAiAddonPlanCode(grant?.plan_code)) || null
    ), [membership]);
    const aiAddonSubscription = membership?.ai_addon_subscription;
    const aiRenewalAt = aiAddonSubscription?.current_period_end || (
        aiAddonGrant?.source === "stripe" ? aiAddonGrant?.ends_at : null
    );
    const aiRenewalDay = formatRenewalDay(aiRenewalAt);
    const aiAddonCancelling = aiAddonSubscription?.cancel_at_period_end === true;
    const effectiveFeatures = useMemo(() => membership?.effective_access?.features || {}, [membership]);
    const catalogBooks = useMemo(() => catalog.flatMap(category => (
        (category.books || []).map(book => ({ ...book, categoryName: category.name }))
    )), [catalog]);
    const accessibleBooks = useMemo(() => catalogBooks.filter(book => !book.locked), [catalogBooks]);
    const lockedBooks = useMemo(() => catalogBooks.filter(book => book.locked), [catalogBooks]);
    const firstAccessibleBookPath = accessibleBooks[0]?.code
        ? `/student/books/${accessibleBooks[0].code}`
        : "/materials";
    const featureItems = useMemo(() => FEATURE_OVERVIEW.map(item => ({
        ...item,
        available: effectiveFeatures[item.entitlementKey || item.key] === true,
        path: item.key === "listening" ? firstAccessibleBookPath : item.path
    })), [effectiveFeatures, firstAccessibleBookPath]);
    const availableFeatureItems = featureItems.filter(item => item.available);
    const upgradeFeatureItems = featureItems.filter(item => !item.available && item.key !== "assignments");
    const assignmentsAreUnavailable = featureItems.some(item => item.key === "assignments" && !item.available);

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
            if (error.code === "guardian_email_required") { toast.info("請先補上家長 Email"); navigate("/student/settings"); }
            else toast.error(error.message || "目前無法前往付款");
            setWorking("");
        }
    };

    const updateRenewal = async (resume, subscriptionId = null) => {
        setWorking(resume ? "resume" : "cancel");
        try {
            await (resume ? resumeSubscription(firebaseUser, subscriptionId) : cancelSubscriptionAtPeriodEnd(firebaseUser, subscriptionId));
            toast.success(resume ? "已恢復到期前續訂" : "已排程於本期結束取消；到期前仍可使用");
            await load();
        } catch (error) { toast.error(error.message || "方案狀態更新失敗"); }
        finally { setWorking(""); }
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
            await sendBrandedVerificationEmail(firebaseUser);
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
            <header className="membership-page-header">
                <div className="membership-page-title"><span className="platform-eyebrow">MY ACCESS</span><h1>我的教材與功能</h1><p>快速確認目前方案、可用功能與已取得教材。</p></div>
                <dl className={`membership-access-summary ${membership?.is_active ? "is-active" : "is-expired"}`} aria-label="目前方案摘要">
                    <div><dt>會員身分</dt><dd>{membershipIdentityLabel}</dd></div>
                    <div><dt>目前方案</dt><dd>{membershipPlanLabel}</dd></div>
                    <div><dt>使用狀態</dt><dd>{membershipStatusLabel}</dd></div>
                    <div><dt>{isActiveAcademyStudent ? "使用期間" : "可使用至"}</dt><dd>{displayedAccessEnd}<small>{displayedDaysRemaining}</small></dd></div>
                </dl>
            </header>

            <section className="platform-card membership-feature-overview" aria-labelledby="feature-access-heading">
                <div className="platform-section-title membership-section-title"><div><span className="platform-eyebrow">YOUR ACCESS</span><h2 id="feature-access-heading">目前可用功能</h2><p>已開通 {availableFeatureItems.length} 項，點一下就能開始使用。</p></div><strong className="membership-feature-count">{availableFeatureItems.length}／{FEATURE_OVERVIEW.length}</strong></div>
                <div className="membership-feature-columns">
                    <div className="membership-feature-list" role="list" aria-label="已開通功能">
                        {availableFeatureItems.length === 0
                            ? <div className="membership-feature-empty"><FiLock aria-hidden="true" /><span><strong>目前尚未開通學習功能</strong><small>可在右側查看適合你的方案。</small></span></div>
                            : availableFeatureItems.map(item => { const Icon = item.icon; return <Link className="membership-feature-row" to={item.path} key={item.key} role="listitem"><span><Icon aria-hidden="true" /></span><div><strong>{item.label}</strong><small>{item.description}</small></div><FiCheckCircle aria-label="可以使用" /></Link>; })}
                    </div>
                    <aside className="membership-upgrade-panel" aria-label="尚未開通功能">
                        <span className="membership-upgrade-kicker"><FiStar aria-hidden="true" />還可以獲得更多</span>
                        <h3>{upgradeFeatureItems.length > 0 ? `再解鎖 ${upgradeFeatureItems.length} 項學習功能` : "目前方案已很完整"}</h3>
                        {upgradeFeatureItems.length > 0 && <ul>{upgradeFeatureItems.map(item => <li key={item.key}><FiLock aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.description}</small></span></li>)}</ul>}
                        {assignmentsAreUnavailable && <p className="membership-academy-note"><FiUsers aria-hidden="true" />英文班作業為在校生專屬，不屬於月費加購。</p>}
                        {upgradeFeatureItems.length > 0 && <a className="platform-primary" href="#plans"><FiZap aria-hidden="true" />查看可解鎖方案</a>}
                    </aside>
                </div>
            </section>

            <section className="platform-card membership-plans" id="plans">
                <div className="platform-section-title membership-section-title"><div><span className="platform-eyebrow">MEMBERSHIP & AI</span><h2>延續使用與功能加購</h2><p>基本會員延續已擁有教材；AI 教材與發音練習為獨立加購。</p></div>{(membership?.has_stripe_customer || membership?.stripe_subscription_status) && <button className="platform-secondary" type="button" onClick={portal} disabled={working === "portal"} aria-busy={working === "portal"}>{working === "portal" && <span className="platform-button-spinner is-dark" aria-hidden="true" />} {working === "portal" ? "正在開啟訂閱管理…" : "管理目前訂閱"}</button>}</div>
                {membership?.stripe_subscription_status && !isActiveAcademyStudent && <div className="membership-billing-notice"><p>{membership.cancel_at_period_end ? `已排程於 ${formatDate(membership.current_period_end)} 取消，到期前可恢復。` : membership.stripe_subscription_status === "past_due" ? "付款失敗，請由 Customer Portal 更新付款方式。" : `目前付款週期至 ${formatDate(membership.current_period_end)}。`}</p>{membership.stripe_subscription_status !== "canceled" && <button className="platform-secondary" type="button" disabled={Boolean(working)} onClick={() => updateRenewal(membership.cancel_at_period_end)}>{membership.cancel_at_period_end ? "到期前恢復續訂" : "本期結束取消"}</button>}</div>}
                {hasAiAddon && <div className="membership-active-addon" role="status" aria-label="AI Premium 已啟用"><span className="membership-active-addon-icon"><FiZap aria-hidden="true" /></span><div><span>AI PREMIUM</span><strong>你的 AI 學習力已升級</strong><small>{aiAddonCancelling ? `使用至 ${formatDate(aiRenewalAt)}，到期後不再扣款` : aiRenewalDay ? `每月 ${aiRenewalDay} 日續訂 · 每日 5 次、每月 150 次` : "AI 教材與發音練習已啟用"}</small></div><div className="membership-active-addon-actions"><Link to="/student/ai-generator">AI 教材</Link><Link to="/student/pronunciation">發音練習</Link>{aiAddonSubscription?.stripe_subscription_id && <button type="button" disabled={Boolean(working)} onClick={() => updateRenewal(aiAddonCancelling, aiAddonSubscription.stripe_subscription_id)}>{aiAddonCancelling ? "恢復續訂" : "到期取消"}</button>}</div></div>}
                {publicPlans.length === 0
                    ? <div className="platform-empty"><strong>線上訂閱尚未開放</strong><p>目前可以使用免費試用或教材啟用碼。正式價格完成設定後，月費方案會自動顯示在這裡。</p></div>
                    : <div className="membership-plan-list">{publicPlans.map(plan => {
                        const planActive = activePlanCodes.has(plan.code);
                        const booleanFeatures = Object.entries(plan.features || {}).filter(([, enabled]) => enabled === true);
                        const planWorking = working === `plan-${plan.id}`;
                        return <article className={`membership-plan-row ${planActive ? "is-active" : ""} ${isAiAddonPlanCode(plan.code) ? "is-ai-addon" : ""}`} key={plan.id}>
                            <div className="membership-plan-copy"><span>{plan.offer_label || (plan.access_model === "addon" ? "AI 教材與發音練習" : "月費訂閱")}</span><h3>{plan.name}</h3><p>{plan.description}</p><ul>{booleanFeatures.map(([feature]) => <li key={feature}><FiCheck aria-hidden="true" />{FEATURE_LABELS[feature] || feature.replaceAll("_", " ")}</li>)}{Number(plan.features?.ai_monthly_limit) > 0 && <li><FiCheck aria-hidden="true" />每月最多 {Number(plan.features.ai_monthly_limit)} 次</li>}</ul></div>
                            <div className="membership-plan-action"><strong>NT$ {Number(plan.price_twd || 0).toLocaleString()}<small>／月</small></strong><button className="platform-primary" type="button" onClick={() => checkout(plan)} disabled={planActive || !plan.checkout_ready || Boolean(working)} aria-busy={planWorking}>{planActive ? <>{isAiAddonPlanCode(plan.code) && <FiZap aria-hidden="true" />}{isAiAddonPlanCode(plan.code) ? "AI Premium 使用中" : "目前方案使用中"}</> : planWorking ? <><span className="platform-button-spinner" aria-hidden="true" />正在開啟安全付款…</> : plan.checkout_ready ? <><FiCreditCard aria-hidden="true" />選擇方案</> : "付款設定中"}</button></div>
                        </article>;
                    })}</div>}
            </section>

            <section className="platform-card platform-material-access" aria-labelledby="material-access-heading">
                <div className="platform-section-title"><div><span className="platform-eyebrow">MY MATERIALS</span><h2 id="material-access-heading">目前可使用的教材</h2><p>購買完成並成功帶入權限後，教材會自動出現在這裡與 Navbar。</p></div><Link className="platform-primary" to="/materials"><FiCreditCard />購買其他教材</Link></div>
                {catalogError
                    ? <div className="platform-empty"><strong>教材清單暫時無法讀取</strong><p>你的權限不會因此消失，請稍後重新整理頁面。</p></div>
                    : accessibleBooks.length === 0
                        ? <div className="platform-empty"><strong>目前沒有可使用的教材</strong><p>購買教材包或輸入教材啟用碼後，教材會自動出現在這裡。</p></div>
                        : <div className="platform-material-grid">{accessibleBooks.map(book => <Link className="platform-material-item" to={`/student/books/${book.code}`} key={book.id || book.code}><span><FiBookOpen aria-hidden="true" /></span><div><small>{book.categoryName}</small><strong>{book.name}</strong><em><FiCheckCircle aria-hidden="true" />已取得使用權</em></div></Link>)}</div>}
                {lockedBooks.length > 0 && <details className="platform-locked-materials"><summary><span><FiLock aria-hidden="true" />另有 {lockedBooks.length} 本教材尚未取得使用權</span><strong>查看教材</strong></summary><div>{lockedBooks.map(book => <article key={book.id || book.code}><div><small>{book.categoryName}</small><strong>{book.name}</strong></div><span>{LOCK_REASON_LABELS[book.lock_reason] || "尚未解鎖"}</span></article>)}</div></details>}
            </section>

            {membership?.requires_email_verification && <section className="platform-card"><div className="platform-section-title"><div><span className="platform-eyebrow">EMAIL VERIFICATION</span><h2>先完成 Email 驗證</h2><p>驗證信會寄到 {firebaseUser?.email}。完成驗證後，7 天免費試用才會開始計時。</p></div><div className="platform-verification-actions"><button className="platform-secondary" onClick={resendVerification} disabled={working === "verification" || verificationCooldown > 0}>{working === "verification" ? "寄送中…" : verificationCooldown > 0 ? `${verificationCooldown} 秒後可重寄` : "重新寄送驗證信"}</button><button className="platform-primary" onClick={confirmVerification} disabled={working === "confirm-verification"}>{working === "confirm-verification" ? "確認中…" : "我已完成驗證"}</button></div></div><p className="platform-footnote">仍未收到時，請搜尋 Alan English 寄件者，並檢查垃圾郵件或促銷內容。</p></section>}
            <section className="platform-card membership-compact-card"><div className="platform-section-title"><div><span className="platform-eyebrow">ACTIVATION CODE</span><h2>教材啟用碼</h2><p>購買實體教材取得啟用碼時，可在這裡加入教材與附贈的網站使用權。</p></div></div><form className="platform-inline-form" onSubmit={redeem}><input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="AE-XXXX-XXXX-XXXX" autoComplete="off" /><button className="platform-primary" disabled={working === "redeem"}>{working === "redeem" ? "啟用中…" : "啟用權限"}</button></form></section>
            <section className="platform-card membership-compact-card"><div className="platform-section-title"><div><span className="platform-eyebrow">NEXT MATERIAL</span><h2>需要下一級教材？</h2><p>基本月費只延續已擁有教材，不會自動解鎖下一級或附送新的實體教材。</p></div><Link className="platform-secondary" to="/materials"><FiBookOpen />查看教材包</Link></div></section>
        </main>
    );
}

export default MembershipCenter;
