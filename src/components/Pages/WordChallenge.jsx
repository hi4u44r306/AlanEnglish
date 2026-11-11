import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BiHomeAlt2, BiLogIn } from "react-icons/bi";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";
import Brand from "../fragment/Brand";
import {
    WORD_BANK_VERSION,
    WORD_CHALLENGE_LEVELS,
    WORD_CHALLENGE_QUESTION_COUNT,
    meaningPeersOf,
    pickQuestions
} from "../../services/wordChallengeBank";
import { loadLocalProgress, recordLocalRound } from "../../services/wordChallengeLocalProgress";
import { WORD_CHALLENGE_MODES, buildLetterSlots, checkWordAnswer, lettersOnly, noteMessage } from "../../utils/wordChallengeAnswer";
import "./css/WordChallenge.scss";

// 擁有者決定（2026-11-11）：不用發音，只出「看中文拼字」。
const MODE = WORD_CHALLENGE_MODES.meaning;
// 看中文固定先給第一個字母，避免同一個中文對到好幾個英文字。
const BASE_REVEALED = 1;

const PLAYING_BODY_CLASS = "word-challenge-playing";

const resultMessage = (correct, total) => {
    if (correct === total) return "全部答對，太厲害了！";
    if (correct >= Math.ceil(total * 0.8)) return "很棒！再挑戰一次就能全對。";
    if (correct >= Math.ceil(total * 0.5)) return "不錯！把錯的字再練一次。";
    return "先練錯的字，再回來挑戰。";
};

function LetterSlots({ word, typed, revealed }) {
    const slots = buildLetterSlots(word.display, typed, revealed);
    return (
        <div className="word-challenge__slots" aria-hidden="true" style={{ "--wc-slot-count": slots.length }}>
            {slots.map(slot => {
                if (slot.kind === "gap") return <span className="word-challenge__slot-gap" key={slot.key} />;
                if (slot.kind === "symbol") return <span className="word-challenge__slot-symbol" key={slot.key}>{slot.value}</span>;
                return (
                    <span className={`word-challenge__slot${slot.value ? " is-filled" : ""}${!slot.value && slot.hint ? " is-hint" : ""}`} key={slot.key}>
                        {slot.value || slot.hint}
                    </span>
                );
            })}
        </div>
    );
}

function WordChallenge({ variant = "public" }) {
    const [progress, setProgress] = useState(() => loadLocalProgress(WORD_BANK_VERSION, MODE));
    const [phase, setPhase] = useState("menu");
    const [level, setLevel] = useState(0);
    const [questions, setQuestions] = useState([]);
    const [index, setIndex] = useState(0);
    const [typed, setTyped] = useState("");
    const [hints, setHints] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [results, setResults] = useState([]);
    const inputRef = useRef(null);
    const nextRef = useRef(null);

    const current = questions[index] || null;

    useEffect(() => {
        if (phase !== "play") return undefined;
        document.body.classList.add(PLAYING_BODY_CLASS);
        return () => document.body.classList.remove(PLAYING_BODY_CLASS);
    }, [phase]);

    useEffect(() => {
        if (phase !== "play" || !current || feedback) return;
        inputRef.current?.focus({ preventScroll: true });
    }, [phase, current, feedback]);

    useEffect(() => {
        if (feedback) nextRef.current?.focus({ preventScroll: true });
    }, [feedback]);

    const startRound = (nextLevel, onlyKeys = null) => {
        const picked = pickQuestions(nextLevel, MODE, { masteredKeys: progress.mastered, onlyKeys });
        if (picked.length === 0) return;
        setLevel(nextLevel);
        setQuestions(picked);
        setIndex(0);
        setTyped("");
        setHints(0);
        setFeedback(null);
        setResults([]);
        setPhase("play");
        window.scrollTo?.({ top: 0 });
    };

    const finishQuestion = (result, skipped = false) => {
        const entry = { key: current.key, word: current, correct: result.correct, hinted: hints > 0, skipped, typed };
        setResults(previous => [...previous, entry]);
        setFeedback({ ...result, skipped, message: skipped ? "" : noteMessage(current, result) });
    };

    const submitAnswer = event => {
        event.preventDefault();
        if (!current || feedback) return;
        if (!lettersOnly(typed)) {
            inputRef.current?.focus();
            return;
        }
        finishQuestion(checkWordAnswer(typed, current, MODE, meaningPeersOf(current)));
    };

    const skipQuestion = () => {
        if (!current || feedback) return;
        finishQuestion({ correct: false, note: null, expected: current.display }, true);
    };

    const revealHint = () => {
        if (!current || feedback) return;
        setHints(value => Math.min(value + 1, Math.max(current.letters - 1 - BASE_REVEALED, 0)));
        inputRef.current?.focus({ preventScroll: true });
    };

    const goNext = () => {
        if (index + 1 >= questions.length) {
            const nextProgress = recordLocalRound(WORD_BANK_VERSION, MODE, level, results);
            setProgress(nextProgress);
            setPhase("result");
            window.scrollTo?.({ top: 0 });
            return;
        }
        setIndex(value => value + 1);
        setTyped("");
        setHints(0);
        setFeedback(null);
    };

    const leaveRound = () => {
        setPhase("menu");
        setFeedback(null);
    };

    const correctCount = results.filter(result => result.correct).length;
    const missedResults = results.filter(result => !result.correct);
    const missedKeys = progress.missed || [];

    const header = variant === "public" ? (
        <header className="word-challenge__header">
            <Link className="word-challenge__brand" to="/" aria-label="前往 Alan English 首頁"><Brand /></Link>
            <nav aria-label="單字大挑戰導覽">
                <Link to="/" aria-label="首頁"><BiHomeAlt2 aria-hidden="true" /><span>首頁</span></Link>
                <Link to="/login" aria-label="登入"><BiLogIn aria-hidden="true" /><span>登入</span></Link>
            </nav>
        </header>
    ) : null;

    return (
        <div className={`word-challenge word-challenge--${variant}`}>
            {header}
            <main className="word-challenge__main">
                {phase === "menu" && (
                    <>
                        <section className="word-challenge__intro">
                            <span className="word-challenge__kicker">單字大挑戰</span>
                            <h1>看中文，把英文單字拼出來</h1>
                            <p>教育部國中小基本 1,200 字，依難度分成 6 級，一輪 {WORD_CHALLENGE_QUESTION_COUNT} 題。</p>
                        </section>


                        <section className="word-challenge__levels" aria-label="選擇等級">
                            {WORD_CHALLENGE_LEVELS.map(item => {
                                const best = progress.best?.[String(item.level)];
                                const count = item.meaningReady;
                                return (
                                    <button type="button" className="word-challenge__level" key={item.level} onClick={() => startRound(item.level)}>
                                        <span className="word-challenge__level-name">第 {item.level} 級</span>
                                        <span className="word-challenge__level-grade">建議{item.grade}年級</span>
                                        <span className="word-challenge__level-meta">{count} 字{Number.isFinite(best) ? ` · 最佳 ${best}/${WORD_CHALLENGE_QUESTION_COUNT}` : ""}</span>
                                    </button>
                                );
                            })}
                        </section>

                        {missedKeys.length > 0 && (
                            <button type="button" className="word-challenge__secondary word-challenge__practice-missed" onClick={() => startRound(0, missedKeys.slice(-WORD_CHALLENGE_QUESTION_COUNT))}>
                                練習之前錯的字（{missedKeys.length} 個）
                            </button>
                        )}

                        <ul className="word-challenge__fineprint">
                            <li>年級是依課綱生活主題、字長和常用程度自動排的建議，不是教育部官方分級。</li>
                            <li>只出兩本辭典中文意思一致的字，所以每級的字數不到 200 個。</li>
                            <li>{variant === "public" ? "不用登入也能玩，" : ""}成績目前只存在這台裝置。</li>
                        </ul>
                    </>
                )}

                {phase === "play" && current && (
                    <section className="word-challenge__play" aria-label="作答">
                        <div className="word-challenge__play-top">
                            <span>{level ? `第 ${level} 級` : "錯的字"}</span>
                            <strong aria-label={`第 ${index + 1} 題，共 ${questions.length} 題`}>{index + 1} / {questions.length}</strong>
                            <button type="button" className="word-challenge__leave" onClick={leaveRound}>離開</button>
                        </div>
                        <div className="word-challenge__bar" aria-hidden="true"><span style={{ width: `${((index + (feedback ? 1 : 0)) / questions.length) * 100}%` }} /></div>

                        <div className="word-challenge__prompt">
                            <span className="word-challenge__prompt-label">這個中文的英文是？</span>
                            <strong className="word-challenge__gloss" lang="zh-Hant">{current.gloss}</strong>
                        </div>

                        {!feedback && <LetterSlots word={current} typed={typed} revealed={BASE_REVEALED + hints} />}

                        {!feedback ? (
                            <form className="word-challenge__form" onSubmit={submitAnswer}>
                                <label className="word-challenge__sr" htmlFor="word-challenge-input">輸入英文拼字（{current.letters} 個字母）</label>
                                <input
                                    id="word-challenge-input"
                                    ref={inputRef}
                                    className="word-challenge__input"
                                    type="text"
                                    name={`wc-${current.key}-${index}`}
                                    value={typed}
                                    onChange={event => setTyped(event.target.value.slice(0, current.display.length + 6))}
                                    onFocus={event => event.target.scrollIntoView?.({ block: "center", behavior: "smooth" })}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    enterKeyHint="done"
                                    inputMode="text"
                                    placeholder="在這裡打字"
                                />
                                <div className="word-challenge__actions">
                                    <button type="submit" className="word-challenge__primary">確定</button>
                                    <button type="button" className="word-challenge__secondary" onClick={revealHint} disabled={hints >= Math.max(current.letters - 1 - BASE_REVEALED, 0)}>提示</button>
                                    <button type="button" className="word-challenge__secondary" onClick={skipQuestion}>不會，看答案</button>
                                </div>
                            </form>
                        ) : (
                            <div className={`word-challenge__feedback ${feedback.correct ? "is-correct" : "is-wrong"}`} role="status" aria-live="polite">
                                <p className="word-challenge__feedback-title">
                                    {feedback.correct ? <FiCheckCircle aria-hidden="true" /> : <FiXCircle aria-hidden="true" />}
                                    {feedback.correct ? "答對了！" : feedback.skipped ? "答案是" : "差一點！正確拼法"}
                                </p>
                                <p className="word-challenge__answer" lang="en">{current.display}</p>
                                {!feedback.correct && !feedback.skipped && typed && <p className="word-challenge__typed">你打的是：<span lang="en">{typed}</span></p>}
                                {feedback.message && <p className="word-challenge__note">{feedback.message}</p>}
                                <div className="word-challenge__actions">
                                    <button type="button" ref={nextRef} className="word-challenge__primary" onClick={goNext}>{index + 1 >= questions.length ? "看成績" : "下一題"}</button>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {phase === "result" && (
                    <section className="word-challenge__result" aria-label="這一輪的成績">
                        <span className="word-challenge__kicker">{level ? `第 ${level} 級` : "錯的字"}</span>
                        <h1><strong>{correctCount}</strong> / {results.length}</h1>
                        <p>{resultMessage(correctCount, results.length)}</p>
                        {missedResults.length > 0 && (
                            <ul className="word-challenge__missed" aria-label="這一輪錯的字">
                                {missedResults.map(result => (
                                    <li key={result.key}>
                                        <strong lang="en">{result.word.display}</strong>
                                        {result.word.gloss && <span>{result.word.gloss}</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="word-challenge__actions word-challenge__actions--stack">
                            {missedResults.length > 0 && <button type="button" className="word-challenge__primary" onClick={() => startRound(level, missedResults.map(result => result.key))}>只練這輪錯的字</button>}
                            {level > 0 && <button type="button" className={missedResults.length > 0 ? "word-challenge__secondary" : "word-challenge__primary"} onClick={() => startRound(level)}>同一級再挑戰</button>}
                            <button type="button" className="word-challenge__secondary" onClick={leaveRound}>換一級</button>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

export default WordChallenge;
