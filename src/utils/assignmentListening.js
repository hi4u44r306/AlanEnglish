export const normalizeListeningTracks = assignment => {
    if (Array.isArray(assignment?.tracks) && assignment.tracks.length) {
        return assignment.tracks.map((item, index) => {
            const track = item?.track || item || {};
            const requiredListens = Number(
                item?.required_listens || assignment?.required_listens || 3
            );
            const playCount = Number(item?.play_count ?? track?.play_count ?? 0);
            return {
                key: track?.id || item?.track_id || item?.id || index,
                id: track?.id || item?.track_id || item?.id || null,
                label: (
                    track?.display_page
                    || track?.page
                    || track?.title
                    || track?.music_name
                    || "音檔 " + (index + 1)
                ),
                book: (
                    track?.book
                    || item?.book
                    || assignment?.track?.book
                    || null
                ),
                requiredListens,
                playCount,
                completed: Boolean(item?.completed) || playCount >= requiredListens
            };
        });
    }

    if (assignment?.track) {
        const requiredListens = Number(assignment?.required_listens || 3);
        const playCount = Number(assignment?.progress?.play_count || 0);
        return [{
            key: assignment.track.id,
            id: assignment.track.id,
            label: (
                assignment.track.display_page
                || assignment.track.page
                || assignment.track.title
                || "音檔"
            ),
            book: assignment.track.book || null,
            requiredListens,
            playCount,
            completed: (
                Boolean(assignment?.progress?.completed)
                || playCount >= requiredListens
            )
        }];
    }

    return [];
};


export const assignmentProgressLabel = assignment => {
    if (assignment?.source_type === "music_track") {
        const tracks = normalizeListeningTracks(assignment);
        return tracks.length ? `指定音檔：已完成 ${tracks.filter(track => track.completed).length} / ${tracks.length} 個` : "音檔進度待確認";
    }
    const total = Number(assignment?.progress?.total_tasks);
    return total > 0 ? `已完成 ${Number(assignment.progress.task_completed_count) || 0} / ${total} 個步驟` : "打開作業查看完成條件";
};

// Teachers often start a title with a bare date such as 20260824. Students read it more
// easily as 2026/08/24; anything that is not a real calendar date is left exactly as typed.
export const assignmentDisplayTitle = title => String(title ?? "").replace(/^(\s*)(\d{4})(\d{2})(\d{2})(?!\d)\s*/, (match, lead, year, month, day) => {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    const real = Number(year) >= 2000 && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
    return real ? `${lead}${year}/${month}/${day} ` : match;
}).trimEnd();
