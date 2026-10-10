// Staff display data and view preferences stay in memory for this login only.
const FRESH_MS = 30 * 1000;
const KEEP_MS = 5 * 60 * 1000;
const VIEW_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 12;
const entries = new Map(), requests = new Map(), views = new Map(), listeners = new Map(), generations = new Map();
let sessionGeneration = 0;
const idFor = (scope, key) => JSON.stringify([scope, key]);
const belongsTo = (id, uid) => !uid || JSON.parse(id)[0].startsWith(`${uid}|`);
const notify = (id, reason) => listeners.get(id)?.forEach(listener => listener(reason));
const trim = map => { while (map.size > MAX_ENTRIES) map.delete(map.keys().next().value); };
const displayOnly = value => JSON.parse(JSON.stringify(value, (key, item) => {
    if (key !== "must_change_password" && /token|password|secret|credentials|recovery_codes|activation_url|authorization/i.test(key)) return undefined;
    if (typeof item === "string" && /[?&](?:X-Amz-|token=|signature=|sig=)/i.test(item)) return undefined;
    return item;
}));
export const readStaffPageCache = (scope, key) => {
    if (!scope) return null;
    const id = idFor(scope, key), entry = entries.get(id);
    if (!entry) return null;
    const age = Date.now() - entry.savedAt;
    if (age < 0 || age > KEEP_MS) { entries.delete(id); return null; }
    return entry;
};
export const fetchStaffPageCache = (scope, key, loader, { force = false } = {}) => {
    const id = idFor(scope, key), cached = readStaffPageCache(scope, key);
    if (!force && cached && !cached.stale && Date.now() - cached.savedAt < FRESH_MS) return Promise.resolve(cached.value);
    if (requests.has(id)) return requests.get(id);
    const generation = generations.get(id) || 0, session = sessionGeneration;
    const request = Promise.resolve().then(loader).then(value => {
        const display = displayOnly(value);
        if (session === sessionGeneration && generation === (generations.get(id) || 0)) {
            entries.set(id, { value: display, savedAt: Date.now(), stale: false }); trim(entries); notify(id, "updated");
        }
        return display;
    }).catch(error => {
        if (session === sessionGeneration && generation === (generations.get(id) || 0) && [401, 403, 404].includes(Number(error?.status))) {
            entries.delete(id); views.delete(id); notify(id, "removed");
        }
        throw error;
    }).finally(() => { if (requests.get(id) === request) requests.delete(id); });
    requests.set(id, request); return request;
};
export const updateStaffPageCache = (scope, key, updater) => {
    const id = idFor(scope, key), entry = readStaffPageCache(scope, key);
    if (!entry) return;
    generations.set(id, (generations.get(id) || 0) + 1); requests.delete(id);
    entries.set(id, { ...entry, value: displayOnly(updater(entry.value)), stale: true }); notify(id, "updated");
};
export const subscribeStaffPageCache = (scope, key, listener) => {
    const id = idFor(scope, key);
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id).add(listener);
    return () => { listeners.get(id)?.delete(listener); if (!listeners.get(id)?.size) listeners.delete(id); };
};
export const readStaffView = (scope, key) => {
    if (!scope) return null;
    const id = idFor(scope, key), entry = views.get(id);
    if (!entry || Date.now() - entry.savedAt > VIEW_MS) { views.delete(id); return null; }
    return entry.value;
};
export const writeStaffView = (scope, key, value) => {
    if (!scope) return;
    views.set(idFor(scope, key), { value, savedAt: Date.now() }); trim(views);
};
export const clearStaffPageCache = uid => {
    sessionGeneration += 1;
    new Set([...entries.keys(), ...requests.keys(), ...views.keys(), ...listeners.keys()]).forEach(id => {
        if (!belongsTo(id, uid)) return;
        entries.delete(id); requests.delete(id); views.delete(id); generations.delete(id); notify(id, "removed");
    });
};

export const invalidateStaffPageCache = (uid, keys = ["accounts", "teacher-assignments"]) => {
    if (!uid) return;
    new Set([...entries.keys(), ...requests.keys()]).forEach(id => {
        if (!belongsTo(id, uid) || !keys.includes(JSON.parse(id)[1])) return;
        generations.set(id, (generations.get(id) || 0) + 1); requests.delete(id);
        const entry = entries.get(id); if (entry) entry.stale = true;
        notify(id, "updated");
    });
};
