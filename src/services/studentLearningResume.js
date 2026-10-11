const PREFIX = "ae-learning-resume-v1:";
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 8;
const HISTORY_PREFIX = "ae-learning-history-v1:";
const MAX_BOOKS = 12;
const memory = new Map();
const listeners = new Set();
const historyKeyFor = scope => `${HISTORY_PREFIX}${encodeURIComponent(scope)}`;
const keyFor = scope => `${PREFIX}${encodeURIComponent(scope)}`;
const notify = () => listeners.forEach(listener => listener());
const keysOnDisk = () => {
    try { return Object.keys(localStorage).filter(key => key.startsWith(PREFIX)); }
    catch { return []; }
};
const remove = key => {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch { /* Storage is optional. */ }
};
const identifier = value => typeof value === "number" || typeof value === "string"
    ? /^[a-zA-Z0-9_-]{1,100}$/.test(String(value)) ? String(value) : "" : "";
const text = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const normalize = value => {
    if (!value || !identifier(value.bookId) || !identifier(value.trackId) || !text(value.bookCode, 120)
        || !Number.isFinite(value.savedAt) || value.savedAt > Date.now() || Date.now() - value.savedAt > KEEP_MS) return null;
    return { bookId: identifier(value.bookId), bookCode: text(value.bookCode, 120), trackId: identifier(value.trackId),
        trackTitle: text(value.trackTitle, 200), page: text(value.page, 80), savedAt: value.savedAt };
};

export const readStudentLearningResume = scope => {
    if (!scope || !scope.includes("|student|")) return null;
    const key = keyFor(scope);
    let value = memory.get(key);
    if (!value) {
        try { value = JSON.parse(localStorage.getItem(key)); } catch { /* Ignore malformed storage. */ }
    }
    const result = normalize(value);
    if (!result) { remove(key); return null; }
    memory.set(key, result);
    return result;
};

// One bookmark per book, newest first, so each material remembers where the student stopped.
export const readStudentLearningHistory = scope => {
    if (!scope || !scope.includes("|student|")) return [];
    let value = memory.get(historyKeyFor(scope));
    if (!value) {
        try { value = JSON.parse(localStorage.getItem(historyKeyFor(scope))); } catch { /* Ignore malformed storage. */ }
    }
    return (Array.isArray(value) ? value : []).map(normalize).filter(Boolean).slice(0, MAX_BOOKS);
};

export const saveStudentLearningResume = (scope, book, track) => {
    if (!scope || !scope.includes("|student|")) return;
    const value = normalize({ bookId: book?.id, bookCode: book?.code, trackId: track?.id,
        trackTitle: track?.title || track?.music_name || track?.musicName, page: track?.page, savedAt: Date.now() });
    if (!value) return;
    const key = keyFor(scope);
    const keys = [...new Set([...keysOnDisk(), ...memory.keys()])].filter(item => item !== key && item.startsWith(PREFIX));
    while (keys.length >= MAX_ENTRIES) remove(keys.shift());
    memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Retain the in-memory bookmark. */ }
    const history = [value, ...readStudentLearningHistory(scope).filter(item => item.bookId !== value.bookId)].slice(0, MAX_BOOKS);
    memory.set(historyKeyFor(scope), history);
    try { localStorage.setItem(historyKeyFor(scope), JSON.stringify(history)); } catch { /* Retain the in-memory history. */ }
    notify();
};

export const clearStudentLearningResume = uid => {
    const prefix = uid ? `${PREFIX}${encodeURIComponent(`${uid}|`)}` : PREFIX;
    const historyPrefix = uid ? `${HISTORY_PREFIX}${encodeURIComponent(`${uid}|`)}` : HISTORY_PREFIX;
    let stored = [];
    try { stored = Object.keys(localStorage); } catch { /* Storage is optional. */ }
    new Set([...stored, ...memory.keys()]).forEach(key => { if (key.startsWith(prefix) || key.startsWith(historyPrefix)) remove(key); });
    notify();
};

export const subscribeStudentLearningResume = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const findResumeBook = (bookmark, books) => bookmark
    ? books.find(book => String(book.id) === bookmark.bookId && book.code === bookmark.bookCode && !book.locked && book.canOpen !== false)
    : null;

export const learningResumePath = (book, bookmark) => `/student/books/${encodeURIComponent(book.code)}?resume=${encodeURIComponent(bookmark.trackId)}`;

if (typeof window !== "undefined") {
    window.addEventListener("storage", event => {
        if (event.key === null || event.key.startsWith(PREFIX) || event.key.startsWith(HISTORY_PREFIX)) { memory.clear(); notify(); }
    });
}
