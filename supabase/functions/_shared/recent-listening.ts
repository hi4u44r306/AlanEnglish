// 「接著聽」的伺服器來源：學生最近完整聽過（有效聆聽）的音檔，每本教材只留最新的一首。
// 只回傳這位學生自己聽過的音檔 id、書籍代碼與標題；能不能開啟由前端對照教材權限決定。
export const RECENT_LISTENING_LIMIT = 12;

export type RecentListeningItem = {
    book_id: number;
    book_code: string;
    track_id: number;
    track_title: string;
    page: string;
    last_played_at: string;
};

export const shapeRecentListening = (progressRows: any[], trackRows: any[], bookRows: any[], limit = RECENT_LISTENING_LIMIT): RecentListeningItem[] => {
    const tracks = new Map((trackRows || []).filter(track => track?.enabled !== false).map(track => [Number(track.id), track]));
    const books = new Map((bookRows || []).map(book => [Number(book.id), book]));
    const newestFirst = [...(progressRows || [])]
        .filter(row => row?.last_played_at && Number.isFinite(Date.parse(row.last_played_at)))
        .sort((left, right) => Date.parse(right.last_played_at) - Date.parse(left.last_played_at));
    const seenBooks = new Set<number>();
    const result: RecentListeningItem[] = [];
    for (const row of newestFirst) {
        const track = tracks.get(Number(row.track_id));
        const book = track ? books.get(Number(track.book_id)) : null;
        if (!track || !book?.code || seenBooks.has(Number(book.id))) continue;
        seenBooks.add(Number(book.id));
        result.push({
            book_id: Number(book.id),
            book_code: String(book.code),
            track_id: Number(track.id),
            track_title: String(track.music_name || track.title || "").slice(0, 200),
            page: String(track.page ?? "").slice(0, 80),
            last_played_at: new Date(row.last_played_at).toISOString()
        });
        if (result.length >= limit) break;
    }
    return result;
};
