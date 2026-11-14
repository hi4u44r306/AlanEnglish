import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiFlag, FiX } from "react-icons/fi";
import Brand from "../fragment/Brand";
import { useAuth } from "../../auth/AuthContext";
import { WORD_BANK_VERSION, WORD_CHALLENGE_LEVELS, meaningPeersOf, wordsForLevel } from "../../services/wordChallengeBank";
import { answerWordChallenge, getWordIslandSummary, startWordIslandTile } from "../../services/wordChallengeService";
import { WORD_CHALLENGE_MODES, checkWordAnswer, lettersOnly, noteMessage } from "../../utils/wordChallengeAnswer";
import { ISLAND_SIZE, buildIslandViews, islandWordsOf } from "../../utils/wordIsland";
import "./css/WordIsland.scss";

// 單字島：看中文、拼出英文，答對才佔領那一格。
// 每格只答一次；答錯立刻公布答案，那一格冷卻到台北時間隔天，隔天答對才算學會（避免看了答案馬上打對）。
// 登入的學生走伺服器（進度記在帳號、由伺服器判斷）；訪客、老師、管理員、會員過期或連不上伺服器時用本機進度。
const MODE = WORD_CHALLENGE_MODES.meaning;
const STORAGE_KEY = `ae-word-island:${WORD_BANK_VERSION}`;
const LOCAL_NOTICE = "進度只存在這台裝置，換裝置或清除瀏覽器資料就會消失。";
const FALLBACK_NOTICE = "暫時連不上伺服器，這次先用這台裝置記錄。";

const loadLocal = () => {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
        return parsed && typeof parsed === "object" && parsed.progress ? parsed.progress : {};
    } catch {
        return {};
    }
};

const saveLocal = progress => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ progress }));
    } catch {
        // 私密瀏覽或禁止儲存時，只是不記住進度。
    }
};

// 例如 b _ _ _：先給第一個字母與字母數；伺服器題目給的是樣板。
const patternFromTemplate = template => template.map(slot => {
    if (slot.kind === "letter") return slot.hint || "_";
    return slot.kind === "gap" ? "  " : slot.value;
}).join(" ");

const patternFromWord = display => patternFromTemplate(String(display).split("").map((char, index) => {
    if (/[A-Za-z]/.test(char)) return { kind: "letter", hint: index === 0 ? char : "" };
    return char === " " ? { kind: "gap" } : { kind: "symbol", value: char };
}));

// 登入學生才可能走伺服器；其餘一律本機。
function useStudentAccount(variant) {
    const auth = useAuth();
    return variant === "app" && auth?.role === "student" && auth.firebaseUser ? auth.firebaseUser : null;
}

function QuestionSheet({ gloss, pattern, submit, onClose }) {
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);
    const [outcome, setOutcome] = useState(null);
    const inputRef = useRef(null);
    const lock = useRef(false);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const onSubmit = async event => {
        event.preventDefault();
        if (lock.current || outcome || !lettersOnly(typed)) return;
        lock.current = true;
        setBusy(true);
        try {
            setOutcome(await submit(typed));
        } catch (error) {
            setOutcome({ error: error?.message || "送出失敗，請稍後再試" });
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };

    const claimed = outcome?.correct === true && !outcome.recentlySeen;

    return (
        <div className="word-island__sheet-backdrop" role="presentation" onClick={onClose}>
            <form className="word-island__sheet" role="dialog" aria-modal="true" aria-label="佔領這一格" onSubmit={onSubmit} onClick={event => event.stopPropagation()}>
                <button className="word-island__sheet-close" type="button" onClick={onClose} aria-label="關閉"><FiX aria-hidden="true" /></button>
                <p className="word-island__sheet-eyebrow">看中文，拼出英文（只有一次機會）</p>
                <h2 className="word-island__sheet-gloss">{gloss}</h2>
                {outcome && !outcome.error && !outcome.correct ? (
                    <p className="word-island__sheet-answer">答案是 <strong>{outcome.expected}</strong><span>這一格明天再來佔領。</span></p>
                ) : (
                    <p className="word-island__sheet-pattern">{pattern}</p>
                )}
                {!outcome && (
                    <>
                        <input
                            ref={inputRef}
                            className="word-island__input"
                            value={typed}
                            onChange={event => setTyped(event.target.value)}
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck="false"
                            aria-label="輸入英文單字"
                            placeholder="輸入英文"
                        />
                        <button className="word-island__primary" type="submit" disabled={busy || !lettersOnly(typed)}>送出</button>
                    </>
                )}
                {outcome?.error && <p className="word-island__message" role="alert">{outcome.error}</p>}
                {outcome && !outcome.error && outcome.correct && (
                    <p className={`word-island__message${claimed ? " is-good" : ""}`} role="status">
                        {outcome.recentlySeen ? "剛看過這個字的答案，明天再答對才算學會。" : (outcome.message || "答對了，這一格是你的！")}
                    </p>
                )}
                {outcome && <button className="word-island__primary" type="button" onClick={onClose}>{claimed ? "回到島上" : "知道了"}</button>}
            </form>
        </div>
    );
}

function WordIsland({ variant = "public" }) {
    const studentUser = useStudentAccount(variant);
    const [level, setLevel] = useState(1);
    const [islandIndex, setIslandIndex] = useState(null);
    const [serverViews, setServerViews] = useState(null);
    const [localProgress, setLocalProgress] = useState(loadLocal);
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(Boolean(studentUser));
    const [openTile, setOpenTile] = useState(null);
    const [starting, setStarting] = useState(false);
    // 登入學生在伺服器回覆前不顯示格子，避免學生在「還不知道走哪個模式」時就作答、成績記到本機。
    const [usingLocal, setUsingLocal] = useState(false);
    const loadToken = useRef(0);

    const loadServer = useCallback(async targetLevel => {
        if (!studentUser) return;
        const token = loadToken.current + 1;
        loadToken.current = token;
        setLoading(true);
        try {
            const summary = await getWordIslandSummary(studentUser, targetLevel);
            if (token !== loadToken.current) return;
            if (summary?.mode === "server" && Array.isArray(summary.islands)) {
                setServerViews(summary.islands);
                setUsingLocal(false);
                setNotice("");
            } else {
                setServerViews(null);
                setUsingLocal(true);
                setNotice(LOCAL_NOTICE);
            }
        } catch {
            if (token !== loadToken.current) return;
            setServerViews(null);
            setUsingLocal(true);
            setNotice(FALLBACK_NOTICE);
        } finally {
            if (token === loadToken.current) setLoading(false);
        }
    }, [studentUser]);

    useEffect(() => {
        if (studentUser) loadServer(level);
        else setNotice(variant === "app" ? LOCAL_NOTICE : "");
    }, [studentUser, level, loadServer, variant]);

    const localWords = useMemo(() => islandWordsOf(wordsForLevel(level, MODE)), [level]);
    const localViews = useMemo(() => buildIslandViews(localWords, localProgress, Date.now()), [localWords, localProgress]);
    const serverMode = Boolean(studentUser && serverViews);
    const islands = serverMode ? serverViews : localViews;
    const ready = !studentUser || serverMode || usingLocal;

    // 一進來就停在「第一座還沒佔滿的島」；只有佔滿一座島才會出現「前往下一座島」。
    useEffect(() => {
        if (islandIndex !== null || !islands.length || loading || !ready) return;
        const firstOpen = islands.findIndex(item => item.claimed_count < item.total);
        setIslandIndex(firstOpen === -1 ? islands.length - 1 : firstOpen);
    }, [islandIndex, islands, loading, ready]);

    const safeIndex = Math.max(0, Math.min(islandIndex ?? 0, islands.length - 1));
    const island = islands[safeIndex];
    const cleared = Boolean(island) && island.claimed_count === island.total;

    const closeSheet = () => {
        setOpenTile(null);
        if (serverMode) loadServer(level);
    };

    // 本機模式：用畫面上的字庫批改；伺服器模式：答案由伺服器批改，答案在作答之後才回傳。
    const openLocalTile = tile => {
        const word = localWords[safeIndex * ISLAND_SIZE + tile.tile];
        setOpenTile({
            gloss: tile.gloss,
            pattern: patternFromWord(word.display),
            submit: async typed => {
                const result = checkWordAnswer(typed, word, MODE, meaningPeersOf(word));
                const nowIso = new Date().toISOString();
                const previous = localProgress[word.key] || {};
                const next = result.correct
                    ? { ...previous, status: "mastered", firstMasteredAt: previous.firstMasteredAt || nowIso }
                    : { ...previous, status: "missed", lastMissedAt: nowIso };
                const progress = { ...localProgress, [word.key]: next };
                setLocalProgress(progress);
                saveLocal(progress);
                return { correct: result.correct, expected: word.display, message: noteMessage(word, result) };
            }
        });
    };

    const openServerTile = async tile => {
        if (starting) return;
        setStarting(true);
        try {
            const started = await startWordIslandTile(studentUser, level, safeIndex, tile.tile);
            setOpenTile({
                gloss: started.question.gloss,
                pattern: patternFromTemplate(started.question.template),
                submit: async typed => {
                    const reply = await answerWordChallenge(studentUser, started.round_id, 0, { typed });
                    return { correct: reply.correct, expected: reply.expected, recentlySeen: reply.recently_seen === true, message: reply.recently_seen ? "" : noteMessage({ display: reply.expected }, { note: reply.note, matched: reply.matched }) };
                }
            });
        } catch (error) {
            setNotice(error?.message || FALLBACK_NOTICE);
            loadServer(level);
        } finally {
            setStarting(false);
        }
    };

    const onTileClick = tile => {
        if (tile.state !== "open") return;
        if (serverMode) openServerTile(tile);
        else openLocalTile(tile);
    };

    const tileLabel = tile => {
        if (tile.state === "claimed") return `已佔領：${tile.display}`;
        if (tile.state === "locked") return `${tile.gloss}，要先把上一座島佔滿`;
        if (tile.state === "cooldown") return `${tile.gloss}，剛看過答案，明天再來`;
        return `${tile.review ? "待複習：" : ""}${tile.gloss}，按下作答`;
    };

    return (
        <main className="word-island">
            <header className="word-island__header">
                <Link className="word-island__brand" to="/" aria-label="前往 Alan English 首頁"><Brand /></Link>
            </header>

            <section className="word-island__intro">
                <h1>單字島</h1>
                <p>看中文、拼出英文，答對就佔領一格。把整座島佔滿，就能前往下一座島。</p>
            </section>

            {notice && <p className="word-island__notice" role="status">{notice}</p>}

            <div className="word-island__levels" role="tablist" aria-label="選擇年級">
                {WORD_CHALLENGE_LEVELS.map(item => (
                    <button
                        key={item.level}
                        type="button"
                        role="tab"
                        aria-selected={item.level === level}
                        className={`word-island__chip${item.level === level ? " is-active" : ""}`}
                        onClick={() => { setLevel(item.level); setIslandIndex(null); setServerViews(null); setUsingLocal(false); }}
                    >{item.grade}年級</button>
                ))}
            </div>

            {!ready ? <p className="word-island__loading" role="status">載入中…</p> : null}

            {ready && island && (
                <section className="word-island__map" aria-label={`第 ${safeIndex + 1} 座島`}>
                    <div className="word-island__map-head">
                        <strong>第 {safeIndex + 1} 座島</strong>
                        <span>已佔領 {island.claimed_count} / {island.total}</span>
                    </div>
                    <div className="word-island__bar" aria-hidden="true"><i style={{ width: `${island.total ? (island.claimed_count / island.total) * 100 : 0}%` }} /></div>
                    <ul className="word-island__grid">
                        {island.tiles.map(tile => (
                            <li key={tile.tile}>
                                <button
                                    type="button"
                                    className={`word-island__tile is-${tile.state}${tile.review ? " is-review" : ""}`}
                                    aria-disabled={tile.state !== "open" ? "true" : undefined}
                                    onClick={() => onTileClick(tile)}
                                    aria-label={tileLabel(tile)}
                                >
                                    {tile.state === "claimed" ? <FiFlag className="word-island__flag" aria-hidden="true" /> : null}
                                    <span className="word-island__tile-text">{tile.state === "claimed" ? tile.display : tile.gloss}</span>
                                    {tile.state === "cooldown" ? <small>明天再來</small> : tile.review ? <small>待複習</small> : null}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {cleared && (
                        <p className="word-island__cleared" role="status">
                            {safeIndex + 1 < islands.length ? "這座島全部佔領了！" : "這個年級的島全部佔領了！"}
                            {safeIndex + 1 < islands.length && <button type="button" onClick={() => setIslandIndex(safeIndex + 1)}>前往下一座島</button>}
                        </p>
                    )}
                    {safeIndex > 0 && (
                        <button className="word-island__back" type="button" onClick={() => setIslandIndex(safeIndex - 1)}>回上一座島</button>
                    )}
                </section>
            )}

            {openTile && <QuestionSheet key={`${level}-${safeIndex}-${openTile.gloss}`} gloss={openTile.gloss} pattern={openTile.pattern} submit={openTile.submit} onClose={closeSheet} />}
        </main>
    );
}

export default WordIsland;
