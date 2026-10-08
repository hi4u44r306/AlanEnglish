// Display snapshots only. Tokens, playback URLs and live challenge sessions never persist.
import { clearStudentLearningResume } from "./studentLearningResume";
const PREFIX = "ae-student-pages-v1:";
const KEEP_MS = 24 * 60 * 60 * 1000;
const FRESH_MS = 60 * 1000;
const MAX_BYTES = 1024 * 1024;
const MAX_ENTRIES = 24;
const entries = new Map();
const requests = new Map();
const generations = new Map();
const listeners = new Map();
let activeScope = "";

const storageKey = (scope, key) => `${PREFIX}${encodeURIComponent(scope)}:${encodeURIComponent(key)}`;
const notify = (id, reason) => listeners.get(id)?.forEach(listener => listener(reason));
const keysOnDisk = () => {
    try { return Object.keys(localStorage).filter(key => key.startsWith(PREFIX)); }
    catch { return []; }
};
const removeDisk = id => { try { localStorage.removeItem(id); } catch { /* Storage may be disabled. */ } };

export const studentPageScope = (user, role, profile) => {
    if (!user?.uid) return "";
    // A changed class/entitlement must not reuse another permission context's display data.
    const context = JSON.stringify([role, profile?.class, profile?.learner_type, profile?.enrollment_status, profile?.membership]);
    let hash = 0;
    for (let index = 0; index < context.length; index += 1) hash = ((hash * 31) + context.charCodeAt(index)) | 0;
    return `${user.uid}|${role || "unknown"}|${hash}`;
};

export const sanitizeStudentSnapshot = value => JSON.parse(JSON.stringify(value, (key, item) => {
    if (/token|password|secret|authorization|session|guardian|email|phone|family_message/i.test(key)) return undefined;
    if (/^(audio_?url|audioURL|signed_url)$/i.test(key)) return undefined;
    if (typeof item === "string" && /[?&](?:X-Amz-|token=|signature=|sig=)/i.test(item)) return undefined;
    return item;
}));

const persistEntry = (id, entry) => {
    try {
        const serialized = JSON.stringify({ value: sanitizeStudentSnapshot(entry.value), savedAt: entry.savedAt });
        if (serialized.length * 2 > MAX_BYTES / 2) { removeDisk(id); return; }
        const others = keysOnDisk().filter(key => key !== id).map(key => {
            const raw = localStorage.getItem(key) || "";
            let savedAt = 0;
            try { savedAt = JSON.parse(raw).savedAt || 0; } catch { /* Evict malformed snapshots. */ }
            return { key, bytes: raw.length * 2, savedAt };
        }).sort((left, right) => left.savedAt - right.savedAt);
        let bytes = others.reduce((total, item) => total + item.bytes, serialized.length * 2);
        while (others.length >= MAX_ENTRIES || bytes > MAX_BYTES) {
            const oldest = others.shift();
            if (!oldest) break;
            bytes -= oldest.bytes;
            removeDisk(oldest.key);
            entries.delete(oldest.key);
        }
        localStorage.setItem(id, serialized);
    } catch { removeDisk(id); /* Quota/security errors must not break learning. */ }
};

export const readStudentPageCache = (scope, key, { persist = true } = {}) => {
    if (!scope) return null;
    const id = storageKey(scope, key);
    let entry = entries.get(id);
    if (!entry && persist) {
        try {
            const parsed = JSON.parse(localStorage.getItem(id));
            if (parsed?.value && Number.isFinite(parsed.savedAt)) {
                entry = { ...parsed, validated: false };
                entries.set(id, entry);
            }
        } catch { removeDisk(id); }
    }
    if (!entry) return null;
    if (Date.now() - entry.savedAt > KEEP_MS || entry.savedAt > Date.now()) {
        entries.delete(id);
        removeDisk(id);
        return null;
    }
    return entry;
};

export const fetchStudentPageCache = (scope, key, loader, { persist = true, force = false } = {}) => {
    if (!scope) return Promise.resolve().then(loader);
    const id = storageKey(scope, key);
    const cached = readStudentPageCache(scope, key, { persist });
    if (!force && cached?.validated && !cached.stale && Date.now() - cached.savedAt < FRESH_MS) return Promise.resolve(cached.value);
    if (requests.has(id)) return requests.get(id);
    const generation = generations.get(id) || 0;
    let operation;
    try { operation = loader(); } catch (error) { operation = Promise.reject(error); }
    const request = Promise.resolve(operation).then(value => {
        if ((generations.get(id) || 0) === generation) {
            const entry = { value, savedAt: Date.now(), validated: true, stale: false };
            entries.set(id, entry);
            if (entries.size > MAX_ENTRIES) {
                for (const oldest of entries.keys()) {
                    if (entries.size <= MAX_ENTRIES) break;
                    if (!listeners.has(oldest)) entries.delete(oldest);
                }
            }
            if (persist) persistEntry(id, entry);
            notify(id, "updated");
        }
        return value;
    }).catch(error => {
        if ((generations.get(id) || 0) === generation && [401, 403, 404].includes(error?.status)) {
            entries.delete(id);
            removeDisk(id);
            notify(id, "removed");
        }
        throw error;
    }).finally(() => {
        if (requests.get(id) === request) requests.delete(id);
    });
    requests.set(id, request);
    return request;
};

export const subscribeStudentPageCache = (scope, key, listener) => {
    const id = storageKey(scope, key);
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id).add(listener);
    activeScope = scope;
    return () => {
        listeners.get(id)?.delete(listener);
        if (!listeners.get(id)?.size) listeners.delete(id);
    };
};

export const updateStudentPageCache = (scope, key, updater) => {
    const id = storageKey(scope, key);
    const entry = entries.get(id);
    if (!entry) return;
    entries.set(id, { ...entry, value: updater(entry.value) });
    // This merges a confirmed mutation for immediate display; a read refresh owns persistence.
    notify(id, "updated");
};

export const invalidateStudentPageCache = (uid, groups = ["assignments", "progress", "summary", "speaking", "weekly"]) => {
    if (!uid) return;
    const prefix = `${PREFIX}${encodeURIComponent(`${uid}|`)}`;
    new Set([...entries.keys(), ...requests.keys(), ...keysOnDisk()]).forEach(id => {
        if (!id.startsWith(prefix)) return;
        const key = decodeURIComponent(id.slice(id.lastIndexOf(":") + 1));
        if (!groups.some(group => key === group || key.startsWith(`${group}:`))) return;
        const entry = entries.get(id);
        if (entry) entry.stale = true;
        removeDisk(id); // A reload must not resurrect a snapshot invalidated by a successful write.
        generations.set(id, (generations.get(id) || 0) + 1);
        requests.delete(id);
        notify(id, "invalidated");
    });
};

export const clearStudentPageCache = uid => {
    clearStudentLearningResume(uid);
    const prefix = uid ? `${PREFIX}${encodeURIComponent(`${uid}|`)}` : PREFIX;
    new Set([...entries.keys(), ...requests.keys(), ...listeners.keys(), ...keysOnDisk()]).forEach(id => {
        if (!id.startsWith(prefix)) return;
        generations.set(id, (generations.get(id) || 0) + 1);
        requests.delete(id);
        entries.delete(id);
        removeDisk(id);
        notify(id, "removed");
    });
};

if (typeof window !== "undefined") {
    const refreshLearning = () => invalidateStudentPageCache(activeScope.split("|")[0]);
    window.addEventListener("ae:track-progress-updated", refreshLearning);
    window.addEventListener("ae:gamification-updated", refreshLearning);
    window.addEventListener("storage", event => {
        if (event.key === "ae-useruid" && event.oldValue !== event.newValue) clearStudentPageCache(event.oldValue);
        if (event.key?.startsWith(PREFIX)) {
            generations.set(event.key, (generations.get(event.key) || 0) + 1);
            entries.delete(event.key);
            requests.delete(event.key);
            // A write in another tab is a display update, not another network request.
            // Revalidating every storage write would create an endless ping-pong.
            notify(event.key, event.newValue ? "updated" : "removed");
        }
    });
}
