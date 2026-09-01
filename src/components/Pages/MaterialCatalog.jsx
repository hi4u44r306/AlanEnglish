import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCheckCircle, FiHeadphones, FiHome, FiLock, FiLogIn, FiPlay, FiShoppingBag, FiStar } from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import Brand from "../fragment/Brand";
import SeoHead from "../fragment/SeoHead";
import { createMaterialCheckout } from "../../services/billingService";
import { loadMaterialPackages, loadPlacementAssessment, submitPlacementAssessment } from "../../services/commerceService";
import "./css/Commerce.scss";

const money = value => Number.isInteger(Number(value)) ? `NT$${Number(value).toLocaleString("zh-TW")}` : "價格待確認";
const groupBy = (items, key) => Object.groupBy ? Object.groupBy(items, key) : items.reduce((groups, item) => {
    const group = key(item); (groups[group] ||= []).push(item); return groups;
}, {});

function MaterialCatalog() {
    const { firebaseUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [packages, setPackages] = useState([]);
    const [assessment, setAssessment] = useState(null);
    const [answers, setAnswers] = useState({});
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [buying, setBuying] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [catalog, quiz] = await Promise.all([
                loadMaterialPackages(firebaseUser), loadPlacementAssessment(firebaseUser)
            ]);
            setPackages(catalog?.packages || []); setAssessment(quiz?.assessment || null);
        } catch (error) { toast.error(error.message || "教材商品載入失敗"); }
        finally { setLoading(false); }
    }, [firebaseUser]);
    useEffect(() => { load(); }, [load]);

    const returnPath = firebaseUser ? "/userinfo" : "/";
    const goBack = () => location.key && location.key !== "default" ? navigate(-1) : navigate(returnPath);

    const questions = useMemo(() => assessment?.questions || [], [assessment]);
    const groupedQuestions = useMemo(() => groupBy(questions, question => question.skill), [questions]);

    const speak = text => {
        if (!("speechSynthesis" in window)) return toast.info("此瀏覽器不支援語音播放，請改用最新版 Safari 或 Chrome");
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-US"; utterance.rate = 0.82;
        window.speechSynthesis.speak(utterance);
    };

    const submitQuiz = async event => {
        event.preventDefault();
        if (Object.keys(answers).length !== questions.length) return toast.info("請完成所有題目");
        setSubmitting(true);
        try {
            const result = await submitPlacementAssessment(answers, assessment.id, firebaseUser);
            setRecommendations(result?.recommendations || []);
            document.getElementById("placement-results")?.scrollIntoView({ behavior: "smooth" });
        } catch (error) { toast.error(error.message || "推薦結果建立失敗"); }
        finally { setSubmitting(false); }
    };

    const buy = async packageId => {
        if (!firebaseUser) return navigate("/login?next=/materials");
        setBuying(packageId);
        try {
            const result = await createMaterialCheckout(firebaseUser, packageId);
            if (result?.url) window.location.assign(result.url);
        } catch (error) {
            if (error.code === "guardian_email_required") {
                toast.info("請先補上家長 Email"); navigate("/student/settings");
            } else toast.error(error.message || "無法開始付款");
        } finally { setBuying(null); }
    };

    const PackageCard = ({ item, compact = false }) => {
        const bookRows = item.material_package_books || [];
        return <article className={`commerce-package-card ${compact ? "is-compact" : ""}`}>
            {item.cover_url ? <img src={item.cover_url} alt={`${item.name}封面`} /> : <div className="commerce-cover-fallback"><FiBookOpen /></div>}
            <div className="commerce-package-copy">
                <span>{item.level_code || "ALAN ENGLISH"}</span>
                <h3>{item.name}</h3>
                <p>{item.suitable_for || item.description || "依單字、句型與聽力程度選擇適合的學習教材。"}</p>
                {item.learning_goals && <small><FiStar />{item.learning_goals}</small>}
                <ul>{bookRows.map(row => <li key={`${row.role}-${row.book_id}`}><FiCheckCircle />{row.books?.name || row.role}</li>)}</ul>
                <div className="commerce-package-price"><strong>{money(item.display_price_twd)}</strong><span>{item.includes_90_day_access ? "單一售價；付款確認後附贈 90 天平台使用權" : "不含額外網站使用期"}</span></div>
                {item.samples?.map(sample => <audio key={sample.id} controls preload="none" src={sample.audio_url || undefined} aria-label={`${sample.title}試聽`} />)}
                <button type="button" onClick={() => buy(item.id)} disabled={buying === item.id || !item.display_price_twd}><FiShoppingBag />{buying === item.id ? "前往付款中…" : item.display_price_twd ? "購買教材包" : "價格待管理員確認"}</button>
            </div>
        </article>;
    };

    return <>
        <SeoHead path="/materials" />
        <header className="commerce-site-header">
            <Link className="commerce-site-brand" to="/" aria-label="回到 Alan English 首頁"><Brand /></Link>
            <nav aria-label="教材商品頁導覽">
                <button type="button" onClick={goBack}><FiArrowLeft />返回上一頁</button>
                <Link to={firebaseUser ? "/userinfo" : "/login?next=/materials"}>
                    {firebaseUser ? <FiHome /> : <FiLogIn />}
                    {firebaseUser ? "我的首頁" : "登入"}
                </Link>
            </nav>
        </header>
        <main className="commerce-page">
        <section className="commerce-hero">
            <div><span>ALAN ENGLISH MATERIALS</span><h1>三本實體教材，搭配 90 天線上學習。</h1><p>完整教材包固定包含課本、Workbook 與聽力本，付款後永久保留三本教材的線上擁有權，並附贈 90 天平台使用權。之後若只想使用全部正式聽力教材，可選擇每月 NT$299 基本會員。</p><div><a href="#placement"><FiHeadphones />先做三向程度測驗</a><Link to="/freetrial">不需信用卡，先試用 7 天<FiArrowRight /></Link></div></div>
            <aside><FiLock /><strong>付費教材維持私有</strong><span>未授權時不會取得完整音檔、字幕、逐字稿或播放 URL。</span></aside>
        </section>

        <section className="commerce-catalog" aria-busy={loading}>
            <header><span>MATERIAL PACKAGES</span><h2>三本教材商品包</h2><p>每組必須完整包含一本課本、一本 Workbook 與一本聽力本，並使用單一售價；缺少任何一本都不會上架。目前付款仍是 Stripe 測試模式。</p></header>
            {loading ? <p className="commerce-empty">載入教材中…</p> : packages.length ? <div className="commerce-package-grid">{packages.map(item => <PackageCard key={item.id} item={item} />)}</div> : <p className="commerce-empty">三本教材內容尚在整理；課本、Workbook、聽力本與價格都確認後才會上架。</p>}
        </section>

        {assessment && <section className="commerce-placement" id="placement">
            <header><span>QUICK PLACEMENT</span><h2>單字、句型、聽力程度推薦</h2><p>結果只用來推薦，不會鎖死學生程度；老師或管理員仍可人工調整。</p></header>
            <form onSubmit={submitQuiz}>
                {Object.entries(groupedQuestions).map(([skill, skillQuestions]) => <fieldset key={skill}><legend>{skill === "vocabulary" ? "單字" : skill === "sentence" ? "句型" : "聽力"}</legend>{skillQuestions.map((question, index) => <div className="commerce-question" key={question.id}><strong>{index + 1}. {question.prompt}</strong>{question.audio_prompt && <button type="button" className="commerce-listen" onClick={() => speak(question.audio_prompt)}><FiPlay />播放題目</button>}<div>{question.choices.map((choice, choiceIndex) => <label key={choice}><input type="radio" name={`q-${question.id}`} checked={Number(answers[question.id]) === choiceIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: choiceIndex }))} /><span>{choice}</span></label>)}</div></div>)}</fieldset>)}
                <button className="commerce-submit" type="submit" disabled={submitting}>{submitting ? "分析中…" : "查看教材推薦"}</button>
            </form>
        </section>}

        {recommendations.length > 0 && <section className="commerce-results" id="placement-results"><header><span>YOUR RESULTS</span><h2>你的教材建議</h2></header><div>{recommendations.map(result => <div key={result.label}><h3>{result.label}</h3><PackageCard item={result.package} compact /></div>)}</div></section>}
        </main>
    </>;
}

export default MaterialCatalog;
