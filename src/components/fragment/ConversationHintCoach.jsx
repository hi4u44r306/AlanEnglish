import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import "../assets/scss/ConversationHintCoach.scss";

const HINT_GUIDES = {
    "Hi! Nice to meet you. What's your name?": {
        focus: "先告訴 Alex 你的名字就可以，不需要說很長。",
        frame: "My name is ___. / I'm ___.",
        examples: [
            "I'm Kevin.",
            "Kevin. Nice to meet you.",
            "My friends call me Kevin."
        ],
        repeat: "My name is Kevin."
    },
    "How old are you?": {
        focus: "這題只需要回答你的年齡。",
        frame: "I'm ___ years old. / I'm ___.",
        examples: [
            "I'm eleven.",
            "Eleven years old.",
            "I just turned eleven."
        ],
        repeat: "I'm eleven years old."
    },
    "What grade are you in?": {
        focus: "告訴 Alex 你現在是幾年級。",
        frame: "I'm in ___ grade. / I'm a ___ grader.",
        examples: [
            "Fifth grade.",
            "I'm a fifth grader.",
            "I'm in grade five."
        ],
        repeat: "I'm in fifth grade."
    },
    "What school do you go to?": {
        focus: "說出你的學校名稱，句子不用完全一樣。",
        frame: "I go to ___ Elementary School.",
        examples: [
            "I go to Sunshine Elementary School.",
            "I study at Sunshine Elementary School.",
            "I'm a student at Sunshine Elementary School."
        ],
        repeat: "I go to Sunshine Elementary School."
    },
    "How many people are there in your family?": {
        focus: "這題的重點是家裡有幾個人。",
        frame: "There are ___ people in my family.",
        examples: [
            "There are four of us.",
            "My family has four people.",
            "We are a family of four."
        ],
        repeat: "There are four people in my family."
    },
    "What do you like to do after school?": {
        focus: "說一個你放學後喜歡做的事情。",
        frame: "I like to ___. / I like ___.",
        examples: [
            "I like basketball.",
            "I enjoy drawing.",
            "After school, I like reading."
        ],
        repeat: "I like to play basketball."
    },
    "Excuse me. Do you know where the train station is?": {
        focus: "如果真的不知道路，直接說不知道是正確而且安全的回答。",
        frame: "Sorry, I don't know. / I'm not sure.",
        examples: [
            "Sorry, I'm not sure.",
            "I don't know where it is.",
            "Sorry, you can ask a police officer."
        ],
        repeat: "Sorry, I don't know."
    },
    "By the way, what do you usually enjoy doing with your classmates during your free time?": {
        focus: "這一題故意很長。聽不懂時，不用猜答案，請對方再說一次。",
        frame: "Could you say that again? / Could you speak more slowly?",
        examples: [
            "Could you say it again, please?",
            "One more time, please.",
            "Could you speak slowly, please?"
        ],
        repeat: "Could you say that again, please?"
    },
    "It was nice talking to you. Have a great day!": {
        focus: "自然回一句道別，就可以完成對話。",
        frame: "You too! / See you! / Have a nice day!",
        examples: [
            "You too! Bye!",
            "See you. Have a nice day!",
            "It was nice talking to you, too."
        ],
        repeat: "Nice talking to you, too. Bye!"
    }
};

const getQuestion = () => document.querySelector(".conversation-current-question h3")?.textContent?.trim() || "";
const getHintTarget = () => document.querySelector(".conversation-hint-box");
const getSpeakingTarget = () => document.querySelector(".speaking-control");
const getRetryVisible = () => Boolean(document.querySelector(".conversation-feedback.retry"));

const speakEnglish = text => {
    if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices?.() || [];
    const englishVoices = voices.filter(voice => String(voice.lang || "").toLowerCase().startsWith("en"));
    const preferred = englishVoices.find(voice => /samantha|ava|allison|jenny|aria|serena|natural|enhanced/i.test(voice.name)) || englishVoices[0];

    utterance.lang = preferred?.lang || "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
};

function ConversationHintCoach() {
    const location = useLocation();
    const isConversationPage = location.pathname === "/student/conversation";
    const retryVisibleRef = useRef(false);
    const previousQuestionRef = useRef("");
    const highlightTimerRef = useRef(null);
    const scrollTimerRef = useRef(null);
    const [question, setQuestion] = useState("");
    const [hintTarget, setHintTarget] = useState(null);
    const [speakingTarget, setSpeakingTarget] = useState(null);
    const [retryCounts, setRetryCounts] = useState({});
    const [hintVisible, setHintVisible] = useState(false);
    const [highlightKey, setHighlightKey] = useState(0);

    const guide = useMemo(() => HINT_GUIDES[question] || null, [question]);
    const attempt = retryCounts[question] || 0;

    useEffect(() => {
        if (!isConversationPage) return undefined;

        const removeHighlight = () => {
            document.querySelector(".conversation-hint-box")?.classList.remove("ae-hint-highlight");
        };

        const highlightHint = () => {
            window.clearTimeout(highlightTimerRef.current);
            window.clearTimeout(scrollTimerRef.current);

            window.setTimeout(() => {
                const hintBox = document.querySelector(".conversation-hint-box");
                if (!hintBox) return;

                hintBox.classList.remove("ae-hint-highlight");
                void hintBox.offsetWidth;
                hintBox.classList.add("ae-hint-highlight");
                setHighlightKey(Date.now());

                scrollTimerRef.current = window.setTimeout(() => {
                    hintBox.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });
                }, 80);

                highlightTimerRef.current = window.setTimeout(removeHighlight, 2600);
            }, 60);
        };

        const sync = () => {
            const nextQuestion = getQuestion();
            const retryVisible = getRetryVisible();
            const nextHintTarget = getHintTarget();
            const nextSpeakingTarget = getSpeakingTarget();
            const hintButton = document.querySelector(".show-hint-button");

            if (hintButton && hintButton.textContent !== "💡 Need a hint? 不知道怎麼回答？") {
                hintButton.textContent = "💡 Need a hint? 不知道怎麼回答？";
            }

            if (nextQuestion !== previousQuestionRef.current) {
                previousQuestionRef.current = nextQuestion;
                retryVisibleRef.current = false;
                removeHighlight();
            }

            setQuestion(previous => previous === nextQuestion ? previous : nextQuestion);
            setHintTarget(previous => previous === nextHintTarget ? previous : nextHintTarget);
            setSpeakingTarget(previous => previous === nextSpeakingTarget ? previous : nextSpeakingTarget);
            setHintVisible(Boolean(nextHintTarget));

            if (retryVisible && !retryVisibleRef.current && nextQuestion) {
                retryVisibleRef.current = true;
                setRetryCounts(previous => ({
                    ...previous,
                    [nextQuestion]: (previous[nextQuestion] || 0) + 1
                }));

                if (hintButton) hintButton.click();
                highlightHint();
            } else if (!retryVisible) {
                retryVisibleRef.current = false;
            }
        };

        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true
        });

        return () => {
            observer.disconnect();
            window.clearTimeout(highlightTimerRef.current);
            window.clearTimeout(scrollTimerRef.current);
            removeHighlight();
        };
    }, [isConversationPage]);

    if (!isConversationPage || !guide) return null;

    const visibleExamples = attempt === 1
        ? guide.examples.slice(0, 1)
        : guide.examples;

    const hintContent = hintTarget && hintVisible
        ? createPortal(
            <div className="ae-progressive-hint" data-highlight-key={highlightKey}>
                <div className="ae-progressive-hint-heading">
                    <span>💡 AE HINT</span>
                    <strong>
                        {attempt === 0
                            ? "更多自然回答方式"
                            : attempt === 1
                                ? "先抓住這一題的重點"
                                : attempt === 2
                                    ? "可以直接參考下面的回答"
                                    : "沒關係，先聽一次再跟著說"}
                    </strong>
                </div>

                {attempt > 0 && (
                    <div className="ae-hint-focus">
                        <span>{attempt}/3</span>
                        <p>{guide.focus}</p>
                    </div>
                )}

                <div className="ae-sentence-frame">
                    <small>句型提示</small>
                    <strong>{guide.frame}</strong>
                </div>

                <div className="ae-extra-answer-list">
                    <small>{attempt >= 2 ? "TRY ONE OF THESE" : "MORE WAYS TO ANSWER"}</small>
                    {visibleExamples.map(example => (
                        <button
                            type="button"
                            key={example}
                            onClick={() => {
                                const input = document.querySelector("#conversation-answer");
                                if (!input) return;

                                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                                nativeSetter?.call(input, example);
                                input.dispatchEvent(new Event("input", { bubbles: true }));
                                input.focus();
                            }}
                        >
                            <span>🔵</span>
                            {example}
                        </button>
                    ))}
                </div>

                {attempt >= 3 && (
                    <div className="ae-listen-repeat">
                        <div>
                            <small>LISTEN & REPEAT</small>
                            <strong>{guide.repeat}</strong>
                        </div>
                        <div className="ae-listen-repeat-actions">
                            <button type="button" onClick={() => speakEnglish(guide.repeat)}>🔊 Listen</button>
                            <button
                                type="button"
                                onClick={() => document.querySelector(".microphone-button")?.click()}
                            >
                                🎤 Repeat
                            </button>
                        </div>
                    </div>
                )}
            </div>,
            hintTarget
        )
        : null;

    const speakingGuide = speakingTarget
        ? createPortal(
            <div className="ae-your-turn-guide" aria-live="polite">
                <span>🔵 YOUR TURN</span>
                <strong>現在輪到你，用英文回答 Alex</strong>
                {attempt > 0 && <small>提示已經幫你標示在上方 💡</small>}
            </div>,
            speakingTarget
        )
        : null;

    return (
        <>
            {hintContent}
            {speakingGuide}
        </>
    );
}

export default ConversationHintCoach;
