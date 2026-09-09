import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCheckCircle, FiHeadphones, FiHome, FiLock, FiLogIn, FiPlay, FiStar } from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import Brand from "../fragment/Brand";
import SeoHead from "../fragment/SeoHead";
import { loadPlacementAssessment, submitPlacementAssessment } from "../../services/commerceService";
import "./css/Commerce.scss";

const groupBy = (items, key) => Object.groupBy ? Object.groupBy(items, key) : items.reduce((groups, item) => {
    const group = key(item); (groups[group] ||= []).push(item); return groups;
}, {});

function MaterialCatalog() {
    const { firebaseUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [assessment, setAssessment] = useState(null);
    const [answers, setAnswers] = useState({});
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const quiz = await loadPlacementAssessment(firebaseUser);
            setAssessment(quiz?.assessment || null);
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
                <div className="commerce-package-price"><strong>暫未販售</strong><span>教材包公開販售與付款功能尚未開放。</span></div>
                {item.samples?.map(sample => <audio key={sample.id} controls preload="none" src={sample.audio_url || undefined} aria-label={`${sample.title}試聽`} />)}
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
            <div><span>ALAN ENGLISH MATERIALS</span><h1>教材包準備中，先從免費試用開始。</h1><p>目前教材包暫未公開販售或結帳。你可以先完成程度測驗與 7 天免費試用；未來實體教材開放後，會以同一個已驗證 Email 領取網站使用權。</p><div><a href="#placement"><FiHeadphones />先做三向程度測驗</a><Link to="/freetrial">不需信用卡，先試用 7 天<FiArrowRight /></Link></div></div>
            <aside><FiLock /><strong>教材包暫未販售</strong><span>目前不會建立教材付款、訂單或新的教材權限。</span></aside>
        </section>

        <section className="commerce-catalog" aria-busy={loading}>
            <header><span>MATERIAL PACKAGES</span><h2>教材商品包</h2><p>教材內容、價格與購買流程確認完成後才會公開販售。</p></header>
            <p className="commerce-empty">教材包正在準備中，目前暫不販售。</p>
        </section>

        {assessment && <section className="commerce-placement" id="placement">
            <header><span>QUICK PLACEMENT</span><h2>單字、句型、聽力程度推薦</h2><p>結果只用來推薦，不會鎖死學生程度；老師或管理員仍可人工調整。</p></header>
            <form onSubmit={submitQuiz}>
                {Object.entries(groupedQuestions).map(([skill, skillQuestions]) => <fieldset key={skill}><legend>{skill === "vocabulary" ? "單字" : skill === "sentence" ? "句型" : "聽力"}</legend>{skillQuestions.map((question, index) => <div className="commerce-question" key={question.id}><strong>{index + 1}. {question.prompt}</strong>{question.audio_prompt && <button type="button" className="commerce-listen" onClick={() => speak(question.audio_prompt)}><FiPlay />播放題目</button>}<div>{question.choices.map((choice, choiceIndex) => <label key={choice}><input type="radio" name={`q-${question.id}`} checked={Number(answers[question.id]) === choiceIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: choiceIndex }))} /><span>{choice}</span></label>)}</div></div>)}</fieldset>)}
                <button className="commerce-submit" type="submit" disabled={submitting}>{submitting ? "分析中…" : "查看三個推薦結果"}</button>
            </form>
        </section>}

        {recommendations.length > 0 && <section className="commerce-results" id="placement-results"><header><span>YOUR RESULTS</span><h2>你的教材建議</h2></header><div>{recommendations.map(result => <div key={result.label}><h3>{result.label}</h3><PackageCard item={result.package} compact /></div>)}</div></section>}
        </main>
    </>;
}

export default MaterialCatalog;
