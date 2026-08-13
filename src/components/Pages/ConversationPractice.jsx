import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
    getConversationProgress,
    saveConversationProgress
} from "../../services/learningActivityService";
import "./css/ConversationPractice.scss";
import "./css/ConversationSpeech.scss";
import "./css/ConversationCloud.scss";

const SMALL_NUMBER_WORDS = {
    zero: 0,
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
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19
};

const TENS_NUMBER_WORDS = {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90
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

const SCENARIO_KEY = "meet-a-foreigner";
const AUTO_FINISH_SILENCE_MS = 1500;
const NO_SPEECH_TIMEOUT_MS = 6000;
const MAX_RECORDING_MS = 15000;

const normalize = value => String(value || "")
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const containsAny = (text, values) => values.some(value => text.includes(value));

const extractNumber = rawText => {
    const text = normalize(rawText);
    const numeric = text.match(/\b(\d{1,3})\b/);
    if (numeric) return Number(numeric[1]);

    const tokens = text.split(" ");

    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        const nextToken = tokens[index + 1];

        if (token === "one" && nextToken === "hundred") return 100;

        if (Object.prototype.hasOwnProperty.call(TENS_NUMBER_WORDS, token)) {
            const tens = TENS_NUMBER_WORDS[token];
            const ones = Object.prototype.hasOwnProperty.call(SMALL_NUMBER_WORDS, nextToken)
                ? SMALL_NUMBER_WORDS[nextToken]
                : 0;
            return tens + ones;
        }

        if (Object.prototype.hasOwnProperty.call(SMALL_NUMBER_WORDS, token)) {
            return SMALL_NUMBER_WORDS[token];
        }
    }

    return null;
};

const extractGrade = rawText => {
    const text = normalize(rawText);
    const numeric = text.match(/\b([1-9])(?:st|nd|rd|th)?\b/);
    if (numeric) return Number(numeric[1]);

    const word = Object.keys(GRADE_WORDS).find(item => text.includes(item));
    return word ? GRADE_WORDS[word] : null;
};

const SCENARIO_STEPS = [
    {
        id: "name",
        mission: "介紹自己的名字",
        shortLabel: "Name",
        question: "Hi! Nice to meet you. What's your name?",
        translation: "嗨！很高興認識你。你叫什麼名字？",
        hint: "可以用 My name is... 或 I'm...",
        samples: ["My name is Kevin.", "I'm Amy.", "You can call me Leo."],
        evaluate: answer => {
            const text = normalize(answer);
            const valid = containsAny(text, ["my name is", "i'm ", "i am ", "call me"]) || /^[a-z][a-z'-]{1,18}$/i.test(text);
            return {
                correct: valid,
                success: "Great! You introduced yourself clearly.",
                retry: "Try saying: My name is Kevin."
            };
        }
    },
    {
        id: "age",
        mission: "說出自己的年齡",
        shortLabel: "Age",
        question: "How old are you?",
        translation: "你幾歲？",
        hint: "回答自己的年齡，例如 I'm eleven years old.",
        samples: ["I'm ten years old.", "I'm eleven.", "I am twelve years old."],
        evaluate: answer => {
            const age = extractNumber(answer);
            const valid = age !== null && age >= 1 && age <= 120;
            return {
                correct: valid,
                success: valid ? `Good job! I understood that you are ${age} years old.` : "",
                retry: "I didn't catch your age. Try: I'm eleven years old."
            };
        }
    },
    {
        id: "grade",
        mission: "說出自己的年級",
        shortLabel: "Grade",
        question: "What grade are you in?",
        translation: "你讀幾年級？",
        hint: "例如 I'm in fifth grade.",
        samples: ["I'm in fourth grade.", "I'm in fifth grade.", "I'm a sixth grader."],
        evaluate: answer => {
            const text = normalize(answer);
            const grade = extractGrade(text);
            const valid = grade !== null || containsAny(text, ["grader", "grade"]);
            return {
                correct: valid,
                success: grade ? `Nice! You're in grade ${grade}.` : "Nice! I understood your grade.",
                retry: "Try including your grade, for example: I'm in fifth grade."
            };
        }
    },
    {
        id: "school",
        mission: "介紹自己的學校",
        shortLabel: "School",
        question: "What school do you go to?",
        translation: "你讀哪一間學校？",
        hint: "可以說 I go to ___ Elementary School.",
        samples: ["I go to Happy Elementary School.", "I study at Sunshine Elementary School.", "My school is Green Elementary School."],
        evaluate: answer => {
            const text = normalize(answer);
            const valid = containsAny(text, ["school", "i go to", "i study at", "my school"]) && text.length >= 8;
            return {
                correct: valid,
                success: "Excellent! Now your new friend knows where you study.",
                retry: "Try: I go to ___ Elementary School."
            };
        }
    },
    {
        id: "family",
        mission: "介紹家裡有幾個人",
        shortLabel: "Family",
        question: "How many people are there in your family?",
        translation: "你家裡有幾個人？",
        hint: "例如 There are four people in my family.",
        samples: ["There are four people in my family.", "There are five people in my family.", "We are a family of four."],
        evaluate: answer => {
            const count = extractNumber(answer);
            const valid = count !== null && count >= 1 && count <= 20;
            return {
                correct: valid,
                success: valid ? `Got it! There are ${count} people in your family.` : "",
                retry: "Tell me a number, for example: There are four people in my family."
            };
        }
    },
    {
        id: "hobby",
        mission: "聊一個自己的興趣",
        shortLabel: "Hobby",
        question: "What do you like to do after school?",
        translation: "放學後你喜歡做什麼？",
        hint: "可以用 I like to... / I like...",
        samples: ["I like to play basketball.", "I like drawing.", "I like to play video games."],
        evaluate: answer => {
            const text = normalize(answer);
            const valid = containsAny(text, ["i like", "i love", "i enjoy", "play", "draw", "read", "watch", "listen", "swim", "dance"]) && text.length >= 5;
            return {
                correct: valid,
                success: "Sounds fun! You told me about your hobby.",
                retry: "Try: I like to play basketball."
            };
        }
    },
    {
        id: "direction",
        mission: "不知道路時安全回答",
        shortLabel: "Directions",
        question: "Excuse me. Do you know where the train station is?",
        translation: "不好意思，你知道火車站在哪裡嗎？",
        hint: "如果不知道，不需要亂指路。可以直接說 Sorry, I don't know.",
        samples: ["Sorry, I don't know.", "I'm sorry. I'm not sure.", "Sorry, you can ask that police officer."],
        evaluate: answer => {
            const text = normalize(answer);
            const safeUnknown = containsAny(text, ["don't know", "do not know", "not sure", "ask the police", "ask a police"]);
            const direction = containsAny(text, ["go straight", "turn left", "turn right", "over there", "next to", "across from"]);
            return {
                correct: safeUnknown || direction,
                success: safeUnknown ? "Perfect. If you don't know, saying so clearly is the safest answer." : "Good! You used a direction phrase.",
                retry: "If you don't know the way, say: Sorry, I don't know."
            };
        }
    },
    {
        id: "clarify",
        mission: "聽不懂時請對方再說一次",
        shortLabel: "Clarify",
        question: "By the way, what do you usually enjoy doing with your classmates during your free time?",
        translation: "順帶一問，你空閒時通常喜歡和同學一起做什麼？",
        hint: "這一題故意比較長。聽不懂時不要猜，請對方再說一次或說慢一點。",
        samples: ["Could you say that again, please?", "Could you speak more slowly?", "Sorry, I don't understand."],
        evaluate: answer => {
            const text = normalize(answer);
            const valid = containsAny(text, ["say that again", "say it again", "speak more slowly", "speak slowly", "don't understand", "do not understand", "pardon", "sorry what", "one more time"]);
            return {
                correct: valid,
                success: "Excellent real-world English! Asking for clarification is much better than pretending to understand.",
                retry: "Try: Could you say that again, please?"
            };
        }
    },
    {
        id: "goodbye",
        mission: "自然結束對話",
        shortLabel: "Goodbye",
        question: "It was nice talking to you. Have a great day!",
        translation: "很高興和你聊天，祝你今天愉快！",
        hint: "回一句自然的道別就完成任務。",
        samples: ["Nice talking to you, too. Bye!", "Thank you. Have a nice day!", "See you! Bye!"],
        evaluate: answer => {
            const text = normalize(answer);
            const valid = containsAny(text, ["bye", "goodbye", "see you", "nice day", "nice talking", "thank you", "thanks"]);
            return {
                correct: valid,
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

const pickNaturalEnglishVoice = voices => {
    if (!Array.isArray(voices) || voices.length === 0) return null;

    const preferredNames = ["samantha", "ava", "allison", "susan", "zoe", "serena", "siri", "jenny", "aria", "guy"];

    const scoreVoice = voice => {
        const name = String(voice?.name || "").toLowerCase();
        const lang = String(voice?.lang || "").toLowerCase();
        let score = 0;

        if (lang === "en-us") score += 120;
        else if (lang.startsWith("en-")) score += 80;
        else if (lang.startsWith("en")) score += 60;
        else return -1000;

        if (voice?.localService) score += 20;
        if (name.includes("premium")) score += 55;
        if (name.includes("enhanced")) score += 50;
        if (name.includes("natural")) score += 45;

        preferredNames.forEach((preferredName, index) => {
            if (name.includes(preferredName)) score += 45 - index;
        });

        if (containsAny(name, ["bad news", "bells", "boing", "bubbles", "cellos", "deranged", "organ", "superstar", "trinoids", "whisper", "zarvox"])) {
            score -= 100;
        }

        return score;
    };

    return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
};

function ConversationPractice() {
    const { firebaseUser, role } = useAuth();
    const isDemoMode = role === "teacher" || role === "admin";

    const recognitionRef = useRef(null);
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const audioUrlRef = useRef("");
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const finalTranscriptRef = useRef("");
    const interimTranscriptRef = useRef("");
    const listeningRef = useRef(false);
    const finishingRef = useRef(false);
    const evaluatedRef = useRef(false);
    const speechStartedRef = useRef(false);
    const lastVoiceAtRef = useRef(0);
    const sessionStartedAtRef = useRef(0);
    const noiseFloorRef = useRef(0.006);
    const noSpeechTimerRef = useRef(null);
    const maxRecordingTimerRef = useRef(null);
    const preferredVoiceRef = useRef(null);

    const [mode, setMode] = useState("explorer");
    const [stepIndex, setStepIndex] = useState(0);
    const [answer, setAnswer] = useState("");
    const [heardText, setHeardText] = useState("");
    const [interimText, setInterimText] = useState("");
    const [evaluation, setEvaluation] = useState(null);
    const [listening, setListening] = useState(false);
    const [speechStarted, setSpeechStarted] = useState(false);
    const [voiceLevel, setVoiceLevel] = useState(0);
    const [audioUrl, setAudioUrl] = useState("");
    const [showHint, setShowHint] = useState(false);
    const [speechError, setSpeechError] = useState("");
    const [completed, setCompleted] = useState(false);
    const [finishReason, setFinishReason] = useState("");
    const [restoredProgress, setRestoredProgress] = useState(false);
    const [progressLoading, setProgressLoading] = useState(!isDemoMode);
    const [cloudStatus, setCloudStatus] = useState(isDemoMode ? "demo" : "idle");
    const [messages, setMessages] = useState([
        { speaker: "system", text: "You're walking near a park when Alex, a friendly visitor, says hello." },
        { speaker: "alex", text: SCENARIO_STEPS[0].question }
    ]);

    const step = SCENARIO_STEPS[stepIndex];
    const progressValue = completed ? SCENARIO_STEPS.length : stepIndex + (evaluation?.correct ? 1 : 0);

    const speechRecognitionSupported = useMemo(() => Boolean(
        typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)
    ), []);

    const recordingSupported = useMemo(() => Boolean(
        typeof window !== "undefined" && navigator.mediaDevices?.getUserMedia && window.MediaRecorder
    ), []);

    const resetQuestionState = () => {
        setAnswer("");
        setHeardText("");
        setInterimText("");
        setEvaluation(null);
        setShowHint(false);
        setSpeechError("");
        setSpeechStarted(false);
        setVoiceLevel(0);
        setFinishReason("");
        evaluatedRef.current = false;
    };

    const persistProgress = async ({
        currentStep = stepIndex,
        completedSteps = completed ? SCENARIO_STEPS.length : stepIndex,
        nextMode = mode,
        nextCompleted = completed,
        lastStepKey = step?.id || null
    } = {}) => {
        if (isDemoMode || !firebaseUser) return;

        setCloudStatus("saving");

        try {
            await saveConversationProgress(firebaseUser, {
                scenario_key: SCENARIO_KEY,
                mode: nextMode,
                current_step: currentStep,
                completed_steps: completedSteps,
                total_steps: SCENARIO_STEPS.length,
                last_step_key: lastStepKey,
                completed: nextCompleted
            });
            setCloudStatus("saved");
        } catch (error) {
            console.error("Conversation 雲端進度儲存失敗:", error);
            setCloudStatus("error");
        }
    };

    useEffect(() => {
        let cancelled = false;

        const loadProgress = async () => {
            if (!firebaseUser) return;

            if (isDemoMode) {
                setProgressLoading(false);
                setCloudStatus("demo");
                return;
            }

            setProgressLoading(true);

            try {
                const result = await getConversationProgress(firebaseUser, SCENARIO_KEY);
                if (cancelled) return;

                const saved = result?.progress;
                if (!saved) {
                    setCloudStatus("saved");
                    return;
                }

                const safeStep = Math.min(
                    SCENARIO_STEPS.length - 1,
                    Math.max(0, Number(saved.current_step) || 0)
                );
                const safeMode = Object.prototype.hasOwnProperty.call(MODES, saved.mode) ? saved.mode : "explorer";
                const wasCompleted = Boolean(saved.completed);

                setMode(safeMode);
                setStepIndex(safeStep);
                setCompleted(wasCompleted);
                setRestoredProgress(safeStep > 0 || wasCompleted);
                setMessages([
                    {
                        speaker: "system",
                        text: wasCompleted
                            ? "Welcome back! You already completed this mission."
                            : safeStep > 0
                                ? "Welcome back! Your progress was restored from Alan English cloud."
                                : "You're walking near a park when Alex, a friendly visitor, says hello."
                    },
                    { speaker: "alex", text: SCENARIO_STEPS[safeStep].question }
                ]);
                setCloudStatus("saved");
            } catch (error) {
                console.error("Conversation 雲端進度讀取失敗:", error);
                if (!cancelled) {
                    setCloudStatus("error");
                    setSpeechError("雲端進度暫時讀取失敗，你仍然可以練習；稍後系統會再嘗試儲存。"
                    );
                }
            } finally {
                if (!cancelled) setProgressLoading(false);
            }
        };

        loadProgress();

        return () => {
            cancelled = true;
        };
    }, [firebaseUser, isDemoMode]);

    useEffect(() => {
        if (!window.speechSynthesis) return undefined;

        const loadVoices = () => {
            preferredVoiceRef.current = pickNaturalEnglishVoice(window.speechSynthesis.getVoices());
        };

        loadVoices();
        window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);

        return () => window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
    }, []);

    const clearSpeechTimers = () => {
        if (noSpeechTimerRef.current) window.clearTimeout(noSpeechTimerRef.current);
        if (maxRecordingTimerRef.current) window.clearTimeout(maxRecordingTimerRef.current);
        noSpeechTimerRef.current = null;
        maxRecordingTimerRef.current = null;
    };

    const cleanupStream = () => {
        if (!streamRef.current) return;
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    };

    const cleanupAudioMeter = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        analyserRef.current = null;

        if (audioContextRef.current) {
            audioContextRef.current.close().catch?.(() => {});
            audioContextRef.current = null;
        }

        setVoiceLevel(0);
    };

    const clearAudio = () => {
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = "";
        setAudioUrl("");
    };

    const stopRecorder = () => {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
            try {
                recorderRef.current.stop();
                return;
            } catch (error) {
                console.warn("Recorder stop error:", error);
            }
        }
        cleanupStream();
    };

    const combinedTranscript = () => `${finalTranscriptRef.current} ${interimTranscriptRef.current}`
        .replace(/\s+/g, " ")
        .trim();

    const evaluateAnswer = rawAnswer => {
        if (!rawAnswer.trim() || evaluatedRef.current) return;

        const result = step.evaluate(rawAnswer);
        evaluatedRef.current = true;
        setEvaluation(result);

        if (!result.correct) return;

        setMessages(previous => [
            ...previous,
            { speaker: "student", text: rawAnswer.trim() }
        ]);

        const lastStep = stepIndex >= SCENARIO_STEPS.length - 1;
        persistProgress({
            currentStep: lastStep ? stepIndex : stepIndex + 1,
            completedSteps: stepIndex + 1,
            nextCompleted: lastStep,
            lastStepKey: step.id
        });
    };

    const finalizeTranscriptAndEvaluate = () => {
        const transcript = combinedTranscript() || answer.trim();
        if (!transcript) return;

        finalTranscriptRef.current = transcript;
        interimTranscriptRef.current = "";
        setHeardText(transcript);
        setInterimText("");
        setAnswer(transcript);
        evaluateAnswer(transcript);
    };

    const finishSpeechSession = reason => {
        if (!listeningRef.current || finishingRef.current) return;

        finishingRef.current = true;
        listeningRef.current = false;
        setListening(false);
        setFinishReason(reason || "manual");
        clearSpeechTimers();
        cleanupAudioMeter();

        try {
            recognitionRef.current?.stop();
        } catch (error) {
            console.warn("Speech recognition stop error:", error);
            finalizeTranscriptAndEvaluate();
        }

        stopRecorder();
    };

    const startAudioMeter = stream => {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        try {
            const audioContext = new AudioContextClass();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.72;
            source.connect(analyser);
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            if (audioContext.state === "suspended") audioContext.resume().catch(() => {});

            const samples = new Float32Array(analyser.fftSize);

            const paintMeter = () => {
                if (!analyserRef.current || !listeningRef.current) return;

                analyser.getFloatTimeDomainData(samples);
                let sum = 0;

                for (let index = 0; index < samples.length; index += 1) {
                    sum += samples[index] * samples[index];
                }

                const rms = Math.sqrt(sum / samples.length);
                const elapsed = Date.now() - sessionStartedAtRef.current;

                if (!speechStartedRef.current && elapsed < 900) {
                    noiseFloorRef.current = (noiseFloorRef.current * 0.88) + (rms * 0.12);
                }

                const voiceDetected = rms > Math.max(0.0085, noiseFloorRef.current * 2.15);
                const now = Date.now();

                if (voiceDetected) {
                    lastVoiceAtRef.current = now;
                    if (!speechStartedRef.current) {
                        speechStartedRef.current = true;
                        setSpeechStarted(true);
                    }
                }

                if (
                    speechStartedRef.current &&
                    lastVoiceAtRef.current > 0 &&
                    now - lastVoiceAtRef.current >= AUTO_FINISH_SILENCE_MS &&
                    combinedTranscript()
                ) {
                    finishSpeechSession("silence");
                    return;
                }

                setVoiceLevel(Math.min(100, Math.round(rms * 1150)));
                animationFrameRef.current = requestAnimationFrame(paintMeter);
            };

            animationFrameRef.current = requestAnimationFrame(paintMeter);
        } catch (error) {
            console.warn("Audio meter unavailable:", error);
        }
    };

    useEffect(() => {
        return () => {
            listeningRef.current = false;
            clearSpeechTimers();

            try {
                recognitionRef.current?.abort();
            } catch (error) {
                console.warn("Speech recognition cleanup error:", error);
            }

            cleanupAudioMeter();
            stopRecorder();
            cleanupStream();
            clearAudio();
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
        const preferredVoice = preferredVoiceRef.current || pickNaturalEnglishVoice(window.speechSynthesis.getVoices());

        utterance.lang = preferredVoice?.lang || "en-US";
        utterance.rate = 0.93;
        utterance.pitch = 1.02;
        utterance.volume = 1;
        if (preferredVoice) utterance.voice = preferredVoice;

        window.speechSynthesis.speak(utterance);
    };

    const startRecording = async () => {
        if (evaluation?.correct || listeningRef.current) return;

        resetQuestionState();
        clearAudio();
        finalTranscriptRef.current = "";
        interimTranscriptRef.current = "";
        speechStartedRef.current = false;
        finishingRef.current = false;
        lastVoiceAtRef.current = 0;
        noiseFloorRef.current = 0.006;
        sessionStartedAtRef.current = Date.now();

        if (!speechRecognitionSupported) {
            setSpeechError("這個瀏覽器目前無法使用語音辨識，請改用下方文字輸入。");
            return;
        }

        let stream = null;

        if (recordingSupported) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
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
                recorder.start(250);
            } catch (error) {
                console.warn("Audio recording unavailable:", error);
                cleanupStream();
            }
        }

        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new Recognition();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognitionRef.current = recognition;

        recognition.onstart = () => {
            listeningRef.current = true;
            setListening(true);
            if (stream) startAudioMeter(stream);

            noSpeechTimerRef.current = window.setTimeout(() => {
                if (!speechStartedRef.current && listeningRef.current) {
                    setSpeechError("我還沒聽到你的聲音。靠近一點麥克風再試一次。");
                    finishSpeechSession("no-speech");
                }
            }, NO_SPEECH_TIMEOUT_MS);

            maxRecordingTimerRef.current = window.setTimeout(() => {
                if (listeningRef.current) finishSpeechSession("max-time");
            }, MAX_RECORDING_MS);
        };

        recognition.onspeechstart = () => {
            speechStartedRef.current = true;
            lastVoiceAtRef.current = Date.now();
            setSpeechStarted(true);
        };

        recognition.onresult = event => {
            let finalText = finalTranscriptRef.current;
            let currentInterim = "";

            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const transcript = event.results[index]?.[0]?.transcript?.trim() || "";
                if (!transcript) continue;

                if (event.results[index].isFinal) {
                    finalText = `${finalText} ${transcript}`.replace(/\s+/g, " ").trim();
                } else {
                    currentInterim = `${currentInterim} ${transcript}`.replace(/\s+/g, " ").trim();
                }
            }

            finalTranscriptRef.current = finalText;
            interimTranscriptRef.current = currentInterim;
            const liveText = `${finalText} ${currentInterim}`.replace(/\s+/g, " ").trim();
            setHeardText(finalText);
            setInterimText(currentInterim);
            setAnswer(liveText);

            if (liveText && !speechStartedRef.current) {
                speechStartedRef.current = true;
                lastVoiceAtRef.current = Date.now();
                setSpeechStarted(true);
            }
        };

        recognition.onerror = event => {
            const errorMap = {
                "not-allowed": "麥克風或語音辨識權限被拒絕，請允許權限後再試。",
                "audio-capture": "找不到可用的麥克風。",
                "no-speech": "沒有聽到清楚的英文，請靠近麥克風再說一次。",
                network: "瀏覽器語音辨識服務暫時無法連線，請稍後再試或使用文字輸入。"
            };

            if (event.error !== "aborted") setSpeechError(errorMap[event.error] || "語音辨識沒有成功，請再試一次。");
        };

        recognition.onend = () => {
            const hadTranscript = Boolean(combinedTranscript());
            listeningRef.current = false;
            setListening(false);
            clearSpeechTimers();
            cleanupAudioMeter();
            stopRecorder();

            if (hadTranscript) {
                window.setTimeout(() => {
                    finalizeTranscriptAndEvaluate();
                    finishingRef.current = false;
                }, 80);
            } else {
                finishingRef.current = false;
            }
        };

        try {
            recognition.start();
        } catch (error) {
            console.error("Speech recognition start error:", error);
            listeningRef.current = false;
            setListening(false);
            cleanupAudioMeter();
            stopRecorder();
            setSpeechError("語音辨識無法啟動，請稍後再試或使用文字輸入。");
        }
    };

    const nextStep = () => {
        if (!evaluation?.correct) return;

        if (stepIndex >= SCENARIO_STEPS.length - 1) {
            setCompleted(true);
            persistProgress({
                currentStep: stepIndex,
                completedSteps: SCENARIO_STEPS.length,
                nextCompleted: true,
                lastStepKey: step.id
            });
            setMessages(previous => [
                ...previous,
                { speaker: "system", text: "Mission complete! You handled the whole conversation in English." }
            ]);
            return;
        }

        const nextIndex = stepIndex + 1;
        setStepIndex(nextIndex);
        setRestoredProgress(false);
        resetQuestionState();
        clearAudio();
        setMessages(previous => [
            ...previous,
            { speaker: "alex", text: SCENARIO_STEPS[nextIndex].question }
        ]);

        persistProgress({
            currentStep: nextIndex,
            completedSteps: nextIndex,
            nextCompleted: false,
            lastStepKey: step.id
        });
    };

    const restartMission = () => {
        listeningRef.current = false;
        clearSpeechTimers();

        try {
            recognitionRef.current?.abort();
        } catch (error) {
            console.warn("Speech recognition restart cleanup error:", error);
        }

        cleanupAudioMeter();
        stopRecorder();
        clearAudio();
        setStepIndex(0);
        setMode("explorer");
        setCompleted(false);
        setRestoredProgress(false);
        resetQuestionState();
        setMessages([
            { speaker: "system", text: "You're walking near a park when Alex, a friendly visitor, says hello." },
            { speaker: "alex", text: SCENARIO_STEPS[0].question }
        ]);

        persistProgress({
            currentStep: 0,
            completedSteps: 0,
            nextMode: "explorer",
            nextCompleted: false,
            lastStepKey: SCENARIO_STEPS[0].id
        });
    };

    const changeMode = key => {
        setMode(key);
        setShowHint(false);
        persistProgress({
            currentStep: stepIndex,
            completedSteps: completed ? SCENARIO_STEPS.length : stepIndex,
            nextMode: key,
            nextCompleted: completed,
            lastStepKey: step.id
        });
    };

    if (progressLoading) {
        return (
            <main className="conversation-page">
                <div className="conversation-cloud-loading">正在從 Alan English 雲端載入英文對話進度...</div>
            </main>
        );
    }

    return (
        <main className="conversation-page">
            <section className="conversation-hero">
                <div>
                    <span className="conversation-kicker">💬 AE ENGLISH CONVERSATION</span>
                    <h1>Meet a Foreigner</h1>
                    <p>練習在真實生活中突然遇到外國人時，怎麼聽、怎麼回答、聽不懂又該怎麼反應。</p>
                </div>
                <div className="conversation-free-badge">
                    <strong>{isDemoMode ? "TEACHER DEMO" : "FREE SPEAKING"}</strong>
                    <span>{isDemoMode ? "示範模式不寫入學生進度" : "進度會同步到 Alan English 雲端"}</span>
                </div>
            </section>

            <section className={`conversation-cloud-banner ${isDemoMode ? "demo" : cloudStatus}`}>
                <div>
                    <strong>
                        {isDemoMode
                            ? "Teacher / Admin Demo Mode"
                            : restoredProgress
                                ? "Welcome back 👋 已從資料庫恢復上次進度"
                                : "Cloud Progress"}
                    </strong>
                    <span>
                        {isDemoMode
                            ? "你可以完整示範所有語音功能，但不會寫入任何學生學習紀錄。"
                            : cloudStatus === "saving"
                                ? "正在儲存學習進度..."
                                : cloudStatus === "error"
                                    ? "雲端同步暫時失敗，請保持網路連線。"
                                    : completed
                                        ? "這個 Mission 已完成。"
                                        : `目前第 ${stepIndex + 1} / ${SCENARIO_STEPS.length} 關 · ${step.shortLabel}`}
                    </span>
                </div>
                {(restoredProgress || completed || isDemoMode) && (
                    <button type="button" onClick={restartMission}>從頭開始</button>
                )}
            </section>

            <section className="conversation-mode-bar">
                <div className="conversation-mode-title">
                    <span>Practice Mode</span>
                    <strong>選擇練習難度</strong>
                </div>
                <div className="conversation-mode-options">
                    {Object.entries(MODES).map(([key, item]) => (
                        <button type="button" key={key} className={mode === key ? "active" : ""} onClick={() => changeMode(key)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="conversation-mobile-progress">
                <div className="conversation-mobile-progress-heading">
                    <div>
                        <span>NOW PRACTICING</span>
                        <strong>{stepIndex + 1}/{SCENARIO_STEPS.length} · {step.shortLabel}</strong>
                    </div>
                    <span>{Math.round((progressValue / SCENARIO_STEPS.length) * 100)}%</span>
                </div>
                <div className="conversation-mobile-progress-track">
                    <span style={{ width: `${(progressValue / SCENARIO_STEPS.length) * 100}%` }} />
                </div>
                <div className="conversation-step-dots">
                    {SCENARIO_STEPS.map((item, index) => (
                        <span
                            key={item.id}
                            className={`${index < stepIndex ? "done" : ""} ${index === stepIndex ? "current" : ""}`}
                            title={item.mission}
                        />
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
                            <strong>{progressValue} / {SCENARIO_STEPS.length}</strong>
                        </div>
                        <div className="mission-progress-track">
                            <span style={{ width: `${(progressValue / SCENARIO_STEPS.length) * 100}%` }} />
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
                        <p>AE 不會把錄音存進資料庫；資料庫只保存關卡進度、模式與最後練習時間。</p>
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
                                    <span>NOW PRACTICING · {stepIndex + 1}/{SCENARIO_STEPS.length} · {step.shortLabel.toUpperCase()}</span>
                                    <h3>{step.question}</h3>
                                    {MODES[mode].showTranslation && <p>{step.translation}</p>}
                                </div>
                                <button type="button" className="listen-question-button" onClick={() => speak(step.question)}>🔊 Listen</button>
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
                                <button type="button" className="show-hint-button" onClick={() => setShowHint(true)}>💡 I don't know what to say</button>
                            )}

                            <div className={`speaking-control ${listening ? "is-listening" : ""}`}>
                                <button
                                    type="button"
                                    className={`microphone-button ${listening ? "listening" : ""}`}
                                    onClick={listening ? () => finishSpeechSession("manual") : startRecording}
                                    disabled={evaluation?.correct}
                                >
                                    <span>{listening ? "■" : "🎤"}</span>
                                </button>
                                <strong>
                                    {listening
                                        ? speechStarted
                                            ? "I can hear you — keep speaking"
                                            : "Listening... start speaking"
                                        : "Tap once and answer in English"}
                                </strong>
                                <p>
                                    {speechRecognitionSupported
                                        ? "Your words appear live. Pause for about 1.5 seconds and AE will finish automatically."
                                        : "Voice recognition isn't available here. Use text answer below."}
                                </p>

                                {listening && (
                                    <div className="speech-live-console">
                                        <div className="speech-meter-row">
                                            <span className={`speech-status-dot ${speechStarted ? "detected" : ""}`} />
                                            <strong>{speechStarted ? "Voice detected" : "Waiting for your voice..."}</strong>
                                        </div>
                                        <div className="speech-waveform" aria-label="Microphone level">
                                            {Array.from({ length: 18 }).map((_, index) => {
                                                const height = 8 + Math.min(34, voiceLevel * (0.22 + ((index % 5) * 0.08)));
                                                return <span key={index} style={{ height: `${height}px` }} />;
                                            })}
                                        </div>
                                        <div className="live-transcript">
                                            <span>LIVE TRANSCRIPT</span>
                                            <p>
                                                {heardText && <strong>{heardText} </strong>}
                                                {interimText && <em>{interimText}</em>}
                                                {!heardText && !interimText && <em>Start speaking in English...</em>}
                                            </p>
                                        </div>
                                        <button type="button" className="speech-finished-button" onClick={() => finishSpeechSession("manual")}>✓ 我說完了</button>
                                    </div>
                                )}
                            </div>

                            {!listening && (heardText || interimText) && (
                                <div className="heard-result speech-final-result">
                                    <div>
                                        <span>I HEARD {finishReason === "silence" ? "· AUTO FINISHED" : ""}</span>
                                        <strong>“{`${heardText} ${interimText}`.trim()}”</strong>
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
                                            if (!evaluation?.correct) {
                                                evaluatedRef.current = false;
                                                setEvaluation(null);
                                            }
                                        }}
                                        onKeyDown={event => {
                                            if (event.key === "Enter") evaluateAnswer(answer);
                                        }}
                                        placeholder="Type your answer in English..."
                                        disabled={evaluation?.correct || listening}
                                    />
                                    <button type="button" onClick={() => evaluateAnswer(answer)} disabled={!answer.trim() || evaluation?.correct || listening}>Check</button>
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
