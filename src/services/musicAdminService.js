import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callMusicAdminFunction = async (firebaseUser, body = {}) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");

    const firebaseToken = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/music-admin`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firebaseToken}`,
            apikey: supabaseKey
        },
        body: JSON.stringify(body)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result?.error || "音檔管理服務暫時無法使用");
        error.details = result?.details || null;
        throw error;
    }

    return result;
};

export const deleteMusicTrack = (firebaseUser, trackId) => callMusicAdminFunction(firebaseUser, {
    action: "delete_track",
    track_id: trackId
});

export const updateMusicTrackDisplayName = (firebaseUser, trackId, displayPage) => callMusicAdminFunction(firebaseUser, {
    action: "update_display_name",
    track_id: trackId,
    display_page: displayPage
});

export const getMusicBookManagementStatus = (firebaseUser, bookId) => callMusicAdminFunction(firebaseUser, {
    action: "book_status",
    book_id: bookId
});

export const deleteAllBookTracks = (firebaseUser, bookId) => callMusicAdminFunction(firebaseUser, {
    action: "delete_book_tracks",
    book_id: bookId
});

export const archiveMusicBook = (firebaseUser, bookId) => callMusicAdminFunction(firebaseUser, {
    action: "archive_book",
    book_id: bookId
});

export const restoreMusicBook = (firebaseUser, bookId) => callMusicAdminFunction(firebaseUser, {
    action: "restore_book",
    book_id: bookId
});

export const deleteMusicBook = (firebaseUser, bookId) => callMusicAdminFunction(firebaseUser, {
    action: "delete_book",
    book_id: bookId
});
