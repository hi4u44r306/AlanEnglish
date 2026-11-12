import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BiHomeAlt2, BiLogIn } from "react-icons/bi";
import { FiArrowRight, FiCheck, FiX } from "react-icons/fi";
import Brand from "../fragment/Brand";
import { useAuth } from "../../auth/AuthContext";
import {
    WORD_BANK_VERSION,
    WORD_CHALLENGE_LEVELS,
    WORD_CHALLENGE_QUESTION_COUNT,
    findWordByKey,
    meaningPeersOf,
    pickQuestions
} from "../../services/wordChallengeBank";
import { loadLocalProgress, recordLocalRound } from "../../services/wordChallengeLocalProgress";
import {
    answerWordChallenge,
    finishWordChallengeRound,
    getWordChallengeSummary,
    revealWordChallengeHint,
    startWordChallengeRound
} from "../../services/wordChallengeService";
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

const SCORE_RING_RADIUS = 52;
const SCORE_RING_LENGTH = 2 * Math.PI * SCORE_RING_RADIUS;

// 片語超過這個格數就以單字為單位換行，字母格才不會在手機上縮得太小。
const SINGLE_LINE_SLOT_LIMIT = 12;
const WRAPPED_MIN_SLOT_COUNT = 8;

// 伺服器題目只帶樣板（空格、符號與已給的字母），不含完整答案。
function slotsFromTemplate(template, typed) {
    const letters = lettersOnly(typed).split("");
    let letterIndex = 0;
    return template.map((slot, index) => {
        if (slot.kind === "letter") {
            const built = { kind: "letter", key: `l-${index}`, value: letters[letterIndex] || "", hint: slot.hint || "" };
            letterIndex += 1;
            return built;
        }
        return slot.kind === "gap" ? { kind: "gap", key: `s-${index}`, value: "" } : { kind: "symbol", key: `s-${index}`, value: slot.value };
    });
}

function LetterSlots({ word, typed, revealed }) {
    const slots = word.template ? slotsFromTemplate(word.template, typed) : buildLetterSlots(word.display, typed, revealed);
    const currentKey = slots.find(slot => slot.kind === "letter" && !slot.value)?.key;
    const groups = slots.reduce((list, slot) => {
        if (slot.kind === "gap") list.push([]);
        else list[list.length - 1].push(slot);
        return list;
    }, [[]]);
    const sizeCount = slots.length <= SINGLE_LINE_SLOT_LIMIT
        ? slots.length
        : Math.max(WRAPPED_MIN_SLOT_COUNT, ...groups.map(group => group.length));
    return (
        <div className="word-challenge__slots" aria-hidden="true" style={{ "--wc-slot-count": sizeCount }}>
            {groups.map(group => (
                <span className="word-challenge__slot-word" key={group[0]?.key || "empty"}>
                    {group.map(slot => {
                        if (slot.kind === "symbol") return <span className="word-challenge__slot-symbol" key={slot.key}>{slot.value}</span>;
                        const classes = ["word-challenge__slot"];
                        if (slot.value) classes.push("is-filled");
                        else if (slot.hint) classes.push("is-hint");
                        if (slot.key === currentKey) classes.push("is-current");
                        return <span className={classes.join(" ")} key={slot.key}>{slot.value || slot.hint}</span>;
                    })}
                </span>
            ))}
        </div>
    );
}

// 作答進度：每題一顆圓點，答對綠、答錯紅、目前這題藍框。
function ProgressDots({ total, results, index, answered }) {
    return (
        <ol className="word-challenge__dots" aria-hidden="true">
            {Array.from({ length: total }, (_, position) => {
                const result = results[position];
                let state = "";
                if (result) state = result.correct ? " is-correct" : " is-wrong";
                else if (position === index && !answered) state = " is-current";
                return <li className={`word-challenge__dot${state}`} key={position} />;
            })}
        </ol>
    );
}

// 只有「登入的學生」可能走伺服器模式；訪客、老師、管理員一律本機模式。
function useStudentAccount(variant) {
    const auth = useAuth();
    return variant === "app" && auth?.role === "student" && auth.firebaseUser ? auth.firebaseUser : null;
}

const SERVER_FALLBACK_NOTICE = "暫時連不上伺服器，這一輪不會記到帳號，照樣可以玩。";

function WordChallenge({ variant = "public" }) {
    const studentUser = useStudentAccount(variant);
    const [progress, setProgress] = useState(() => loadLocalProgress(WORD_BANK_VERSION, MODE));
    const [serverMode, setServerMode] = useState(false);
    const [roundId, setRoundId] = useState("");
    const [busy, setBusy] = useState(false);
    const [pendingFinishId, setPendingFinishId] = useState("");
    // 連點或雙擊時，state 還來不及更新；用 ref 當真正的鎖，同一時間只送一個請求。
    const lockRef = useRef(false);
    const acquire = () => {
        if (lockRef.current) return false;
        lockRef.current = true;
        setBusy(true);
        return true;
    };
    const release = () => {
        lockRef.current = false;
        setBusy(false);
    };
    const [notice, setNotice] = useState("");
    const [xpInfo, setXpInfo] = useState(null);
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

    // 伺服器模式：開啟時問一次伺服器有沒有開放；沒開放或失敗就維持本機模式。
    useEffect(() => {
        if (!studentUser) return undefined;
        let cancelled = false;
        getWordChallengeSummary(studentUser).then(summary => {
            if (cancelled || summary?.mode !== "server") return;
            setServerMode(true);
            setProgress({
                best: summary.best && typeof summary.best === "object" ? summary.best : {},
                mastered: Array.isArray(summary.mastered) ? summary.mastered : [],
                missed: Array.isArray(summary.missed) ? summary.missed : []
            });
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [studentUser]);

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

    const beginRound = (nextLevel, picked, nextRoundId = "") => {
        setLevel(nextLevel);
        setQuestions(picked);
        setRoundId(nextRoundId);
        setIndex(0);
        setTyped("");
        setHints(0);
        setFeedback(null);
        setResults([]);
        setXpInfo(null);
        setPhase("play");
        window.scrollTo?.({ top: 0 });
    };

    const startLocalRound = (nextLevel, onlyKeys = null) => {
        const picked = pickQuestions(nextLevel, MODE, { masteredKeys: progress.mastered, onlyKeys });
        if (picked.length === 0) return;
        beginRound(nextLevel, picked);
    };

    // 伺服器模式：連不上就退回本機模式，學生照樣能玩（這一輪不記到帳號）。
    const startRound = async (nextLevel, onlyKeys = null) => {
        setNotice("");
        if (!serverMode || !studentUser) {
            startLocalRound(nextLevel, onlyKeys);
            return;
        }
        if (!acquire()) return;
        try {
            const started = await startWordChallengeRound(studentUser, nextLevel);
            const picked = (started.questions || []).map(question => ({
                key: `server-${question.position}`,
                gloss: question.gloss,
                letters: question.letters,
                template: question.template,
                position: question.position
            }));
            if (!started.round_id || picked.length === 0) throw new Error("empty round");
            beginRound(nextLevel, picked, started.round_id);
        } catch (error) {
            if (error?.code === "daily_round_limit") {
                setNotice(error.message);
            } else {
                setNotice(SERVER_FALLBACK_NOTICE);
                setServerMode(false);
                startLocalRound(nextLevel, onlyKeys);
            }
        } finally {
            release();
        }
    };

    // 伺服器模式下中途出錯：回到選單，不留下卡住的畫面。
    const abandonServerRound = message => {
        setNotice(message);
        setPhase("menu");
        setFeedback(null);
        setRoundId("");
    };

    const finishQuestion = (result, skipped = false) => {
        const entry = { key: current.key, word: current, correct: result.correct, hinted: hints > 0, skipped, typed };
        setResults(previous => [...previous, entry]);
        setFeedback({ ...result, skipped, message: skipped ? "" : noteMessage(current, result) });
    };

    // 伺服器批改：答案在作答之後才會回來。
    const answerOnServer = async (skipped) => {
        if (!acquire()) return;
        try {
            const reply = await answerWordChallenge(studentUser, roundId, current.position, { typed, skipped });
            const word = { display: reply.expected, gloss: current.gloss };
            const entry = { key: current.key, word, correct: reply.correct, hinted: (reply.hint_count || 0) > 0, skipped: reply.skipped, typed };
            const result = { correct: reply.correct, note: reply.note, matched: reply.matched, expected: reply.expected };
            // 同一題只記一次（重送時伺服器回的是原本的結果）。
            setResults(previous => (previous.some(item => item.key === entry.key) ? previous : [...previous, entry]));
            setFeedback({ ...result, skipped: reply.skipped, message: reply.skipped ? "" : noteMessage(word, result) });
        } catch (error) {
            abandonServerRound(error?.message || SERVER_FALLBACK_NOTICE);
        } finally {
            release();
        }
    };

    const submitAnswer = event => {
        event.preventDefault();
        if (!current || feedback || busy) return;
        if (!lettersOnly(typed)) {
            inputRef.current?.focus();
            return;
        }
        if (roundId) {
            answerOnServer(false);
            return;
        }
        finishQuestion(checkWordAnswer(typed, current, MODE, meaningPeersOf(current)));
    };

    const skipQuestion = () => {
        if (!current || feedback || busy) return;
        if (roundId) {
            answerOnServer(true);
            return;
        }
        finishQuestion({ correct: false, note: null, expected: current.display }, true);
    };

    const revealHint = async () => {
        if (!current || feedback || busy) return;
        if (!roundId) {
            setHints(value => Math.min(value + 1, Math.max(current.letters - 1 - BASE_REVEALED, 0)));
            inputRef.current?.focus({ preventScroll: true });
            return;
        }
        if (!acquire()) return;
        try {
            const reply = await revealWordChallengeHint(studentUser, roundId, current.position);
            setHints(reply.hint_count);
            setQuestions(list => list.map((question, position) => (position === index ? { ...question, template: reply.template } : question)));
            inputRef.current?.focus({ preventScroll: true });
        } catch (error) {
            abandonServerRound(error?.message || SERVER_FALLBACK_NOTICE);
        } finally {
            release();
        }
    };

    // 結算：失敗時再試一次（伺服器端結算是冪等的，重試不會重複發 XP）；還是失敗就保留這一輪，成績頁可以按「再結算一次」。
    const finishOnServer = async (idOverride = "") => {
        const id = idOverride || roundId;
        if (!id || !acquire()) return;
        try {
            let finished = null;
            let failure = null;
            for (let attempt = 0; attempt < 2 && !finished; attempt += 1) {
                try {
                    finished = await finishWordChallengeRound(studentUser, id);
                } catch (error) {
                    failure = error;
                    // 4xx（例如這一輪已過期）重試沒有用。
                    if (error?.status && error.status < 500 && error.code !== "timeout") break;
                }
            }
            if (!finished) throw failure || new Error("finish failed");
            setPendingFinishId("");
            setXpInfo({ xp: finished.xp_awarded, fresh: finished.new_mastered_count });
            if (finished.xp_awarded > 0) window.dispatchEvent(new CustomEvent("ae:gamification-updated", { detail: { xp: finished.xp_awarded, source: "word_challenge" } }));
            // 摘要要等結算完成後再抓，選單上的最佳分才是最新的。
            const summary = await getWordChallengeSummary(studentUser).catch(() => null);
            if (summary?.mode === "server") {
                setProgress({ best: summary.best || {}, mastered: summary.mastered || [], missed: summary.missed || [] });
            }
        } catch (error) {
            setPendingFinishId(id);
            setXpInfo({ failed: true });
        } finally {
            release();
            setRoundId("");
            setPhase("result");
            window.scrollTo?.({ top: 0 });
        }
    };

    const goNext = () => {
        if (index + 1 >= questions.length) {
            if (roundId) {
                finishOnServer();
                return;
            }
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
        setRoundId("");
    };

    // 這一輪是伺服器出的題目（題目只有 server- 開頭的代號）。
    const roundIsServer = questions.length > 0 && String(questions[0].key).startsWith("server-");
    const correctCount = results.filter(result => result.correct).length;
    const missedResults = results.filter(result => !result.correct);
    const missedKeys = progress.missed || [];

    // 每一級「已會」的字數：這台裝置上答對過（沒用提示）的字。
    const masteredByLevel = useMemo(() => {
        const counts = {};
        for (const key of progress.mastered || []) {
            const word = findWordByKey(key);
            if (word?.gloss) counts[word.level] = (counts[word.level] || 0) + 1;
        }
        return counts;
    }, [progress.mastered]);

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
                            <div className="word-challenge__intro-tiles" aria-hidden="true">
                                <span>A</span><span>B</span><span>C</span>
                            </div>
                            <span className="word-challenge__kicker">單字大挑戰</span>
                            <h1><span>看中文，</span><span>把英文單字拼出來</span></h1>
                            <p>教育部國中小基本 1,200 字，依難度分成 6 級，一輪 {WORD_CHALLENGE_QUESTION_COUNT} 題。</p>
                        </section>


                        {notice && <p className="word-challenge__notice" role="status">{notice}</p>}

                        <section className="word-challenge__levels" aria-label="選擇等級">
                            {WORD_CHALLENGE_LEVELS.map(item => {
                                const best = progress.best?.[String(item.level)];
                                const count = item.meaningReady;
                                const known = Math.min(masteredByLevel[item.level] || 0, count);
                                const played = Number.isFinite(best) || known > 0;
                                return (
                                    <button type="button" className={`word-challenge__level word-challenge__level--${item.level}`} key={item.level} onClick={() => startRound(item.level)} disabled={busy}>
                                        <span className="word-challenge__level-top">
                                            <span className="word-challenge__level-badge" aria-hidden="true">{item.level}</span>
                                            <span className="word-challenge__level-name">第 {item.level} 級</span>
                                        </span>
                                        <span className="word-challenge__level-grade">建議{item.grade}年級</span>
                                        <span className="word-challenge__level-progress" aria-hidden="true"><span style={{ width: `${count ? (known / count) * 100 : 0}%` }} /></span>
                                        <span className="word-challenge__level-meta">
                                            <span>{played ? `已會 ${known}/${count} 字` : `${count} 字 · 還沒挑戰`}</span>
                                            {Number.isFinite(best) && <span>最佳 {best}/{WORD_CHALLENGE_QUESTION_COUNT}</span>}
                                        </span>
                                    </button>
                                );
                            })}
                        </section>

                        {missedKeys.length > 0 && (
                            <button type="button" className="word-challenge__practice-missed" onClick={() => startRound(0, missedKeys.slice(-WORD_CHALLENGE_QUESTION_COUNT))} disabled={busy}>
                                <span>練習之前錯的字（{missedKeys.length} 個）</span>
                                <FiArrowRight aria-hidden="true" />
                            </button>
                        )}

                        <ul className="word-challenge__fineprint">
                            <li>年級是依課綱生活主題、字長和常用程度自動排的建議，不是教育部官方分級。</li>
                            <li>只出兩本辭典中文意思一致的字，所以每級的字數不到 200 個。</li>
                            <li>{serverMode ? "成績記在你的帳號。一輪第一次學會 8 個新字（沒用提示）有 XP，單字每天最多 30 XP；練錯的字不給 XP。" : `${variant === "public" ? "不用登入也能玩，" : ""}成績目前只存在這台裝置。`}</li>
                        </ul>
                    </>
                )}

                {phase === "play" && current && (
                    <section className="word-challenge__play" aria-label="作答">
                        <div className="word-challenge__play-top">
                            <span className="word-challenge__chip">{level ? `第 ${level} 級` : "錯的字"}</span>
                            <strong aria-label={`第 ${index + 1} 題，共 ${questions.length} 題`}>{index + 1} / {questions.length}</strong>
                            <button type="button" className="word-challenge__leave" onClick={leaveRound} disabled={busy}><FiX aria-hidden="true" />離開</button>
                        </div>
                        <ProgressDots total={questions.length} results={results} index={index} answered={Boolean(feedback)} />

                        <div className="word-challenge__card">
                            <span className="word-challenge__card-tab">中文</span>
                            <span className="word-challenge__sr">這個中文的英文是？</span>
                            <strong className="word-challenge__gloss" lang="zh-Hant">{current.gloss}</strong>
                            {!feedback && <LetterSlots word={current} typed={typed} revealed={BASE_REVEALED + hints} />}
                        </div>

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
                                    onChange={event => setTyped(event.target.value.slice(0, (current.display ? current.display.length : current.letters + 6) + 6))}
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
                                    <button type="submit" className="word-challenge__primary" disabled={busy}>確定</button>
                                    <button type="button" className="word-challenge__secondary" onClick={revealHint} disabled={busy || hints >= Math.max(current.letters - 1 - BASE_REVEALED, 0)}>提示</button>
                                    <button type="button" className="word-challenge__secondary" onClick={skipQuestion} disabled={busy}>不會，看答案</button>
                                </div>
                            </form>
                        ) : (
                            <div className={`word-challenge__feedback ${feedback.correct ? "is-correct" : "is-wrong"}`} role="status" aria-live="polite">
                                <span className="word-challenge__feedback-icon" aria-hidden="true">{feedback.correct ? <FiCheck /> : <FiX />}</span>
                                <p className="word-challenge__feedback-title">
                                    {feedback.correct ? "答對了！" : feedback.skipped ? "答案是" : "差一點！正確拼法"}
                                </p>
                                <p className="word-challenge__answer" lang="en">{feedback.expected || current.display}</p>
                                {!feedback.correct && !feedback.skipped && typed && <p className="word-challenge__typed">你打的是：<span lang="en">{typed}</span></p>}
                                {feedback.message && <p className="word-challenge__note">{feedback.message}</p>}
                                <div className="word-challenge__actions">
                                    <button type="button" ref={nextRef} className="word-challenge__primary" onClick={goNext} disabled={busy}>{index + 1 >= questions.length ? "看成績" : "下一題"}</button>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {phase === "result" && (
                    <section className="word-challenge__result" aria-label="這一輪的成績">
                        <span className="word-challenge__chip">{level ? `第 ${level} 級` : "錯的字"}</span>
                        <div className="word-challenge__score">
                            <svg viewBox="0 0 120 120" aria-hidden="true">
                                <circle className="word-challenge__score-track" cx="60" cy="60" r={SCORE_RING_RADIUS} />
                                {correctCount > 0 && (
                                    <circle
                                        className="word-challenge__score-value"
                                        cx="60"
                                        cy="60"
                                        r={SCORE_RING_RADIUS}
                                        strokeDasharray={`${(correctCount / results.length) * SCORE_RING_LENGTH} ${SCORE_RING_LENGTH}`}
                                    />
                                )}
                            </svg>
                            <h1><strong>{correctCount}</strong> / {results.length}</h1>
                        </div>
                        <p className="word-challenge__result-message">{resultMessage(correctCount, results.length)}</p>
                        {xpInfo?.failed && pendingFinishId && (
                            <button type="button" className="word-challenge__secondary" onClick={() => finishOnServer(pendingFinishId)} disabled={busy}>再結算一次</button>
                        )}
                        {xpInfo && (
                            <p className={`word-challenge__xp${xpInfo.xp > 0 ? " is-earned" : ""}`} role="status">
                                {xpInfo.failed ? "作答已記下，但成績與 XP 還沒結算成功。"
                                    : xpInfo.xp > 0 ? `這一輪得到 ${xpInfo.xp} XP！`
                                        : level === 0 ? "練錯的字不給 XP，但會記下哪些字學會了。"
                                            : xpInfo.fresh < 8 ? "一輪要有 8 個「第一次學會」的新字（沒用提示答對），才能得到 XP；已經會的字不算。"
                                                : "今天單字的 XP 已經拿滿 30 了，明天再來。"}
                            </p>
                        )}
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
                            {missedResults.length > 0 && <button type="button" className="word-challenge__primary" onClick={() => startRound(roundIsServer ? 0 : level, roundIsServer ? null : missedResults.map(result => result.key))} disabled={busy}>{roundIsServer ? "練最近錯的字" : "只練這輪錯的字"}</button>}
                            {level > 0 && <button type="button" className={missedResults.length > 0 ? "word-challenge__secondary" : "word-challenge__primary"} onClick={() => startRound(level)} disabled={busy}>同一級再挑戰</button>}
                            <button type="button" className="word-challenge__secondary" onClick={leaveRound}>換一級</button>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

export default WordChallenge;
