// Read-only snapshot. Call only with the Firebase-verified user's database ID.
export const speakingAudioMonth = (now: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei", year: "numeric", month: "2-digit"
    }).formatToParts(now);
    const year = Number(parts.find(part => part.type === "year")?.value);
    const month = Number(parts.find(part => part.type === "month")?.value) - 1;
    return {
        starts_at: new Date(Date.UTC(year, month, 1, -8)).toISOString(),
        resets_at: new Date(Date.UTC(year, month + 1, 1, -8)).toISOString()
    };
};

export const loadSpeakingAudioUsage = async (admin: any, studentId: number, now = new Date()) => {
    try {
        if (!Number.isSafeInteger(studentId) || studentId <= 0) throw new Error("Invalid verified user");
        const month = speakingAudioMonth(now);
        const { data: policy, error: policyError } = await admin.from("speaking_audio_budget_policy")
            .select("student_monthly_seconds,global_monthly_seconds").eq("id", true).maybeSingle();
        const limit = policy?.student_monthly_seconds;
        if (policyError || !Number.isInteger(limit) || limit <= 0
            || !Number.isInteger(policy?.global_monthly_seconds) || policy.global_monthly_seconds <= 0) throw new Error("Audio policy unavailable");
        let used = 0;
        let offset = 0;
        // Pagination avoids showing an inflated allowance after the API row limit.
        for (let page = 0; page < 20; page += 1) {
            const { data, count, error } = await admin.from("speaking_pronunciation_requests")
                .select("audio_seconds,interaction_type", { count: "exact" })
                .eq("student_id", studentId).gte("created_at", month.starts_at)
                .lt("created_at", now.toISOString())
                .order("created_at", { ascending: true }).order("id", { ascending: true })
                .range(offset, offset + 999);
            if (error || !Array.isArray(data) || !Number.isInteger(count)) throw new Error("Audio usage unavailable");
            for (const request of data) {
                const seconds = request.audio_seconds ??
                    (["alphabet_round", "letter_spelling"].includes(request.interaction_type) ? 12 : 25);
                if (!Number.isInteger(seconds) || seconds < 1 || seconds > 25) throw new Error("Invalid usage duration");
                used += seconds;
            }
            offset += data.length;
            if (offset >= count) return {
                status: "ready", limit_seconds: limit, used_seconds: used,
                remaining_seconds: Math.max(0, limit - used), resets_at: month.resets_at
            };
            if (!data.length) throw new Error("Incomplete usage snapshot");
        }
    } catch {
        // Keep the catalog usable; never invent zero use or expose database errors.
    }
    return { status: "unavailable" };
};
