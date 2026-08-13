import React, { useEffect, useMemo, useState } from "react";
import {
    FiBookOpen,
    FiCheckCircle,
    FiEdit3,
    FiFeather,
    FiHeadphones,
    FiRefreshCw,
    FiSparkles,
    FiZap
} from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import {
    generateAiMaterial,
    getAiMaterialUsage
} from "../../services/aiMaterialService";
import "./css/AIMaterialGenerator.scss";

const MATERIAL_TYPES = [
    {
        id: "reading",
        title: "閱讀理解",
        description: "文章、重點單字與閱讀題",
        icon: FiBookOpen
    },
    {
        id: "vocabulary",
        title: "單字練習",
        description: "單字、例句與情境題",
        icon: FiFeather
    },
    {
        id: "grammar",
        title: "文法練習",
        description: "依程度產生文法應用題",
        icon: FiEdit3
    },
    {
        id: "listening",
        title: "聽力測驗",
        description: "聽力稿與理解問題",
        icon: FiHeadphones
    },
    {
        id: "custom",
        title: "自訂教材",
        description: "告訴 AI 你想練習什麼",
        icon: FiSparkles
    }
];

const DIFFICULTIES = [
    "國小低年級",
    "國小中年級",
    "國小高年級",
    "國中基礎"
];

function AIMaterialGenerator() {
    const { firebaseUser } = useAuth();
    const [materialType, setMaterialType] = useState("reading");
    const [difficulty, setDifficulty] = useState("國小中年級");
    const [topic, setTopic] = useState("");
    const [questionCount, setQuestionCount] = useState(5);
    const [customRequest, setCustomRequest] = useState("");
    const [usage, setUsage] = useState({ used: 0, limit: 5, remaining: 5 });
    const [material, setMaterial] = useState(null);
    const [loadingUsage, setLoadingUsage] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");

    const selectedType = useMemo(
        () => MATERIAL_TYPES.find(type => type.id === materialType),
        [materialType]
    );

    useEffect(() => {
        const loadUsage = async () => {
            if (!firebaseUser) return;

            setLoadingUsage(true);

            try {
                const result = await getAiMaterialUsage(firebaseUser);
                if (result?.usage) setUsage(result.usage);
            } catch (usageError) {
                console.error("AI usage load error:", usageError);
                setError(usageError.message);
            } finally {
                setLoadingUsage(false);
            }
        };

        loadUsage();
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
            setError("今天的 5 次 AI 生成額度已經使用完畢，明天再回來練習吧！");
            return;
        }

        setGenerating(true);

        try {
            const result = await generateAiMaterial(
                firebaseUser,
                {
                    material_type: materialType,
                    difficulty,
                    topic: topic.trim(),
                    question_count: questionCount,
                    custom_request: customRequest.trim()
                }
            );

            setMaterial(result?.material || null);
            if (result?.usage) setUsage(result.usage);

            window.setTimeout(() => {
                document
                    .getElementById("ai-material-result")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
        } catch (generateError) {
            console.error("AI material generate error:", generateError);
            if (generateError?.usage) setUsage(generateError.usage);
            setError(generateError.message);
        } finally {
            setGenerating(false);
        }
    };

    const content = material?.content || null;

    return (
        <main className="ai-studio">
            <section className="ai-studio-hero">
                <div className="ai-studio-hero-copy">
                    <span className="ai-eyebrow"><FiSparkles /> ALAN ENGLISH AI</span>
                    <h1>把你想練的英文，<br /><span>變成專屬教材。</span></h1>
                    <p>選擇程度、主題與題型，AI 會依你的需求製作一份可以立即練習的英文教材。</p>
                </div>

                <div className="ai-quota-card">
                    <div className="ai-quota-heading">
                        <div>
                            <span>今日 AI 額度</span>
                            <strong>{loadingUsage ? "—" : `${usage.remaining} 次`}</strong>
                        </div>
                        <div className="ai-quota-icon"><FiZap /></div>
                    </div>
                    <div className="ai-quota-dots">
                        {Array.from({ length: usage.limit || 5 }).map((_, index) => (
                            <span
                                key={index}
                                className={index < usage.used ? "used" : "available"}
                            />
                        ))}
                    </div>
                    <p>今天已使用 {usage.used} / {usage.limit} 次 · 每日 00:00 重置</p>
                </div>
            </section>

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
                            <select
                                value={difficulty}
                                onChange={event => setDifficulty(event.target.value)}
                            >
                                {DIFFICULTIES.map(item => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                        </label>

                        <label className="ai-field">
                            <span>題目數量</span>
                            <select
                                value={questionCount}
                                onChange={event => setQuestionCount(Number(event.target.value))}
                            >
                                {[5, 8, 10, 15].map(count => (
                                    <option key={count} value={count}>{count} 題</option>
                                ))}
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
                        {generating ? (
                            <><FiRefreshCw className="ai-spin" /> AI 正在製作教材...</>
                        ) : (
                            <><FiSparkles /> 生成 {selectedType?.title || "AI 教材"}</>
                        )}
                    </button>

                    <p className="ai-generate-note">AI 成功完成教材後才會扣除 1 次額度；生成失敗不扣次數。</p>
                </form>
            </section>

            {content && (
                <section className="ai-result" id="ai-material-result">
                    <div className="ai-result-header">
                        <div>
                            <span className="ai-eyebrow"><FiSparkles /> GENERATED FOR YOU</span>
                            <h2>{content.title}</h2>
                            {content.subtitle && <p>{content.subtitle}</p>}
                        </div>
                        <span className="ai-result-level">{material?.difficulty}</span>
                    </div>

                    {content.passage && (
                        <article className="ai-result-block ai-passage">
                            <span className="ai-result-number">01</span>
                            <div>
                                <h3>{materialType === "listening" ? "Listening Script" : "Reading"}</h3>
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
                                            <summary>
                                                <span>Q{index + 1}</span>
                                                {question.question}
                                            </summary>
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