// How many times a student has gone into free practice on each level.
// One "time" is one practice visit (a client session) in which at least one recording was scored;
// recordings without a session id (older rows) are not counted.
export const PRACTICE_COUNT_PAGE_SIZE = 1000;
export const PRACTICE_COUNT_MAX_PAGES = 10;

export const countPracticeSessions = (rows: Array<{ question_set_id?: unknown; client_session_id?: unknown }>) => {
    const sessionsBySet = new Map<number, Set<string>>();
    for (const row of rows || []) {
        const setId = Number(row?.question_set_id);
        const session = String(row?.client_session_id || "");
        if (!Number.isInteger(setId) || setId <= 0 || !session) continue;
        if (!sessionsBySet.has(setId)) sessionsBySet.set(setId, new Set());
        sessionsBySet.get(setId)!.add(session);
    }
    return new Map([...sessionsBySet].map(([setId, sessions]) => [setId, sessions.size]));
};

// Reads only the two columns needed, newest first, in bounded pages.
export const loadPracticeSessionCounts = async (admin: any, studentId: number) => {
    const rows: any[] = [];
    for (let page = 0; page < PRACTICE_COUNT_MAX_PAGES; page += 1) {
        const from = page * PRACTICE_COUNT_PAGE_SIZE;
        const { data, error } = await admin.from("speaking_pronunciation_attempts")
            .select("question_set_id,client_session_id")
            .eq("student_id", studentId).eq("challenge_mode", "easy").not("client_session_id", "is", null)
            .order("created_at", { ascending: false }).order("id", { ascending: false })
            .range(from, from + PRACTICE_COUNT_PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < PRACTICE_COUNT_PAGE_SIZE) break;
    }
    return countPracticeSessions(rows);
};
