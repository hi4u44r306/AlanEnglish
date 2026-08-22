import React, { useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import {
    FiAward,
    FiBookOpen,
    FiCheckCircle,
    FiClock,
    FiEdit3,
    FiFeather,
    FiFolder,
    FiHeadphones,
    FiHeart,
    FiRefreshCw,
    FiRotateCcw,
    FiSend,
    FiStar,
    FiXCircle,
    FiZap
} from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import {
    generateAiMaterial,
    getAiMaterialHistory,
    getAiMaterialUsage,
    markAiMaterialReviewed,
    submitAiMaterialAttempt,
    updateAiMaterialFavorite
} from "../../services/aiMaterialService";
import ListeningTTSPlayer from "./ListeningTTSPlayer";
import "./css/AIMaterialGenerator.scss";

const MATERIAL_TYPES = [
    { id: "reading", title: "閱讀理解", description: "文章、重點單字與閱讀題", icon: FiBookOpen },
    { id: "vocabulary", title: "單字練習", description: "單字、例句與情境題", icon: FiFeather },
    { id: "grammar", title: "文法練習", description: "依程度產生文法應用題", icon: FiEdit3 },
    { id: "listening", title: "聽力測驗", description: "先聽英文，再完成理解題", icon: FiHeadphones },
    { id: "custom", title: "自訂教材", description: "告訴 AI 你想練習什麼", icon: FiStar }
];

const DIFFICULTIES = [
    { value: "國小低年級", label: "國小低年級（1～2 年級）" },
    { value: "國小中年級", label: "國小中年級（3～4 年級）" },
    { value: "國小高年級", label: "國小高年級（5～6 年級）" },
    { value: "國中基礎", label: "國中基礎（七年級）" }
];
const DEFAULT_PASSING_SCORE = 90;

const formatDate = value => {
    if (!value) return "";
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date(value));
};

const getTypeLabel = type => MATERIAL_TYPES.find(item => item.id === type)?.title || "AI 教材";

function AIMaterialGenerator() {
    const { firebaseUser } = useAuth();
    const [activeTab, setActiveTab] = useState("generator");
    const [materialType, setMaterialType] = useState("reading");
    const [difficulty, setDifficulty] = useState("國小中年級");
    const [topic, setTopic] = useState("");
    const [questionCount, setQuestionCount] = useState(5);
    const [customRequest, setCustomRequest] = useState("");
    const [usage, setUsage] = useState({ used: 0, limit: 5, remaining: 5, role: "student" });
    const [passingScore, setPassingScore] = useState(DEFAULT_PASSING_SCORE);
    const [material, setMaterial] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [answers, setAnswers] = useState({});
    const [attemptResult, setAttemptResult] = useState(null);
    const [loadingUsage, setLoadingUsage] = useState(true);
    const [loadingLibrary, setLoadingLibrary] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [submittingAttempt, setSubmittingAttempt] = useState(false);
    const [libraryActionId, setLibraryActionId] = useState(null);
    const [error, setError] = useState("");

    const selectedType = useMemo(
        () => MATERIAL_TYPES.find(type => type.id === materialType),
        [materialType]
    );

    const favoriteMaterials = useMemo(
        () => materials.filter(item => item.is_favorite),
        [materials]
    );

    const visibleMaterials = activeTab === "favorites" ? favoriteMaterials : materials;

    const roleLabel = useMemo(() => {
        if (usage.role === "admin") return "管理者";
        if (usage.role === "teacher") return "老師";
        return "學生";
    }, [usage.role]);

    const content = material?.content || null;
    const questions = Array.isArray(content?.questions) ? content.questions : [];
    const answeredCount = questions.filter((_, index) => Boolean(answers[index])).length;
    const allAnswered = questions.length > 0 && answeredCount === questions.length;

    useEffect(() => {
        const loadData = async () => {
            if (!firebaseUser) return;
            setLoadingUsage(true);
            setLoadingLibrary(true);
            setError("");

            try {
                const [usageResult, historyResult] = await Promise.all([
                    getAiMaterialUsage(firebaseUser),
                    getAiMaterialHistory(firebaseUser)
                ]);

                if (usageResult?.usage) setUsage(usageResult.usage);
                if (usageResult?.passing_score) setPassingScore(usageResult.passing_score);
                if (historyResult?.materials) setMaterials(historyResult.materials);
                if (historyResult?.usage) setUsage(historyResult.usage);
                if (historyResult?.passing_score) setPassingScore(historyResult.passing_score);
            } catch (loadError) {
                console.error("AI material load error:", loadError);
                setError(loadError.message);
            } finally {
                setLoadingUsage(false);
                setLoadingLibrary(false);
            }
        };

        loadData();
    }, [firebaseUser]);

    const resetQuiz = () => {
        setAnswers({});
        setAttemptResult(null);
    };

    const scrollToMaterial = () => {
        window.setTimeout(() => {
            document.getElementById("ai-material-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    };

    const handleGenerate = async event => {
        event.preventDefault();
        setError("");

        if (materialType !== "custom" && !topic.trim()) {
            setError("請先輸入想練習的主題。");
            return;
        }
        if (materialType === "custom" && !customRequest.trim()) {
            setError("請告訴 AI 你想生成什麼教材。");
            return;
        }
        if (usage.remaining <= 0) {
            setError(`今天的 ${usage.limit} 次 AI 生成額度已經使用完畢，明天再回來練習吧！`);
            return;
        }

        setGenerating(true);
        resetQuiz();

        try {
            const result = await generateAiMaterial(firebaseUser, {
                material_type: materialType,
                difficulty,
                topic: topic.trim(),
                question_count: questionCount,
                custom_request: customRequest.trim()
            });

            if (result?.material) {
                setMaterial(result.material);
                setMaterials(current => [result.material, ...current.filter(item => item.id !== result.material.id)]);
            }
            if (result?.usage) setUsage(result.usage);
            if (result?.passing_score) setPassingScore(result.passing_score);
            scrollToMaterial();
        } catch (generateError) {
            console.error("AI material generate error:", generateError);
            if (generateError?.usage) setUsage(generateError.usage);
            setError(generateError.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleOpenMaterial = async savedMaterial => {
        setMaterial(savedMaterial);
        setError("");
        resetQuiz();
        setLibraryActionId(savedMaterial.id);

        try {
            const result = await markAiMaterialReviewed(firebaseUser, savedMaterial.id);
            if (result?.material) {
                setMaterials(current => current.map(item => (
                    item.id === savedMaterial.id ? { ...item, ...result.material } : item
                )));
                setMaterial(current => current?.id === savedMaterial.id ? { ...current, ...result.material } : current);
            }
        } catch (reviewError) {
            console.error("AI material review update error:", reviewError);
        } finally {
            setLibraryActionId(null);
        }

        scrollToMaterial();
    };

    const handleFavorite = async savedMaterial => {
        if (libraryActionId) return;
        const nextValue = !savedMaterial.is_favorite;
        setLibraryActionId(savedMaterial.id);

        try {
            const result = await updateAiMaterialFavorite(firebaseUser, savedMaterial.id, nextValue);
            const value = result?.material?.is_favorite ?? nextValue;
            setMaterials(current => current.map(item => (
                item.id === savedMaterial.id ? { ...item, is_favorite: value } : item
            )));
            setMaterial(current => current?.id === savedMaterial.id ? { ...current, is_favorite: value } : current);
        } catch (favoriteError) {
            console.error("AI favorite update error:", favoriteError);
            setError(favoriteError.message);
        } finally {
            setLibraryActionId(null);
        }
    };

    const handleAnswer = (questionIndex, option) => {
        if (attemptResult) return;
        setAnswers(current => ({ ...current, [questionIndex]: option }));
    };

    const handleSubmitAttempt = async () => {
        if (!material?.id || submittingAttempt) return;
        if (!allAnswered) {
            setError(`還有 ${questions.length - answeredCount} 題尚未作答，請完成所有題目再提交。`);
            return;
        }

        setSubmittingAttempt(true);
        setError("");

        try {
            const orderedAnswers = questions.map((_, index) => answers[index]);
            const result = await submitAiMaterialAttempt(firebaseUser, material.id, orderedAnswers);
            setAttemptResult(result?.result || null);

            if (result?.progress) {
                setMaterials(current => current.map(item => (
                    item.id === material.id ? { ...item, progress: result.progress } : item
                )));
                setMaterial(current => current?.id === material.id
                    ? { ...current, progress: result.progress }
                    : current
                );
            }

            window.setTimeout(() => {
                document.getElementById("ai-quiz-score")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
        } catch (submitError) {
            console.error("AI material submit error:", submitError);
            setError(submitError.message);
        } finally {
            setSubmittingAttempt(false);
        }
    };

    const handleRetry = () => {
        resetQuiz();
        setError("");
        document.getElementById("ai-quiz")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const renderLibrary = () => (
        <section className="ai-library-shell">
            <div className="ai-library-heading">
                <div>
                    <span className="ai-eyebrow"><FiFolder /> MY AI MATERIALS</span>
                    <h2>{activeTab === "favorites" ? "收藏教材" : "我的 AI 教材庫"}</h2>
                    <p>{activeTab === "favorites" ? "把最值得再次練習的教材集中在這裡。" : "生成過的教材都保存在這裡，重新作答不會再扣 AI 額度。"}</p>
                </div>
                <div className="ai-library-stat"><strong>{visibleMaterials.length}</strong><span>{activeTab === "favorites" ? "收藏" : "份教材"}</span></div>
            </div>

            {loadingLibrary ? (
                <div className="ai-library-empty">教材庫載入中...</div>
            ) : visibleMaterials.length === 0 ? (
                <div className="ai-library-empty">
                    <FiFolder />
                    <strong>{activeTab === "favorites" ? "目前沒有收藏教材" : "還沒有 AI 教材"}</strong>
                    <span>生成第一份教材後就會自動出現在這裡。</span>
                </div>
            ) : (
                <div className="ai-library-grid">
                    {visibleMaterials.map(item => {
                        const progress = item.progress || {};
                        return (
                            <article className="ai-library-card" key={item.id}>
                                <div className="ai-library-card-top">
                                    <span>{getTypeLabel(item.material_type)}</span>
                                    <button type="button" className={item.is_favorite ? "favorite" : ""} onClick={() => handleFavorite(item)} disabled={libraryActionId === item.id} aria-label={item.is_favorite ? "取消收藏" : "加入收藏"}>
                                        <FiHeart />
                                    </button>
                                </div>
                                <h3>{item.title}</h3>
                                <p>{item.topic || item.content?.subtitle || "Alan English AI 教材"}</p>
                                <div className="ai-library-meta">
                                    <span><FiClock /> {formatDate(item.created_at)}</span>
                                    <span>{item.difficulty}</span>
                                </div>
                                <div className="ai-library-progress">
                                    <span className={progress.completed ? "passed" : "pending"}>{progress.completed ? <><FiCheckCircle /> 已完成</> : <>尚未完成</>}</span>
                                    <span>最高 {Number(progress.best_score || 0)} 分</span>
                                    <span>作答 {Number(progress.attempt_count || 0)} 次</span>
                                </div>
                                <button type="button" className="ai-library-open" onClick={() => handleOpenMaterial(item)} disabled={libraryActionId === item.id}>
                                    {progress.attempt_count > 0 ? "再次練習" : "開始作答"}
                                </button>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );

    return (
        <main className="ai-studio">
            <section className="ai-studio-hero">
                <div className="ai-studio-hero-copy">
                    <span className="ai-eyebrow"><FiStar /> ALAN ENGLISH AI</span>
                    <h1>把你想練的英文，<br /><span>變成專屬教材。</span></h1>
                    <p>所有 AI 教材都可以真正作答；Listening 類型會直接使用免費英文語音播放。完成所有題目後才會批改，達到 {passingScore} 分以上才算完成。</p>
                </div>
                <div className="ai-quota-card">
                    <div className="ai-quota-heading">
                        <div><span>{roleLabel} · 今日 AI 額度</span><strong>{loadingUsage ? "—" : `${usage.remaining} 次`}</strong></div>
                        <div className="ai-quota-icon"><FiZap /></div>
                    </div>
                    <div className="ai-quota-dots" style={{ gridTemplateColumns: `repeat(${Math.max(1, usage.limit || 5)}, 1fr)` }}>
                        {Array.from({ length: usage.limit || 5 }).map((_, index) => <span key={index} className={index < usage.used ? "used" : "available"} />)}
                    </div>
                    <p>今天已使用 {usage.used} / {usage.limit} 次 · 成功生成才扣額度</p>
                </div>
            </section>

            <section className="ai-workspace-tabs">
                <button type="button" className={activeTab === "generator" ? "active" : ""} onClick={() => setActiveTab("generator")}><FiStar /><span>生成教材</span></button>
                <button type="button" className={activeTab === "library" ? "active" : ""} onClick={() => setActiveTab("library")}><FiFolder /><span>我的教材</span><small>{materials.length}</small></button>
                <button type="button" className={activeTab === "favorites" ? "active" : ""} onClick={() => setActiveTab("favorites")}><FiHeart /><span>收藏教材</span><small>{favoriteMaterials.length}</small></button>
            </section>

            {error && activeTab !== "generator" && <div className="ai-library-error">{error}</div>}

            {activeTab === "generator" ? (
                <section className="ai-generator-shell">
                    <form className="ai-generator-panel" onSubmit={handleGenerate}>
                        <div className="ai-section-heading"><span>STEP 01</span><h2>想練習什麼？</h2><p>選擇教材類型，AI 會產生四選一題目供學生實際作答。</p></div>
                        <div className="ai-type-grid">
                            {MATERIAL_TYPES.map(type => {
                                const Icon = type.icon;
                                const active = materialType === type.id;
                                return (
                                    <button type="button" key={type.id} className={`ai-type-card ${active ? "active" : ""}`} onClick={() => setMaterialType(type.id)}>
                                        <span className="ai-type-icon"><Icon /></span><strong>{type.title}</strong><small>{type.description}</small>{active && <FiCheckCircle className="ai-type-check" />}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="ai-divider" />
                        <div className="ai-section-heading compact"><span>STEP 02</span><h2>設定你的教材</h2></div>
                        <div className="ai-form-grid">
                            <label className="ai-field"><span>學生程度</span><select value={difficulty} onChange={event => setDifficulty(event.target.value)}>{DIFFICULTIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                            <label className="ai-field"><span>題目數量</span><select value={questionCount} onChange={event => setQuestionCount(Number(event.target.value))}>{[5, 8, 10, 15].map(count => <option key={count} value={count}>{count} 題</option>)}</select></label>
                        </div>
                        {materialType !== "custom" && <label className="ai-field ai-field-full"><span>教材主題</span><input type="text" value={topic} onChange={event => setTopic(event.target.value)} placeholder={materialType === "grammar" ? "例如：過去式、比較級、介系詞" : "例如：動物、太空、旅行、運動"} maxLength={120} /></label>}
                        <label className="ai-field ai-field-full"><span>{materialType === "custom" ? "告訴 AI 你想要什麼" : "額外需求（選填）"}</span><textarea value={customRequest} onChange={event => setCustomRequest(event.target.value)} placeholder={materialType === "custom" ? "例如：我要國小五年級程度，主題是去日本旅行，要有單字、短文和閱讀理解題。" : "例如：希望多練習疑問句，題目不要太難。"} rows={4} maxLength={600} /></label>
                        {error && <div className="ai-error-message">{error}</div>}
                        <button type="submit" className="ai-generate-button" disabled={generating || loadingUsage || usage.remaining <= 0}>{generating ? <><FiRefreshCw className="ai-spin" /> AI 正在製作教材...</> : <><FiStar /> 生成 {selectedType?.title || "AI 教材"}</>}</button>
                        <p className="ai-generate-note">成功生成後自動保存；重新開啟與重新作答既有教材不扣 AI 生成額度。</p>
                    </form>
                </section>
            ) : renderLibrary()}

            {content && (
                <section className="ai-result" id="ai-material-result">
                    <div className="ai-result-header">
                        <div><span className="ai-eyebrow"><FiStar /> {material?.progress?.completed ? "COMPLETED MATERIAL" : "AI PRACTICE"}</span><h2>{content.title || material?.title}</h2>{content.subtitle && <p>{content.subtitle}</p>}</div>
                        <div className="ai-result-badges"><span className="ai-result-level">{material?.difficulty}</span>{material?.progress?.completed && <span className="ai-completed-badge"><FiAward /> 已完成</span>}</div>
                    </div>

                    {material?.material_type === "listening" && content.passage && (
                        <article className="ai-result-block">
                            <span className="ai-result-number">01</span>
                            <div className="ai-result-content-wide">
                                <ListeningTTSPlayer script={content.passage} />
                            </div>
                        </article>
                    )}

                    {material?.material_type !== "listening" && content.passage && (
                        <article className="ai-result-block ai-passage"><span className="ai-result-number">01</span><div><h3>Reading</h3><p>{content.passage}</p></div></article>
                    )}

                    {Array.isArray(content.vocabulary) && content.vocabulary.length > 0 && (
                        <article className="ai-result-block">
                            <span className="ai-result-number">02</span>
                            <div className="ai-result-content-wide"><h3>Vocabulary</h3><div className="ai-vocabulary-grid">{content.vocabulary.map((item, index) => <div className="ai-vocabulary-card" key={`${item.word}-${index}`}><strong>{item.word}</strong><span>{item.meaning}</span><p>{item.example}</p></div>)}</div></div>
                        </article>
                    )}

                    {questions.length > 0 && (
                        <article className="ai-result-block ai-quiz-block" id="ai-quiz">
                            <span className="ai-result-number">03</span>
                            <div className="ai-result-content-wide">
                                <div className="ai-quiz-heading"><div><h3>Practice Quiz</h3><p>先完成全部題目再提交。作答前不會顯示答案，{passingScore} 分以上才算完成。</p></div><span>{answeredCount} / {questions.length} 已作答</span></div>
                                <div className="ai-quiz-list">
                                    {questions.map((question, questionIndex) => {
                                        const feedback = attemptResult?.feedback?.find(item => item.index === questionIndex);
                                        return (
                                            <section className="ai-quiz-question" key={questionIndex}>
                                                <div className="ai-quiz-question-title"><span>Q{questionIndex + 1}</span><strong>{question.question}</strong></div>
                                                <div className="ai-quiz-options">
                                                    {(question.options || []).map((option, optionIndex) => {
                                                        const selected = answers[questionIndex] === option;
                                                        const isCorrectOption = Boolean(attemptResult && feedback?.correct_answer === option);
                                                        const isWrongSelected = Boolean(attemptResult && selected && !feedback?.is_correct);
                                                        const optionClass = ["ai-quiz-option", selected ? "selected" : "", isCorrectOption ? "correct" : "", isWrongSelected ? "wrong" : ""].filter(Boolean).join(" ");
                                                        return <button type="button" key={`${questionIndex}-${optionIndex}`} className={optionClass} onClick={() => handleAnswer(questionIndex, option)} disabled={Boolean(attemptResult)}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong>{attemptResult && isCorrectOption && <FiCheckCircle />}{attemptResult && isWrongSelected && <FiXCircle />}</button>;
                                                    })}
                                                </div>
                                                {attemptResult && feedback && <div className={`ai-quiz-feedback ${feedback.is_correct ? "correct" : "wrong"}`}><strong>{feedback.is_correct ? "答對了！" : `正確答案：${feedback.correct_answer}`}</strong>{feedback.explanation && <p>{feedback.explanation}</p>}</div>}
                                            </section>
                                        );
                                    })}
                                </div>

                                {!attemptResult ? (
                                    <div className="ai-quiz-submit-area"><div><strong>完成標準：{passingScore} 分</strong><span>{allAnswered ? "全部題目已完成，可以提交答案。" : `還有 ${questions.length - answeredCount} 題尚未作答。`}</span></div><button type="button" onClick={handleSubmitAttempt} disabled={!allAnswered || submittingAttempt}>{submittingAttempt ? <><FiRefreshCw className="ai-spin" /> 批改中...</> : <><FiSend /> 提交答案</>}</button></div>
                                ) : (
                                    <div className={`ai-quiz-score ${attemptResult.passed ? "passed" : "failed"}`} id="ai-quiz-score">
                                        <div className="ai-quiz-score-number"><strong>{attemptResult.score}</strong><span>分</span></div>
                                        <div className="ai-quiz-score-copy"><span>{attemptResult.passed ? <><FiAward /> 恭喜完成教材</> : <><FiRotateCcw /> 還差一點</>}</span><h4>{attemptResult.correct_count} / {attemptResult.total_questions} 題答對</h4><p>{attemptResult.passed ? `已達 ${passingScore} 分完成標準，這份教材已記錄為完成。` : `需要 ${passingScore} 分以上才算完成，可以查看錯題後再挑戰一次。`}</p></div>
                                        <button type="button" onClick={handleRetry}><FiRotateCcw /> 再挑戰一次</button>
                                    </div>
                                )}
                            </div>
                        </article>
                    )}

                    {content.study_tip && <div className="ai-study-tip"><FiZap /><div><strong>Alan's Tip</strong><p>{content.study_tip}</p></div></div>}
                </section>
            )}
        </main>
    );
}

export default AIMaterialGenerator;
