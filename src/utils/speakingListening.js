const positiveId = value => /^\d+$/.test(String(value || "")) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

const trackPages = track => {
    const value = String(track.base_page || track.page || "").trim();
    const match = value.match(/^(?:P[.\s]*)?(\d+)(?:\s*[～~-]\s*(\d+))?$/i);
    if (!match) return [];
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end - start > 20) return [];
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const speakingListeningSource = challenge => {
    if (challenge?.generation_metadata?.interaction_type === "alphabet_round") return null;
    const book = challenge?.books || challenge?.book;
    const pages = challenge?.source_pages || challenge?.generation_metadata?.source_pages;
    if (!positiveId(challenge?.id) || !positiveId(book?.id) || !book?.code || !Array.isArray(pages) || !pages.length || !pages.every(positiveId)) return null;
    return { bookId: Number(book.id), bookCode: book.code, pages: [...new Set(pages.map(Number))] };
};

export const matchedSpeakingTracks = (source, response) => {
    if (!source || Number(response?.book?.id) !== source.bookId) return [];
    const pages = new Set(source.pages);
    return (response?.tracks || []).filter(track => {
        const exactPages = trackPages(track);
        return positiveId(track.id) && Number(track.book_id) === source.bookId && exactPages.length > 0 && exactPages.every(page => pages.has(page)) && track.audio_url;
    });
};

export const speakingListeningPath = (source, challengeId, mode, tracks) => {
    const params = new URLSearchParams({ speaking: String(challengeId), mode: mode === "challenge" ? "challenge" : "easy", tracks: tracks.map(track => track.id).join(",") });
    return `/student/books/${encodeURIComponent(source.bookCode)}?${params}`;
};

export const speakingListeningContext = search => {
    const params = new URLSearchParams(search);
    const id = params.get("speaking");
    const mode = params.get("mode");
    const tracks = (params.get("tracks") || "").split(",");
    if (!positiveId(id) || !["easy", "challenge"].includes(mode) || !tracks.length || tracks.length > 100 || !tracks.every(positiveId)) return null;
    return { id: Number(id), mode, trackIds: new Set(tracks.map(String)), returnPath: `/student/speaking-challenges/${Number(id)}?mode=${mode}` };
};
