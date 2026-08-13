import React, { useEffect, useMemo, useState } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import {
    FiBookOpen,
    FiCheckCircle,
    FiClock,
    FiEdit3,
    FiFeather,
    FiFolder,
    FiHeadphones,
    FiHeart,
    FiRefreshCw,
    FiStar,
    FiZap
} from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import {
    generateAiMaterial,
    getAiMaterialHistory,
    getAiMaterialUsage,
    markAiMaterialReviewed,
    updateAiMaterialFavorite
} from "../../services/aiMaterialService";
import "./css/AIMaterialGenerator.scss";

const MATERIAL_TYPES = [
    { id: "reading", title: "閱讀理解", description: "文章、重點單字與閱讀題", icon: FiBookOpen },
    { id: "vocabulary", title: "單字練習", description: "單字、例句與情境題", icon: FiFeather },
    { id: "grammar", title: "文法練習", description: "依程度產生文法應用題", icon: FiEdit3 },
    { id: "listening", title: "聽力測驗", description: "聽力稿與理解問題", icon: FiHeadphones },
    { id: "custom", title: "自訂教材", description: "告訴 AI 你想練習什麼", icon: FiStar }
];

const DIFFICULTIES = ["國小低年級", "國小中年級", "國小高年級", "國中基礎"];

const formatDate = value => {
    if (!value) return "";
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date(value));
};

function AIMaterialGenerator() {
    const { firebaseUser } = useAuth();
    const [activeTab, setActiveTab] = useState("generator");
    const [materialType, setMaterialType] = useState("reading");
    const [difficulty, setDifficulty] = useState("國小中年級");
    const [topic, setTopic] = useState("");
    const [questionCount, setQuestionCount] = useState(5);
    const [customRequest, setCustomRequest] = useState("");
    const [usage, setUsage] = useState({ used: 0, limit: 5, remaining: 5, role: "student" });
    const [material, setMaterial] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [loadingUsage, setLoadingUsage] = useState(true);
    const [loadingLibrary, setLoadingLibrary] = useState(true);
    const [generating, setGenerating] = useState(false);
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
                if (historyResult?.materials) setMaterials(historyResult.materials);
                if (historyResult?.usage) setUsage(historyResult.usage);
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
        try {
            const result = await generateAiMaterial(firebaseUser, {
                material_type: materialType,
                difficulty,
                topic: topic.trim(),
                question_count: questionCount,
                custom_request: customRequest.trim()
            });

            setMaterial(result?.material || null);
            if (result?.usage) setUsage(result.usage);
            if (result?.material) {
                setMaterials(current => [result.material, ...current.filter(item => item.id !== result.material.id)]);
            }

            window.setTimeout(() => {
                document.getElementById("ai-material-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
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
        setLibraryActionId(savedMaterial.id);

        try {
            const result = await markAiMaterialReviewed(firebaseUser, savedMaterial.id);
            if (result?.material) {
                setMaterials(current => current.map(item => (
                    item.id === savedMaterial.id
                        ? { ...item, ...result.material }
                        : item
                )));
                setMaterial(current => current?.id === savedMaterial.id ? { ...current, ...result.material } : current);
            }
        } catch (reviewError) {
            console.error("AI material review update error:", reviewError);
        } finally {
            setLibraryActionId(null);
        }

        window.setTimeout(() => {
            document.getElementById("ai-material-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    };

    const handleFavorite = async savedMaterial => {
        if (libraryActionId) return;
        const nextValue = !savedMaterial.is_favorite;
        setLibraryActionId(savedMaterial.id);

        try {
            const result = await updateAiMaterialFavorite(firebaseUser, savedMaterial.id, nextValue);
            setMaterials(current => current.map(item => (
                item.id === savedMaterial.id
                    ? { ...item, is_favorite: result?.material?.is_favorite ?? nextValue }
                    : item
            )));
            setMaterial(current => current?.id === savedMaterial.id
                ? { ...current, is_favorite: result?.material?.is_favorite ?? nextValue }
                : current
            );
        } catch (favoriteError) {
            console.error("AI favorite update error:", favoriteError);
            setError(favoriteError.message);
        } finally {
            setLibraryActionId(null);
        }
    };

    const content = material?.content || null;

    return (
        <main className="ai-studio">
            <section className="ai-studio-hero">
                <div className="ai-studio-hero-copy">
                    <span className="ai-eyebrow"><FiStar /> ALAN ENGLISH AI</span>
                    <h1>把你想練的英文，<br /><span>變成專屬教材。</span></h1>
                    <p>生成後會自動存進你的 AI 教材庫，之後可以重新開啟、收藏與複習，不需要為同一份教材再次消耗生成額度。</p>
                </div>

                <div className="ai-quota-card">
                    <div className="ai-quota-heading">
                        <div>
                            <span>{roleLabel} · 今日 AI 額度</span>
                            <strong>{loadingUsage ? "—" : `${usage.remaining} 次`}</strong>
                        </div>
                        <div className="ai-quota-icon"><FiZap /></div>
                    </div>
                    <div
                        className="ai-quota-dots"
                        style={{ gridTemplateColumns: `repeat(${Math.max(1, usage.limit || 5)}, 1fr)` }}
                    >
                        {Array.from({ length: usage.limit || 5 }).map((_, index) => (
                            <span key={index} className={index < usage.used ? "used" : "available"} />
                        ))}
                    </div>
                    <p>今天已使用 {usage.used} / {usage.limit} 次 · 每日 00:00 重置</p>
                </div>
            </section>

            <section className="ai-workspace-tabs">
                <button
                    type="button"
                    className={activeTab === "generator" ? "active" : ""}
                    onClick={() => setActiveTab("generator")}
                >
                    <FiStar />
                    <span>生成教材</span>
                </button>
                <button
                    type="button"
                    className={activeTab === "library" ? "active" : ""}
                    onClick={() => setActiveTab("library")}
                >
                    <FiFolder />
                    <span>我的教材</span>
                    <small>{materials.length}</small>
                </button>
                <button
                    type="button"
                    className={activeTab === "favorites" ? "active" : ""}
                    onClick={() => setActiveTab("favorites")}
                >
                    <FiHeart />
                    <span>收藏教材</span>
                    <small>{favoriteMaterials.length}</small>
                </button>
            </section>

            {error && activeTab !== "generator" && (
                <div className="ai-library-error">{error}</div>
            )}

            {activeTab === "generator" ? (
                <section className="ai-generator-shell">
                    <form className="ai-generator-panel" onSubmit={handleGenerate}>
                        <div className="ai-section-heading">
                            <span>STEP 01</span>
                            <h2>想練習什麼？</h2>
                            <p>先選擇你希望 AI 幫你製作的教材類型。</p>
                        </div>

                        <div className="ai-type-grid">
                            {MATERIAL_TYPES.map(type => {
                                const Icon = type.icon;
                                const active = materialType === type.id;
                                return (
                                    <button
                                        type="button"
                                        key={type.id}
                                        className={`ai-type-card ${active ? "active" : ""}`}
                                        onClick={() => setMaterialType(type.id)}
                                    >
                                        <span className="ai-type-icon"><Icon /></span>
                                        <strong>{type.title}</strong>
                                        <small>{type.description}</small>
                                        {active && <FiCheckCircle className="ai-type-check" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="ai-divider" />

                        <div className="ai-section-heading compact">
                            <span>STEP 02</span>
                            <h2>設定你的教材</h2>
                        </div>

                        <div className="ai-form-grid">
                            <label className="ai-field">
                                <span>學生程度</span>
                                <select value={difficulty} onChange={event => setDifficulty(event.target.value)}>
                                    {DIFFICULTIES.map(item => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </label>

                            <label className="ai-field">
                                <span>題目數量</span>
                                <select value={questionCount} onChange={event => setQuestionCount(Number(event.target.value))}>
                                    {[5, 8, 10, 15].map(count => <option key={count} value={count}>{count} 題</option>)}
                                </select>
                            </label>
                        </div>

                        {materialType !== "custom" && (
                            <label className="ai-field ai-field-full">
                                <span>教材主題</span>
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={event => setTopic(event.target.value)}
                                    placeholder={materialType === "grammar" ? "例如：過去式、比較級、介系詞" : "例如：動物、太空、旅行、運動"}
                                    maxLength={120}
                                />
                            </label>
                        )}

                        <label className="ai-field ai-field-full">
                            <span>{materialType === "custom" ? "告訴 AI 你想要什麼" : "額外需求（選填）"}</span>
                            <textarea
                                value={customRequest}
                                onChange={event => setCustomRequest(event.target.value)}
                                placeholder={materialType === "custom" ? "例如：我要國小五年級程度，主題是去日本旅行，要有單字、短文和閱讀理解題。" : "例如：希望多練習疑問句，題目不要太難。"}
                                rows={4}
                                maxLength={600}
                            />
                        </label>

                        {error && <div className="ai-error-message">{error}</div>}

                        <button
                            type="submit"
                            className="ai-generate-button"
                            disabled={generating || loadingUsage || usage.remaining <= 0}
                        >
                            {generating
                                ? <><FiRefreshCw className="ai-spin" /> AI 正在製作教材...</>
                                : <><FiStar /> 生成 {selectedType?.title || "AI 教材"}</>
                            }
                        </button>
                        <p className="ai-generate-note">AI 成功完成並存入教材庫後才會扣除 1 次額度；生成失敗不扣次數。</p>
                    </form>
                </section>
            ) : (
                <section className="ai-library-shell">
                    <div className="ai-library-heading">
                        <div>
                            <span className="ai-eyebrow"><FiFolder /> MY AI MATERIALS</span>
                            <h2>{activeTab === "favorites" ? "收藏教材" : "我的 AI 教材庫"}</h2>
                            <p>{activeTab === "favorites" ? "把最值得再次練習的教材集中在這裡。" : "每次成功生成的教材都會自動保存在這裡，可以隨時重新開啟複習。"}</p>
                        </div>
                        <div className="ai-library-stat">
                            <strong>{visibleMaterials.length}</strong>
                            <span>{activeTab === "favorites" ? "收藏" : "份教材"}</span>
                        </div>
                    </div>

                    {loadingLibrary ? (
                        <div className="ai-library-empty"><FiRefreshCw className="ai-spin" /><p>正在載入你的 AI 教材庫...</p></div>
                    ) : visibleMaterials.length === 0 ? (
                        <div className="ai-library-empty">
                            {activeTab === "favorites" ? <FiHeart /> : <FiFolder />}
                            <h3>{activeTab === "favorites" ? "還沒有收藏教材" : "還沒有 AI 教材"}</h3>
                            <p>{activeTab === "favorites" ? "到「我的教材」把想重複練習的內容加入收藏。" : "先生成第一份教材，完成後會自動出現在這裡。"}</p>
                            <button type="button" onClick={() => setActiveTab("generator")}>開始生成教材</button>
                        </div>
                    ) : (
                        <div className="ai-library-grid">
                            {visibleMaterials.map(item => {
                                const typeInfo = MATERIAL_TYPES.find(type => type.id === item.material_type);
                                const TypeIcon = typeInfo?.icon || FiBookOpen;
                                const actionLoading = libraryActionId === item.id;

                                return (
                                    <article className="ai-library-card" key={item.id}>
                                        <div className="ai-library-card-top">
                                            <span className="ai-library-type"><TypeIcon />{typeInfo?.title || "AI 教材"}</span>
                                            <button
                                                type="button"
                                                className={`ai-favorite-button ${item.is_favorite ? "active" : ""}`}
                                                onClick={() => handleFavorite(item)}
                                                disabled={actionLoading}
                                                aria-label={item.is_favorite ? "取消收藏" : "加入收藏"}
                                            >
                                                <FiHeart />
                                            </button>
                                        </div>

                                        <h3>{item.title}</h3>
                                        <p className="ai-library-topic">{item.topic || item.content?.subtitle || "自訂教材"}</p>

                                        <div className="ai-library-meta">
                                            <span>{item.difficulty || "未設定程度"}</span>
                                            <span>{item.question_count || 0} 題</span>
                                            <span><FiClock /> {formatDate(item.created_at)}</span>
                                        </div>

                                        <div className="ai-library-review-info">
                                            <span>已複習 {item.review_count || 0} 次</span>
                                            {item.last_reviewed_at && <small>上次 {formatDate(item.last_reviewed_at)}</small>}
                                        </div>

                                        <button
                                            type="button"
                                            className="ai-review-button"
                                            onClick={() => handleOpenMaterial(item)}
                                            disabled={actionLoading}
                                        >
                                            {actionLoading ? <FiRefreshCw className="ai-spin" /> : <FiBookOpen />}
                                            開始複習
                                        </button>
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    <div className="ai-future-review-card">
                        <FiZap />
                        <div>
                            <strong>下一階段：AI 個人化複習</strong>
                            <p>目前已經開始累積教材與複習紀錄，之後可以利用原教材、複習次數與錯題紀錄產生新的複習內容。</p>
                        </div>
                    </div>
                </section>
            )}

            {content && (
                <section className="ai-result" id="ai-material-result">
                    <div className="ai-result-header">
                        <div>
                            <span className="ai-eyebrow"><FiStar /> {material?.id ? "SAVED MATERIAL" : "GENERATED FOR YOU"}</span>
                            <h2>{content.title}</h2>
                            {content.subtitle && <p>{content.subtitle}</p>}
                        </div>
                        <div className="ai-result-actions">
                            <span className="ai-result-level">{material?.difficulty}</span>
                            {material?.id && (
                                <button
                                    type="button"
                                    className={`ai-result-favorite ${material.is_favorite ? "active" : ""}`}
                                    onClick={() => handleFavorite(material)}
                                    disabled={libraryActionId === material.id}
                                >
                                    <FiHeart /> {material.is_favorite ? "已收藏" : "收藏"}
                                </button>
                            )}
                        </div>
                    </div>

                    {content.passage && (
                        <article className="ai-result-block ai-passage">
                            <span className="ai-result-number">01</span>
                            <div>
                                <h3>{material?.material_type === "listening" ? "Listening Script" : "Reading"}</h3>
                                <p>{content.passage}</p>
                            </div>
                        </article>
                    )}

                    {Array.isArray(content.vocabulary) && content.vocabulary.length > 0 && (
                        <article className="ai-result-block">
                            <span className="ai-result-number">02</span>
                            <div className="ai-result-content-wide">
                                <h3>Vocabulary</h3>
                                <div className="ai-vocabulary-grid">
                                    {content.vocabulary.map((item, index) => (
                                        <div className="ai-vocabulary-card" key={`${item.word}-${index}`}>
                                            <strong>{item.word}</strong>
                                            <span>{item.meaning}</span>
                                            <p>{item.example}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </article>
                    )}

                    {Array.isArray(content.questions) && content.questions.length > 0 && (
                        <article className="ai-result-block">
                            <span className="ai-result-number">03</span>
                            <div className="ai-result-content-wide">
                                <h3>Practice</h3>
                                <div className="ai-question-list">
                                    {content.questions.map((question, index) => (
                                        <details className="ai-question-card" key={index}>
                                            <summary><span>Q{index + 1}</span>{question.question}</summary>
                                            <div className="ai-question-options">
                                                {(question.options || []).map((option, optionIndex) => (
                                                    <div key={optionIndex}>{String.fromCharCode(65 + optionIndex)}. {option}</div>
                                                ))}
                                            </div>
                                            <div className="ai-answer">
                                                <strong>答案：{question.answer}</strong>
                                                {question.explanation && <p>{question.explanation}</p>}
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </div>
                        </article>
                    )}

                    {content.study_tip && (
                        <div className="ai-study-tip">
                            <FiZap />
                            <div>
                                <strong>Alan's Tip</strong>
                                <p>{content.study_tip}</p>
                            </div>
                        </div>
                    )}
                </section>
            )}
        </main>
    );
}

export default AIMaterialGenerator;
