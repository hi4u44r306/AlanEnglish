import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Eye, LoaderCircle, Mic2, Save, Sparkles, Volume2, X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { getSpeakingQuestionVisual } from "../../data/speakingQuestionVisuals";
import {
    createWorkbookOneStarterQuestionSet, createWorkbookOneGreetingsQuestionSet,
    createWorkbookOneCuratedQuestionSet, createWorkbookTwoStarterQuestionSet,
    generateSpeakingQuestionSetAudio, getSpeakingContentBootstrap,
    getSpeakingQuestionAudioPreview, publishSpeakingQuestionSet, updateDraftSpeakingQuestion
} from "../../services/speakingContentService";
import "./css/Platform.scss";
import "./css/SpeakingContentAdmin.scss";

const WORKBOOK_ONE_FOLLOWUPS = [
    ["create_workbook_1_colors", "workbook_1_colors_objects_v1", "03", "顏色與生活物品", "P28、P30、P34、P84；顏色、常見物品與 a／an。"],
    ["create_workbook_1_numbers", "workbook_1_numbers_math_v1", "04", "數字與簡單算術", "P39、P42、P43、P49；1～13、plus 與 minus。"],
    ["create_workbook_1_time", "workbook_1_time_daily_routine_v1", "05", "時間與我的一天", "P46、P60、P70、P75、P80、P90；整點與日常作息。"],
    ["create_workbook_1_body", "workbook_1_body_parts_v1", "06", "我的身體部位", "P64、P78；眼睛、耳朵、鼻子、嘴巴與四肢。"],
    ["create_workbook_1_family", "workbook_1_family_people_v1", "07", "家人與人物介紹", "P79、P87、P89、P104；家庭關係、人稱與稱謂。"],
    ["create_workbook_1_yes_no", "workbook_1_yes_no_contractions_v1", "08", "Yes／No 與縮寫回答", "P26、P27、P34、P51、P53、P92、P94；be 動詞與完整回答。"],
    ["create_workbook_1_places", "workbook_1_places_demonstratives_v1", "09", "東西在哪裡？", "P96、P109、P111、P112、P114；位置、近遠與單複數。"],
    ["create_workbook_1_review", "workbook_1_wh_questions_review_v1", "10", "問句與總複習", "P99、P101～P108、P117～P119；人物、年齡、地點、職業與時間。"]
].map(([action, templateKey, number, title, description]) => ({ action, templateKey, number, title, description, expectedCount: 6, creator: "workbookOneFollowup" }));

const CURATED_BOOKS = [
    { code: "workbook1", label: "Workbook 1", challenges: [
        { templateKey: "workbook_1_name_intro_v1", number: "01", title: "我的名字與自我介紹", description: "P18～P20；姓名、自我介紹與拼字。", expectedCount: 4, creator: "workbookOneStarter" },
        { templateKey: "workbook_1_greetings_polite_v1", number: "02", title: "打招呼與禮貌對話", description: "問候、近況、初次見面與道別。", expectedCount: 8, creator: "workbookOneGreetings" },
        ...WORKBOOK_ONE_FOLLOWUPS
    ] },
    { code: "workbook2", label: "Workbook 2", challenges: [
        { templateKey: "workbook_2_origin_places_v1", number: "01", title: "我來自哪裡？", description: "P56～P58；國家、人物與 come from。", expectedCount: 6, creator: "workbookTwoStarter" }
    ] }
];

const normalizeBookCode = book => String(book?.code || book?.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const sortedQuestions = set => [...(set?.speaking_questions || [])].sort((a, b) => a.sort_order - b.sort_order);
const isQuestionComplete = question => Boolean(question?.question_text?.trim() && question?.hint_zh?.trim() && question?.simple_answer?.trim() && question?.model_answer?.trim());
const statusMeta = set => {
    if (!set) return { label: "尚未建立", className: "empty" };
    if (set.status === "published") return { label: "已發布", className: "published" };
    const questions = sortedQuestions(set);
    return questions.length && questions.every(isQuestionComplete)
        ? { label: "可發布", className: "ready" }
        : { label: "草稿待完成", className: "draft" };
};
const plannedVoice = (setId, order) => (Math.abs(Number(setId) || 0) + Math.abs(Number(order) || 0)) % 2 === 0
    ? { gender: "female", label: "女聲 · Autonoe" } : { gender: "male", label: "男聲 · Puck" };

const QuestionAudioPreview = ({ firebaseUser, questionSet, question }) => {
    const [preview, setPreview] = useState({});
    const [loading, setLoading] = useState("");
    const answerVoice = plannedVoice(questionSet.id, question.sort_order);
    const promptVoice = answerVoice.gender === "female" ? { gender: "male", label: "男聲 · Puck" } : { gender: "female", label: "女聲 · Autonoe" };
    const loadPreview = async purpose => {
        setLoading(purpose);
        try {
            const result = await getSpeakingQuestionAudioPreview(firebaseUser, questionSet.id, question.id, purpose);
            setPreview(current => ({ ...current, [purpose]: result }));
        }
        catch (error) { toast.error(error.message || "示範語音尚未準備完成"); }
        finally { setLoading(""); }
    };
    return <div className="speaking-voice-preview-list">
        {[{ purpose: "question_prompt", label: `問題 · ${promptVoice.label}`, voice: promptVoice }, { purpose: "model_answer", label: `回答 · ${answerVoice.label}`, voice: answerVoice }].map(item => <div className={`speaking-voice-preview ${item.voice.gender}`} key={item.purpose}>
            <span>{item.label}</span>
            {questionSet.status === "published" && <button type="button" disabled={Boolean(loading)} onClick={() => loadPreview(item.purpose)} aria-label={`試聽第 ${Number(question.sort_order || 0) + 1} 題${item.label}`}><Volume2 size={16} />{loading === item.purpose ? "載入中…" : "試聽"}</button>}
            {preview[item.purpose]?.audio_url && <audio controls autoPlay src={preview[item.purpose].audio_url} aria-label={`第 ${Number(question.sort_order || 0) + 1} 題${item.label}`} />}
        </div>)}
    </div>;
};

const StudentQuestionSetPreview = ({ questionSet, firebaseUser }) => <div className="speaking-student-preview__screen">
    <header><span>口說大挑戰預覽</span><h3>{questionSet.title}</h3><p>{questionSet.intro_zh || "學生會先聽問題，自行回答；需要時才展開提示與示範句。"}</p>{questionSet.learning_goal_zh && <small>學習目標：{questionSet.learning_goal_zh}</small>}</header>
    <div className="speaking-student-preview__questions">{sortedQuestions(questionSet).map((question, index) => {
        const visual = getSpeakingQuestionVisual(question.question_text);
        return <article key={question.id}><span>第 {index + 1} 題</span><strong>{question.question_text}</strong>
            {visual && <figure className="speaking-admin-question-visual"><img src={visual.src} alt={visual.alt} width="640" height="420" /><figcaption>教材 P{visual.sourcePage} · 學生題目圖片</figcaption></figure>}
            <details><summary>學生需要提示時顯示</summary><p>{question.hint_zh}</p><em>{question.simple_answer}</em></details>
            <QuestionAudioPreview firebaseUser={firebaseUser} questionSet={questionSet} question={question} />
            <small>{question.pronunciation_notes_zh || "完成錄音後顯示發音回饋。"}</small>
        </article>;
    })}</div><p className="speaking-student-preview__note">這是管理員預覽，不會寫入學生進度。</p>
</div>;

const QuestionEditor = ({ question, disabled, onSave, onSaveAndNext, hasNext }) => {
    const visual = getSpeakingQuestionVisual(question.question_text);
    const [dirty, setDirty] = useState(false);
    const [form, setForm] = useState({ question_text: question.question_text || "", hint_zh: question.hint_zh || "", keywords: (question.keywords || []).join("、"), simple_answer: question.simple_answer || "", model_answer: question.model_answer || "", follow_up_question: question.follow_up_question || "", pronunciation_notes_zh: question.pronunciation_notes_zh || "", accepted_intents: (question.accepted_intents || []).join("\n") });
    const update = (key, value) => { setForm(current => ({ ...current, [key]: value })); setDirty(true); };
    const payload = () => ({ ...form, keywords: form.keywords.split(/[、,，]/).map(item => item.trim()).filter(Boolean), accepted_intents: form.accepted_intents.split("\n").map(item => item.trim()).filter(Boolean) });
    return <article className="speaking-question-editor"><div className="platform-form">
        <section className="speaking-editor-section"><div className="speaking-editor-section__heading"><strong>學生看到的內容</strong><span className={dirty ? "unsaved" : ""}>{dirty ? "尚未儲存" : "必填"}</span></div>
            {visual && <figure className="speaking-admin-question-visual"><img src={visual.src} alt={visual.alt} width="640" height="420" /><figcaption>教材 P{visual.sourcePage} · 學生題目圖片</figcaption></figure>}
            <label><span>AI 要問學生的問題</span><input value={form.question_text} onChange={event => update("question_text", event.target.value)} disabled={disabled} /></label>
            <label><span>中文提示</span><input value={form.hint_zh} onChange={event => update("hint_zh", event.target.value)} disabled={disabled} /></label>
            <label><span>簡易回答</span><textarea rows="2" value={form.simple_answer} onChange={event => update("simple_answer", event.target.value)} disabled={disabled} /></label>
            <label><span>完整示範回答</span><textarea rows="3" value={form.model_answer} onChange={event => update("model_answer", event.target.value)} disabled={disabled} /></label>
        </section>
        <details className="speaking-editor-advanced"><summary>語音與教學設定</summary><div className="speaking-editor-advanced__body">
            <label><span>延伸問題</span><input value={form.follow_up_question} onChange={event => update("follow_up_question", event.target.value)} disabled={disabled} /></label>
            <label><span>發音／重音提示</span><textarea rows="3" value={form.pronunciation_notes_zh} onChange={event => update("pronunciation_notes_zh", event.target.value)} disabled={disabled} /></label>
        </div></details>
        <details className="speaking-editor-advanced"><summary>AI 評分規則</summary><div className="speaking-editor-advanced__body platform-form-grid">
            <label><span>關鍵字（用、分隔）</span><input value={form.keywords} onChange={event => update("keywords", event.target.value)} disabled={disabled} /></label>
            <label><span>可接受回答意思（每行一項）</span><textarea rows="3" value={form.accepted_intents} onChange={event => update("accepted_intents", event.target.value)} disabled={disabled} /></label>
        </div></details>
        {!disabled && <div className="speaking-editor-actions"><button type="button" className="platform-secondary" onClick={async () => { if (await onSave(question.id, payload())) setDirty(false); }}><Save size={17} />儲存本題</button><button type="button" className="platform-primary" onClick={() => onSaveAndNext(question.id, payload())}><Save size={17} />{hasNext ? "儲存並下一題" : "儲存並完成檢查"}</button></div>}
    </div></article>;
};

export default function SpeakingContentAdmin() {
    const { firebaseUser } = useAuth();
    const [data, setData] = useState({ books: [], documents: [], chunks: [], sections: [], question_sets: [] });
    const [working, setWorking] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedBookCode, setSelectedBookCode] = useState("workbook1");
    const [activeSetId, setActiveSetId] = useState(null);
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);

    const load = useCallback(async () => {
        if (!firebaseUser) return null;
        setLoading(true);
        try { const value = await getSpeakingContentBootstrap(firebaseUser); setData(value); return value; }
        catch (error) { toast.error(error.message || "口說題庫資料讀取失敗"); return null; }
        finally { setLoading(false); }
    }, [firebaseUser]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (!previewOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = event => { if (event.key === "Escape") setPreviewOpen(false); };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
    }, [previewOpen]);

    const booksByCode = useMemo(() => new Map(data.books.map(book => [normalizeBookCode(book), book])), [data.books]);
    const setsByTemplate = useMemo(() => {
        const map = new Map();
        data.question_sets.forEach(set => { const key = set.generation_metadata?.template_key; const old = map.get(key); if (key && (!old || Number(set.version || 0) >= Number(old.version || 0))) map.set(key, set); });
        return map;
    }, [data.question_sets]);
    const bookDefinition = CURATED_BOOKS.find(book => book.code === selectedBookCode) || CURATED_BOOKS[0];
    const curatedRows = bookDefinition.challenges.map(challenge => ({ ...challenge, questionSet: setsByTemplate.get(challenge.templateKey) || null }));
    const selectedBook = booksByCode.get(selectedBookCode);
    const knownTemplates = new Set(CURATED_BOOKS.flatMap(book => book.challenges.map(challenge => challenge.templateKey)));
    const otherSets = new Map();
    data.question_sets.forEach(set => {
        if (knownTemplates.has(set.generation_metadata?.template_key)) return;
        const section = data.sections.find(item => item.id === set.source_section_id);
        const document = data.documents.find(item => item.id === section?.document_id);
        if (!selectedBook || document?.book_id !== selectedBook.id) return;
        const key = set.source_section_id || set.title;
        const old = otherSets.get(key);
        if (!old || Number(set.version || 0) >= Number(old.version || 0)) otherSets.set(key, set);
    });
    const rows = [...curatedRows, ...[...otherSets.values()].map((set, index) => ({
        templateKey: `existing-${set.id}`, number: `E${index + 1}`, title: set.title,
        description: `既有題庫 · 第 ${set.version} 版`, expectedCount: sortedQuestions(set).length,
        questionSet: set, existingOnly: true
    }))];
    const counts = rows.reduce((value, row) => { const key = statusMeta(row.questionSet).className; value[key] = (value[key] || 0) + 1; return value; }, {});
    const activeSet = data.question_sets.find(set => set.id === activeSetId) || null;
    const questions = useMemo(() => sortedQuestions(activeSet), [activeSet]);
    const activeQuestion = questions[activeQuestionIndex] || null;

    const openSet = (set, index = 0) => { setActiveSetId(set.id); setActiveQuestionIndex(Math.max(0, Math.min(index, sortedQuestions(set).length - 1))); setPreviewOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
    const createChallenge = async challenge => {
        const book = booksByCode.get(selectedBookCode);
        if (!book) return toast.error(`目前教材清單找不到 ${bookDefinition.label}`);
        const key = `create-${challenge.templateKey}`;
        setWorking(key);
        try {
            let result;
            if (challenge.creator === "workbookOneStarter") result = await createWorkbookOneStarterQuestionSet(firebaseUser, book.id);
            else if (challenge.creator === "workbookOneGreetings") result = await createWorkbookOneGreetingsQuestionSet(firebaseUser, book.id);
            else if (challenge.creator === "workbookOneFollowup") result = await createWorkbookOneCuratedQuestionSet(firebaseUser, book.id, challenge.action);
            else result = await createWorkbookTwoStarterQuestionSet(firebaseUser, book.id);
            const refreshed = await load();
            const created = refreshed?.question_sets?.filter(set => set.generation_metadata?.template_key === challenge.templateKey).sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
            toast.success(result?.reused ? `關卡 ${challenge.number} 已存在，已開啟目前版本` : `關卡 ${challenge.number} 草稿已建立`);
            if (created) openSet(created);
        } catch (error) { toast.error(error.message || `關卡 ${challenge.number} 建立失敗`); }
        finally { setWorking(""); }
    };
    const saveQuestion = async (id, question, moveNext = false) => {
        setWorking(`question-${id}`);
        try { await updateDraftSpeakingQuestion(firebaseUser, { question_id: id, question }); await load(); toast.success("題目已更新"); if (moveNext && activeQuestionIndex < questions.length - 1) { setActiveQuestionIndex(index => index + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } return true; }
        catch (error) { toast.error(error.message); return false; }
        finally { setWorking(""); }
    };
    const publish = async set => {
        if (!window.confirm(`確定發布「${set.title}」嗎？發布後不能直接修改。`)) return;
        setWorking(`publish-${set.id}`);
        let published = false;
        try { await publishSpeakingQuestionSet(firebaseUser, set.id); published = true; const audio = await generateSpeakingQuestionSetAudio(firebaseUser, set.id); audio.failed > 0 ? toast.warning(`題庫已發布，但有 ${audio.failed} 題語音尚未完成`) : toast.success(`題庫與示範語音已發布`); await load(); }
        catch (error) { toast[published ? "warning" : "error"](published ? `題庫已發布，但語音尚未完成：${error.message || "請稍後重試"}` : error.message || "題庫發布失敗"); await load(); }
        finally { setWorking(""); }
    };
    const generateAudio = async set => {
        setWorking(`audio-${set.id}`);
        try { const audio = await generateSpeakingQuestionSetAudio(firebaseUser, set.id); audio.failed > 0 ? toast.warning(`仍有 ${audio.failed} 題語音尚未完成`) : toast.success("問題與回答語音已完成"); }
        catch (error) { toast.error(error.message || "問題與回答語音產生失敗"); }
        finally { setWorking(""); }
    };

    if (activeSet) {
        const meta = statusMeta(activeSet);
        const incomplete = questions.map((question, index) => !isQuestionComplete(question) ? index + 1 : null).filter(Boolean);
        return <main className="platform-page speaking-content-admin speaking-content-editor">
            <header className="speaking-editor-header"><button type="button" className="speaking-back-button" onClick={() => setActiveSetId(null)}><ArrowLeft size={18} />返回關卡總覽</button><div className="speaking-editor-header__title"><span>{bookDefinition.label} · 第 {activeSet.version} 版</span><h1>{activeSet.title}</h1></div><div className="speaking-editor-header__actions"><span className={`speaking-status ${meta.className}`}>{meta.label}</span><button type="button" className="platform-secondary" onClick={() => setPreviewOpen(true)}><Eye size={17} />預覽學生畫面</button>{activeSet.status === "draft" && <button type="button" className="platform-primary" disabled={working === `publish-${activeSet.id}` || incomplete.length > 0} onClick={() => publish(activeSet)}>{working === `publish-${activeSet.id}` ? <LoaderCircle className="speaking-spin" size={17} /> : <CheckCircle2 size={17} />}發布題庫</button>}{activeSet.status === "published" && <button type="button" className="platform-secondary" disabled={working === `audio-${activeSet.id}`} onClick={() => generateAudio(activeSet)}><Volume2 size={17} />補產生示範語音</button>}</div></header>
            {incomplete.length > 0 && <div className="speaking-editor-warning"><AlertTriangle size={18} /><span>第 {incomplete.join("、")} 題尚未填完必要內容，完成後才能發布。</span></div>}
            <section className="speaking-editor-layout"><aside className="speaking-question-nav" aria-label="題目導覽"><div><strong>題目導覽</strong><span>{activeQuestionIndex + 1} / {questions.length}</span></div><nav>{questions.map((question, index) => <button type="button" key={question.id} className={`${index === activeQuestionIndex ? "active" : ""} ${isQuestionComplete(question) ? "complete" : "incomplete"}`} onClick={() => { setActiveQuestionIndex(index); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-current={index === activeQuestionIndex ? "step" : undefined}><span>Q{index + 1}</span>{isQuestionComplete(question) ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</button>)}</nav></aside>
                <section className="speaking-editor-main"><header className="speaking-editor-main__heading"><div><span>第 {activeQuestionIndex + 1} 題，共 {questions.length} 題</span><h2>{activeQuestion?.question_text || "尚未填寫題目"}</h2></div><div className="speaking-question-stepper"><button type="button" disabled={activeQuestionIndex === 0} onClick={() => setActiveQuestionIndex(index => index - 1)} aria-label="上一題"><ChevronLeft size={19} /></button><button type="button" disabled={activeQuestionIndex >= questions.length - 1} onClick={() => setActiveQuestionIndex(index => index + 1)} aria-label="下一題"><ChevronRight size={19} /></button></div></header>
                    {activeQuestion ? <QuestionEditor key={activeQuestion.id} question={activeQuestion} disabled={activeSet.status !== "draft" || working === `question-${activeQuestion.id}`} onSave={(id, value) => saveQuestion(id, value)} onSaveAndNext={(id, value) => saveQuestion(id, value, true)} hasNext={activeQuestionIndex < questions.length - 1} /> : <div className="platform-empty"><BookOpen /><strong>這個題庫還沒有題目</strong></div>}
                </section></section>
            {previewOpen && <div className="platform-modal-backdrop speaking-preview-modal" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewOpen(false); }}><section className="platform-modal" role="dialog" aria-modal="true" aria-labelledby="speaking-preview-title"><div className="speaking-preview-modal__heading"><div><span>學生畫面</span><h2 id="speaking-preview-title">{activeSet.title}</h2></div><button type="button" onClick={() => setPreviewOpen(false)} aria-label="關閉學生預覽"><X size={21} /></button></div><StudentQuestionSetPreview questionSet={activeSet} firebaseUser={firebaseUser} /></section></div>}
        </main>;
    }

    return <main className="platform-page speaking-content-admin"><header className="platform-hero speaking-content-hero"><div><span className="platform-eyebrow">SPEAKING CONTENT</span><h1>教材 AI 口說題庫</h1><p>選擇教材與關卡，建立、編輯及發布口說題目與示範語音。</p></div></header>
        <section className="platform-card speaking-catalog"><header className="speaking-catalog__toolbar"><div><span className="platform-eyebrow">CHALLENGE MANAGER</span><h2>關卡總覽</h2><p>先選教材，再查看每個主題目前的製作狀態。</p></div><label><span>教材</span><select value={selectedBookCode} onChange={event => setSelectedBookCode(event.target.value)}>{CURATED_BOOKS.map(book => <option key={book.code} value={book.code}>{book.label}</option>)}</select></label></header>
            <div className="speaking-catalog__summary" aria-label="關卡統計"><span><strong>{rows.length}</strong>全部關卡</span><span className="published"><strong>{counts.published || 0}</strong>已發布</span><span className="draft"><strong>{(counts.draft || 0) + (counts.ready || 0)}</strong>草稿</span><span className="empty"><strong>{counts.empty || 0}</strong>未建立</span></div>
            {!booksByCode.get(selectedBookCode) && !loading && <div className="speaking-catalog__warning"><AlertTriangle size={18} />目前教材清單找不到 {bookDefinition.label}，請先確認教材已啟用。</div>}
            {loading ? <div className="platform-loading">題庫載入中…</div> : <div className="speaking-catalog__list"><div className="speaking-catalog__labels" aria-hidden="true"><span>關卡與主題</span><span>題目</span><span>狀態</span><span>操作</span></div>{rows.map(row => { const meta = statusMeta(row.questionSet); const count = row.questionSet ? sortedQuestions(row.questionSet).length : row.expectedCount; const key = `create-${row.templateKey}`; return <article className="speaking-catalog-row" key={row.templateKey}><div className="speaking-catalog-row__topic"><span>{row.number}</span><div><h3>{row.title}</h3><p>{row.description}</p></div></div><div className="speaking-catalog-row__count"><strong>{count}</strong><span>{row.questionSet ? "題" : "預計題數"}</span></div><span className={`speaking-status ${meta.className}`}>{meta.label}</span>{row.questionSet ? <button type="button" className="platform-secondary" onClick={() => openSet(row.questionSet)}>{row.questionSet.status === "published" ? <Eye size={17} /> : <Mic2 size={17} />}{row.questionSet.status === "published" ? "查看題庫" : "繼續編輯"}</button> : <button type="button" className="platform-primary" disabled={!booksByCode.get(selectedBookCode) || working === key} onClick={() => createChallenge(row)}>{working === key ? <LoaderCircle className="speaking-spin" size={17} /> : <Sparkles size={17} />}{working === key ? "建立中…" : "建立草稿"}</button>}</article>; })}</div>}
        </section></main>;
}
