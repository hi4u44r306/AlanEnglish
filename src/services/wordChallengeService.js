import { callEdgeFunction } from "./edgeFunctionClient";

// 單字大挑戰：伺服器版（成績記到帳號、答對 8 題給 XP）。
// 伺服器沒有開放、不是學生或連線失敗時，畫面會退回本機模式，所以這裡的錯誤只要往上丟。
// 連線卡住時不能讓畫面一直等：超過時限就當作失敗（finish 等動作在伺服器端是冪等的，重試是安全的）。
export const WORD_CHALLENGE_TIMEOUT_MS = 12000;

const withTimeout = (promise, timeoutMs = WORD_CHALLENGE_TIMEOUT_MS) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("連線太久沒有回應"), { code: "timeout" })), timeoutMs);
    promise.then(
        value => { clearTimeout(timer); resolve(value); },
        error => { clearTimeout(timer); reject(error); }
    );
});

const call = (firebaseUser, body) => withTimeout(callEdgeFunction("word-challenge", firebaseUser, body));

export const getWordChallengeSummary = firebaseUser => call(firebaseUser, { action: "summary" });
export const startWordChallengeRound = (firebaseUser, level) => call(firebaseUser, { action: "start_round", level });
export const revealWordChallengeHint = (firebaseUser, roundId, position) => call(firebaseUser, { action: "hint", round_id: roundId, position });
export const answerWordChallenge = (firebaseUser, roundId, position, { typed = "", skipped = false } = {}) =>
    call(firebaseUser, { action: "answer", round_id: roundId, position, typed, skipped });
export const finishWordChallengeRound = (firebaseUser, roundId) => call(firebaseUser, { action: "finish", round_id: roundId });
