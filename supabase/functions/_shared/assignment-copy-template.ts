// Authoring identifiers/configuration only. Never include questions, answers or learner progress.
export function assignmentCopyTemplate(assignment: any, items: any[], aiItems: any[], prompts: any[], tracks: any[]) {
    if (assignment.source_type === "music_track") {
        const selected = tracks.filter(row => Number(row.assignment_id) === Number(assignment.id));
        return { source_type: "music_track", track_ids: selected.length
            ? selected.map(row => Number(row.track_id)) : [Number(assignment.track_id)].filter(Boolean),
        required_listens: Number(assignment.required_listens || 3) };
    }
    if (assignment.source_type !== "multi_activity_v2" || Number(assignment.schema_version) !== 2) return null;
    const selected = items.filter(row => Number(row.assignment_id) === Number(assignment.id));
    if (!selected.length) return null;
    const result = selected.map(item => {
        const base = { book_id: Number(item.book_id_snapshot),
            page_from_label: item.page_from_label || "", page_to_label: item.page_to_label || "" };
        const config = item.config || {};
        if (item.item_type === "listening") return { ...base, item_type: "listening" as const,
            track_ids: (item.content_snapshot?.tracks || []).map((row: any) => Number(row.id)),
            required_listens: Number(config.required_listens || 3) };
        const page_content_ids = (item.content_snapshot?.page_content || []).map((row: any) => Number(row.id));
        if (item.item_type === "ai_quiz") {
            const ai = aiItems.find(row => Number(row.assignment_item_id) === Number(item.id));
            return { ...base, item_type: "ai_quiz" as const, page_content_ids, ai_material_id: Number(ai?.ai_material_id),
                passing_score: Number(ai?.passing_score ?? config.passing_score ?? 80) };
        }
        if (item.item_type === "pronunciation") return { ...base, item_type: "pronunciation" as const, page_content_ids,
            prompt_keys: prompts.filter(row => Number(row.assignment_item_id) === Number(item.id)).map(row => row.prompt_key),
            completion_mode: config.completion_mode === "target_score" ? "target_score" : "practice",
            target_score: config.target_score ?? null, max_scored_attempts: Number(config.max_scored_attempts || 3) };
        return null;
    });
    if (result.some(item => !item || !item.book_id || (item.item_type === "listening"
        ? !item.track_ids?.length : !item.page_content_ids?.length)
        || (item.item_type === "ai_quiz" && !item.ai_material_id)
        || (item.item_type === "pronunciation" && !item.prompt_keys?.length))) return null;
    return { source_type: "multi_activity_v2", items: result };
}
