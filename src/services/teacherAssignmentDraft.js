const PREFIX = "ae-teacher-assignment-draft-v1:";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const memory = new Map();
const keyFor = uid => PREFIX + encodeURIComponent(uid);
const text = (value, limit = 500) => String(value || "").slice(0, limit);
const ids = value => Array.isArray(value) ? [...new Set(value.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 2000) : [];
const strings = value => Array.isArray(value) ? value.map(item => text(item, 500)).filter(Boolean).slice(0, 500) : [];

export function sanitizeCopyItems(value) {
    if (!Array.isArray(value)) return null;
    return value.slice(0, 30).map(item => {
        const base = { item_type: text(item?.item_type, 30), book_id: Number(item?.book_id),
            page_from_label: text(item?.page_from_label, 80), page_to_label: text(item?.page_to_label, 80) };
        if (base.item_type === "listening") return { ...base, track_ids: ids(item.track_ids), required_listens: Number(item.required_listens) || 3 };
        if (base.item_type === "ai_quiz") return { ...base, page_content_ids: ids(item.page_content_ids),
            ai_material_id: Number(item.ai_material_id) || 0, passing_score: Number(item.passing_score) || 80 };
        if (base.item_type === "pronunciation") return { ...base, page_content_ids: ids(item.page_content_ids),
            prompt_keys: strings(item.prompt_keys), completion_mode: item.completion_mode === "target_score" ? "target_score" : "practice",
            target_score: item.target_score == null ? null : Number(item.target_score), max_scored_attempts: Number(item.max_scored_attempts) || 3 };
        return null;
    }).filter(Boolean);
}

export function sanitizeAssignmentDraft(value) {
    const form = value?.form || {};
    const source = value?.sourceForm || {};
    return {
        form: { title: text(form.title, 200), description: text(form.description, 5000),
            target_class: ["E1", "E3", "E5", "E7"].includes(form.target_class) ? form.target_class : "",
            source_type: "music_track", assigned_date: text(form.assigned_date, 10), due_date: text(form.due_date, 10),
            required_listens: Number(form.required_listens) || 3 },
        bookId: text(value?.bookId, 30), trackIds: ids(value?.trackIds), rangeStart: text(value?.rangeStart, 20), rangeEnd: text(value?.rangeEnd, 20),
        mixedMode: value?.mixedMode === true, includeAiQuiz: value?.includeAiQuiz === true, includePronunciation: value?.includePronunciation === true,
        sourceBookId: text(value?.sourceBookId, 30), selectedPageContentIds: ids(value?.selectedPageContentIds),
        selectedAiMaterialId: text(value?.selectedAiMaterialId, 30), selectedPromptKeys: strings(value?.selectedPromptKeys),
        sourceForm: { page_label: text(source.page_label, 80), source_text: text(source.source_text, 30000), pronunciation_prompts: text(source.pronunciation_prompts, 30000) },
        copiedItems: sanitizeCopyItems(value?.copiedItems)
    };
}

export function hasAssignmentDraft(value) {
    return Boolean(value?.form?.title || value?.form?.description || value?.trackIds?.length
        || value?.selectedPageContentIds?.length || value?.copiedItems?.length
        || Object.values(value?.sourceForm || {}).some(Boolean));
}

export function readTeacherAssignmentDraft(uid, now = Date.now()) {
    if (!uid) return null;
    let stored;
    try {
        const raw = localStorage.getItem(keyFor(uid));
        stored = raw ? JSON.parse(raw) : memory.get(uid);
    } catch { stored = memory.get(uid); }
    if (!stored || !Number.isFinite(stored.savedAt) || stored.savedAt > now || now - stored.savedAt > MAX_AGE) {
        clearTeacherAssignmentDraft(uid);
        return null;
    }
    return { savedAt: stored.savedAt, draft: sanitizeAssignmentDraft(stored.draft) };
}

export function saveTeacherAssignmentDraft(uid, value, now = Date.now()) {
    if (!uid || !hasAssignmentDraft(value)) return null;
    const entry = { savedAt: now, draft: sanitizeAssignmentDraft(value) };
    const serialized = JSON.stringify(entry);
    if (serialized.length > 100000) { clearTeacherAssignmentDraft(uid); return { savedAt: now, persistent: false }; }
    memory.set(uid, entry);
    try { localStorage.setItem(keyFor(uid), serialized); return { savedAt: now, persistent: true }; }
    catch { return { savedAt: now, persistent: false }; }
}

export function clearTeacherAssignmentDraft(uid) {
    if (uid) {
        memory.delete(uid);
        try { localStorage.removeItem(keyFor(uid)); } catch { /* Optional storage. */ }
    } else {
        memory.clear();
        try { Object.keys(localStorage).filter(key => key.startsWith(PREFIX)).forEach(key => localStorage.removeItem(key)); } catch { /* Optional storage. */ }
    }
}
