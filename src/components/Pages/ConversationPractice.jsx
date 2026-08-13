import React, { useEffect, useMemo, useRef, useState } from "react";
import "./css/ConversationPractice.scss";

const NUMBER_WORDS = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15
};

const GRADE_WORDS = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9
};

const normalize = value => String(value || "")
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const containsAny = (text, values) => values.some(value => text.includes(value));

const extractNumber = text => {
    const numeric = text.match(/\b(\d{1,2})\b/);
    if (numeric) return Number(numeric[1]);

    const word = Object.keys(NUMBER_WORDS).find(item => text.includes(item));
    return word ? NUMBER_WORDS[word] : null;
};

const extractGrade = text => {
    const numeric = text.match(/\b([1-9])(?:st|nd|rd|th)?\b/);
    if (numeric) return Number(numeric[1]);

    const word = Object.keys(GRADE_WORDS).find(item => text.includes(item));
    return word ? GRADE_WORDS[word] : null;
};

const SCENARIO_STEPS = [
    {
        id: "name",
        mission: "介紹自己的名字",
        question: "Hi! Nice to meet you. What's your name?",
        translation: "嗨！很高興認識你。你叫什麼名字？",
        hint: "可以用 My name is... 或 I'm...",
        samples: ["My name is Kevin.", "I'm Amy.", "You can call me Leo."],
        evaluate: answer => {
            const text = normalize(answer);
            const hasNamePattern = containsAny(text, ["my name is", "i'm ", "i am ", "call me"]);
            const shortName = /^[a-z][a-z'-]{1,18}$/i.test(text);
            return {
                correct: hasNamePattern || shortName,
                success: "Great! You introduced yourself clearly.",
                retry: "Try saying: My name is Kevin."
            };
        }
    },
    {
        id: "age",
        mission: "說出自己的年齡",
        question: "How old are you?",
        translation: "你幾歲？",
        hint: "回答自己的年齡，例如 I'm eleven years old.",
        samples: ["I'm ten years old.", "I'm eleven.", "I am twelve years old."],
        evaluate: answer => {
            const text = normalize(answer);
            const age = extractNumber(text);
            const reasonableAge = age !== null && age >= 6 && age <= 18;
            return {
                correct: reasonableAge,
                success: `Good job! I understood that you are ${age ?? ""} years old.`,
                retry: "I didn't catch your age. Try: I'm eleven years old."
            };
        }
    },
    {
        id: "grade",
        mission: "說出自己的年級",
        question: "What grade are you in?",
        translation: "你讀幾年級？",
        hint: "例如 I'm in fifth grade.",
        samples: ["I'm in fourth grade.", "I'm in fifth grade.", "I'm a sixth grader."],
        evaluate: answer => {
            const text = normalize(answer);
            const grade = extractGrade(text);
            const hasGrade = grade !== null || containsAny(text, ["grader", "grade"]);
            return {
                correct: hasGrade,
                success: grade ? `Nice! You're in grade ${grade}.` : "Nice! I understood your grade.",
                retry: "Try including your grade, for example: I'm in fifth grade."
            };
        }
    },
    {
        id: "school",
        mission: "介紹自己的學校",
        question: "What school do you go to?",
        translation: "你讀哪一間學校？",
        hint: "可以說 I go to ___ Elementary School.",
        samples: ["I go to Happy Elementary School.", "I study at Sunshine Elementary School.", "My school is Green Elementary School."],
        evaluate: answer => {
            const text = normalize(answer);
            const schoolPattern = containsAny(text, ["school", "i go to", "i study at", "my school"]);
            return {
                correct: schoolPattern && text.length >= 8,
                success: "Excellent! Now your new friend knows where you study.",
                retry: "Try: I go to ___ Elementary School."
            };
        }
    },
    {
        id: "family",
        mission: "介紹家裡有幾個人",
        question: "How many people are there in your family?",
        translation: "你家裡有幾個人？",
        hint: "例如 There are four people in my family.",
        samples: ["There are four people in my family.", "There are five people in my family.", "We are a family of four."],
        evaluate: answer => {
            const text = normalize(answer);
            const count = extractNumber(text);
            return {
                correct: count !== null && count >= 1 && count <= 20,
                success: count ? `Got it! There are ${count} people in your family.` : "Great family answer!",
                retry: "Tell me a number, for example: There are four people in my family."
            };
        }
    },
    {
        id: "hobby",
        mission: "聊一個自己的興趣",
        question: "What do you like to do after school?",
        translation: "放學後你喜歡做什麼？",
        hint: "可以用 I like to... / I like...",
        samples: ["I like to play basketball.", "I like drawing.", "I like to play video games."],
        evaluate: answer => {
            const text = normalize(answer);
            const hobbyPattern = containsAny(text, ["i like", "i love", "i enjoy", "play", "draw", "read", "watch", "listen", "swim", "dance"]);
            return {
                correct: hobbyPattern && text.length >= 5,
                success: "Sounds fun! You told me about your hobby.",
                retry: "Try: I like to play basketball."
            };
        }
    },
    {
        id: "direction",
        mission: "不知道路時安全回答",
        question: "Excuse me. Do you know where the train station is?",
        translation: "不好意思，你知道火車站在哪裡嗎？",
        hint: "如果不知道，不需要亂指路。可以直接說 Sorry, I don't know.",
        samples: ["Sorry, I don't know.", "I'm sorry. I'm not sure.", "Sorry, you can ask that police officer."],
        evaluate: answer => {
            const text = normalize(answer);
            const safeUnknown = containsAny(text, ["don't know", "do not know", "not sure", "i'm not sure", "ask that", "ask the police", "ask a police"]);
            const directionAnswer = containsAny(text, ["go straight", "turn left", "turn right", "over there", "next to", "across from"]);
            return {
                correct: safeUnknown || directionAnswer,
                success: safeUnknown
                    ? "Perfect. If you don't know, saying so clearly is the safest answer."
                    : "Good! You used a direction phrase.",
                retry: "If you don't know the way, say: Sorry, I don't know."
            };
        }
    },
    {
        id: "clarify",
        mission: "聽不懂時請對方再說一次",
        question: "By the way, what do you usually enjoy doing with your classmates during your free time?",
        translation: "順帶一問，你空閒時通常喜歡和同學一起做什麼？",
        hint: "這一題故意比較長。聽不懂時不要猜，請對方再說一次或說慢一點。",
        samples: ["Could you say that again, please?", "Could you speak more slowly?", "Sorry, I don't understand."],
        evaluate: answer => {
            const text = normalize(answer);
            const clarification = containsAny(text, [
                "say that again",
                "say it again",
                "speak more slowly",
                "speak slowly",
                "don't understand",
                "do not understand",
                "pardon",
                "sorry what",
                "one more time"
            ]);
            return {
                correct: clarification,
                success: "Excellent real-world English! Asking for clarification is much better than pretending to understand.",
                retry: "Try: Could you say that again, please?"
            };
        }
    },
    {
        id: "goodbye",
        mission: "自然結束對話",
        question: "It was nice talking to you. Have a great day!",
        translation: "很高興和你聊天，祝你今天愉快！",
        hint: "回一句自然的道別就完成任務。",
        samples: ["Nice talking to you, too. Bye!", "Thank you. Have a nice day!", "See you! Bye!"],
        evaluate: answer => {
            const text = normalize(answer);
            const goodbye = containsAny(text, ["bye", "goodbye", "see you", "nice day", "nice talking", "thank you", "thanks"]);
            return {
                correct: goodbye,
                success: "Mission complete! You finished a real English conversation.",
                retry: "Try: Nice talking to you, too. Bye!"
            };
        }
    }
];

const MODES = {
    starter: {
        label: "Starter",
        description: "中文＋推薦回答",
        showTranslation: true,
        showSamples: true
    },
    explorer: {
        label: "Explorer",
        description: "中文＋需要時看提示",
        showTranslation: true,
        showSamples: false
    },
    challenge: {
        label: "Challenge",
        description: "全英文挑戰",
        showTranslation: false,
        showSamples: false
    }
};

function ConversationPractice() {
    const recognitionRef = useRef(null);
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const audioUrlRef = useRef("");

    const [mode, setMode] = useState("explorer");
    const [stepIndex, setStepIndex] = useState(0);
    const [answer, setAnswer] = useState("");
    const [heardText, setHeardText] = useState("");
    const [evaluation, setEvaluation] = useState(null);
    const [listening, setListening] = useState(false);
    const [audioUrl, setAudioUrl] = useState("");
    const [showHint, setShowHint] = useState(false);
    const [speechError, setSpeechError] = useState("");
    const [completed, setCompleted] = useState(false);
    const [messages, setMessages] = useState([
        { speaker: "system", text: "You're walking near a park when Alex, a friendly visitor, says hello." },
        { speaker: "alex", text: SCENARIO_STEPS[0].question }
    ]);

    const step = SCENARIO_STEPS[stepIndex];
    const speechRecognitionSupported = useMemo(() => Boolean(
        typeof window !== "undefined" &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)
    ), []);
    const recordingSupported = useMemo(() => Boolean(
        typeof window !== "undefined" &&
        navigator.mediaDevices?.getUserMedia &&
        window.MediaRecorder
    ), []);

    const cleanupStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const clearAudio = () => {
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = "";
        }
        setAudioUrl("");
    };

    const stopRecorder = () => {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
            recorderRef.current.stop();
        } else {
            cleanupStream();
        }
    };

    useEffect(() => {
        return () => {
            try {
                recognitionRef.current?.abort();
            } catch (error) {
                console.warn("Speech recognition cleanup error:", error);
            }
            if (recorderRef.current?.state !== "inactive") {
                try {
                    recorderRef.current.stop();
                } catch (error) {
                    console.warn("Recorder cleanup error:", error);
                }
            }
            cleanupStream();
            if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
            window.speechSynthesis?.cancel();
        };
    }, []);

    const speak = text => {
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
            setSpeechError("這個瀏覽器目前不支援文字朗讀。你仍然可以閱讀題目並作答。");
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 0.88;
        utterance.pitch = 1;

        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => voice.lang?.toLowerCase().startsWith("en-us")) ||
            voices.find(voice => voice.lang?.toLowerCase().startsWith("en"));
        if (englishVoice) utterance.voice = englishVoice;

        window.speechSynthesis.speak(utterance);
    };

    const evaluateAnswer = rawAnswer => {
        if (!rawAnswer.trim() || evaluation?.correct) return;

        const result = step.evaluate(rawAnswer);
        setEvaluation(result);

        if (result.correct) {
            setMessages(previous => [
                ...previous,
                { speaker: "student", text: rawAnswer.trim() }
            ]);
        }
    };

    const startRecording = async () => {
        setSpeechError("");
        setEvaluation(null);
        setHeardText("");
        clearAudio();

        if (!speechRecognitionSupported) {
            setSpeechError("這個瀏覽器目前無法使用語音辨識，請改用下方文字輸入。建議在 iPhone Safari 或最新版 Chrome 測試。");
            return;
        }

        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new Recognition();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;
        recognitionRef.current = recognition;

        if (recordingSupported) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
                chunksRef.current = [];

                const recorder = new MediaRecorder(stream);
                recorderRef.current = recorder;
                recorder.ondataavailable = event => {
                    if (event.data?.size > 0) chunksRef.current.push(event.data);
                };
                recorder.onstop = () => {
                    if (chunksRef.current.length > 0) {
                        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                        const nextUrl = URL.createObjectURL(blob);
                        audioUrlRef.current = nextUrl;
                        setAudioUrl(nextUrl);
                    }
                    cleanupStream();
                };
                recorder.start();
            } catch (error) {
                console.warn("Audio recording unavailable:", error);
                cleanupStream();
            }
        }

        recognition.onstart = () => setListening(true);
        recognition.onresult = event => {
            const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
            setHeardText(transcript);
            setAnswer(transcript);
            if (transcript) evaluateAnswer(transcript);
        };
        recognition.onerror = event => {
            const errorMap = {
                "not-allowed": "麥克風或語音辨識權限被拒絕，請允許權限後再試。",
                "audio-capture": "找不到可用的麥克風。",
                "no-speech": "沒有聽到清楚的英文，請靠近麥克風再說一次。",
                network: "瀏覽器語音辨識服務暫時無法連線，請稍後再試或使用文字輸入。"
            };
            setSpeechError(errorMap[event.error] || "語音辨識沒有成功，請再試一次或使用文字輸入。");
        };
        recognition.onend = () => {
            setListening(false);
            stopRecorder();
        };

        try {
            recognition.start();
        } catch (error) {
            console.error("Speech recognition start error:", error);
            setListening(false);
            stopRecorder();
            setSpeechError("語音辨識無法啟動，請稍後再試或使用文字輸入。");
        }
    };

    const stopRecording = () => {
        try {
            recognitionRef.current?.stop();
        } catch (error) {
            console.warn("Speech recognition stop error:", error);
        }
        setListening(false);
        stopRecorder();
    };

    const nextStep = () => {
        if (!evaluation?.correct) return;

        if (stepIndex >= SCENARIO_STEPS.length - 1) {
            setCompleted(true);
            localStorage.setItem("ae-conversation-meet-foreigner-complete", new Date().toISOString());
            setMessages(previous => [
                ...previous,
                { speaker: "system", text: "Mission complete! You handled the whole conversation in English." }
            ]);
            return;
        }

        const nextIndex = stepIndex + 1;
        const nextStepData = SCENARIO_STEPS[nextIndex];
        setStepIndex(nextIndex);
        setAnswer("");
        setHeardText("");
        setEvaluation(null);
        setShowHint(false);
        setSpeechError("");
        clearAudio();
        setMessages(previous => [
            ...previous,
            { speaker: "alex", text: nextStepData.question }
        ]);
    };

    const restartMission = () => {
        try {
            recognitionRef.current?.abort();
        } catch (error) {
            console.warn("Speech recognition restart cleanup error:", error);
        }
        stopRecorder();
        clearAudio();
        setStepIndex(0);
        setAnswer("");
        setHeardText("");
        setEvaluation(null);
        setShowHint(false);
        setSpeechError("");
        setCompleted(false);
        setMessages([
            { speaker: "system", text: "You're walking near a park when Alex, a friendly visitor, says hello." },
            { speaker: "alex", text: SCENARIO_STEPS[0].question }
        ]);
    };

    return (
        <main className="conversation-page">
            <section className="conversation-hero">
                <div>
                    <span className="conversation-kicker">💬 AE ENGLISH CONVERSATION</span>
                    <h1>Meet a Foreigner</h1>
                    <p>練習在真實生活中突然遇到外國人時，怎麼聽、怎麼回答、聽不懂又該怎麼反應。</p>
                </div>
                <div className="conversation-free-badge">
                    <strong>FREE SPEAKING</strong>
                    <span>不使用 Alan English OpenAI API</span>
                </div>
            </section>

            <section className="conversation-mode-bar">
                <div className="conversation-mode-title">
                    <span>Practice Mode</span>
                    <strong>選擇練習難度</strong>
                </div>
                <div className="conversation-mode-options">
                    {Object.entries(MODES).map(([key, item]) => (
                        <button
                            type="button"
                            key={key}
                            className={mode === key ? "active" : ""}
                            onClick={() => {
                                setMode(key);
                                setShowHint(false);
                            }}
                        >
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="conversation-layout">
                <aside className="conversation-mission-card">
                    <div className="mission-card-heading">
                        <span>MISSION</span>
                        <h2>第一次遇到外國人</h2>
                        <p>完成 9 個真實生活反應。</p>
                    </div>

                    <div className="mission-progress">
                        <div>
                            <span>Progress</span>
                            <strong>{completed ? SCENARIO_STEPS.length : stepIndex + (evaluation?.correct ? 1 : 0)} / {SCENARIO_STEPS.length}</strong>
                        </div>
                        <div className="mission-progress-track">
                            <span style={{ width: `${((completed ? SCENARIO_STEPS.length : stepIndex + (evaluation?.correct ? 1 : 0)) / SCENARIO_STEPS.length) * 100}%` }} />
                        </div>
                    </div>

                    <div className="mission-list">
                        {SCENARIO_STEPS.map((item, index) => {
                            const done = completed || index < stepIndex || (index === stepIndex && evaluation?.correct);
                            const current = !completed && index === stepIndex && !evaluation?.correct;
                            return (
                                <div key={item.id} className={`mission-item ${done ? "done" : ""} ${current ? "current" : ""}`}>
                                    <span className="mission-check">{done ? "✓" : index + 1}</span>
                                    <p>{item.mission}</p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="conversation-privacy-note">
                        <strong>🔒 Speaking privacy</strong>
                        <p>AE 不會把這次錄音存進資料庫；錄音只留在目前頁面供你自己回放。語音辨識由瀏覽器提供。</p>
                    </div>
                </aside>

                <div className="conversation-chat-card">
                    <div className="conversation-chat-header">
                        <div className="conversation-avatar">A</div>
                        <div>
                            <strong>Alex</strong>
                            <span>Friendly visitor · English practice</span>
                        </div>
                        <span className="conversation-online">● Practice</span>
                    </div>

                    <div className="conversation-messages">
                        {messages.slice(-6).map((message, index) => (
                            <div key={`${message.speaker}-${index}`} className={`conversation-message ${message.speaker}`}>
                                {message.speaker === "alex" && <span className="message-avatar">A</span>}
                                <div className="message-bubble">
                                    {message.speaker === "system" && <small>SCENE</small>}
                                    <p>{message.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {!completed ? (
                        <div className="conversation-practice-panel">
                            <div className="conversation-current-question">
                                <div>
                                    <span>NOW PRACTICING · {stepIndex + 1}/{SCENARIO_STEPS.length}</span>
                                    <h3>{step.question}</h3>
                                    {MODES[mode].showTranslation && <p>{step.translation}</p>}
                                </div>
                                <button type="button" className="listen-question-button" onClick={() => speak(step.question)}>
                                    🔊 Listen
                                </button>
                            </div>

                            {(MODES[mode].showSamples || showHint) && (
                                <div className="conversation-hint-box">
                                    <strong>💡 {step.hint}</strong>
                                    <div className="sample-answer-list">
                                        {step.samples.map(sample => (
                                            <button type="button" key={sample} onClick={() => setAnswer(sample)}>{sample}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!MODES[mode].showSamples && !showHint && (
                                <button type="button" className="show-hint-button" onClick={() => setShowHint(true)}>
                                    💡 I don't know what to say
                                </button>
                            )}

                            <div className="speaking-control">
                                <button
                                    type="button"
                                    className={`microphone-button ${listening ? "listening" : ""}`}
                                    onClick={listening ? stopRecording : startRecording}
                                    disabled={evaluation?.correct}
                                >
                                    <span>{listening ? "■" : "🎤"}</span>
                                </button>
                                <strong>{listening ? "Listening... tap to stop" : "Tap the microphone and answer in English"}</strong>
                                <p>{speechRecognitionSupported ? "Speak naturally. You don't need to match one exact sentence." : "Voice recognition isn't available here. Use text answer below."}</p>
                            </div>

                            {heardText && (
                                <div className="heard-result">
                                    <div>
                                        <span>I HEARD</span>
                                        <strong>“{heardText}”</strong>
                                    </div>
                                    {audioUrl && <audio controls src={audioUrl}>Your browser does not support audio playback.</audio>}
                                </div>
                            )}

                            {speechError && <div className="conversation-error">{speechError}</div>}

                            <div className="text-answer-box">
                                <label htmlFor="conversation-answer">或直接輸入英文回答</label>
                                <div>
                                    <input
                                        id="conversation-answer"
                                        type="text"
                                        value={answer}
                                        onChange={event => {
                                            setAnswer(event.target.value);
                                            if (!evaluation?.correct) setEvaluation(null);
                                        }}
                                        onKeyDown={event => {
                                            if (event.key === "Enter") evaluateAnswer(answer);
                                        }}
                                        placeholder="Type your answer in English..."
                                        disabled={evaluation?.correct}
                                    />
                                    <button type="button" onClick={() => evaluateAnswer(answer)} disabled={!answer.trim() || evaluation?.correct}>
                                        Check
                                    </button>
                                </div>
                            </div>

                            {evaluation && (
                                <div className={`conversation-feedback ${evaluation.correct ? "correct" : "retry"}`}>
                                    <span>{evaluation.correct ? "✓" : "↻"}</span>
                                    <div>
                                        <strong>{evaluation.correct ? "Answer understood!" : "Try one more time"}</strong>
                                        <p>{evaluation.correct ? evaluation.success : evaluation.retry}</p>
                                    </div>
                                </div>
                            )}

                            {evaluation?.correct && (
                                <button type="button" className="continue-conversation-button" onClick={nextStep}>
                                    {stepIndex === SCENARIO_STEPS.length - 1 ? "Complete Mission 🎉" : "Continue Conversation →"}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="conversation-complete-card">
                            <div className="complete-emoji">🎉</div>
                            <span>MISSION COMPLETE</span>
                            <h2>You handled a real English conversation!</h2>
                            <p>你已經練習名字、年齡、年級、學校、家庭、興趣、問路、聽不懂時的反應，以及自然道別。</p>
                            <div className="complete-skills">
                                <span>✓ Speak clearly</span>
                                <span>✓ Ask for clarification</span>
                                <span>✓ Handle real situations</span>
                            </div>
                            <button type="button" onClick={restartMission}>Practice Again</button>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}

export default ConversationPractice;