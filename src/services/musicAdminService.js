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

export const getMusicAdminBootstrap = firebaseUser => callMusicAdminFunction(firebaseUser, {
    action: "bootstrap"
});

export const createMusicBook = (firebaseUser, payload) => callMusicAdminFunction(firebaseUser, {
    action: "create_book",
    ...payload
});

export const listMusicTracks = (firebaseUser, bookId) => callMusicAdminFunction(firebaseUser, {
    action: "list_tracks",
    book_id: bookId
});

export const checkMusicTrack = (firebaseUser, bookId, trackKey) => callMusicAdminFunction(firebaseUser, {
    action: "check_track",
    book_id: bookId,
    track_key: trackKey
});

export const createMusicUpload = (firebaseUser, bookId, trackKey, storagePath) => callMusicAdminFunction(firebaseUser, {
    action: "create_upload",
    book_id: bookId,
    track_key: trackKey,
    storage_path: storagePath
});

export const finalizeMusicUpload = (firebaseUser, payload) => callMusicAdminFunction(firebaseUser, {
    action: "finalize_upload",
    ...payload
});

export const deleteMusicTrack = (firebaseUser, trackId) => callMusicAdminFunction(firebaseUser, {
    action: "delete_track",
    track_id: trackId
});

export const updateMusicTrackDisplayName = (firebaseUser, trackId, displayPage) => callMusicAdminFunction(firebaseUser, {
    action: "update_display_name",
    track_id: trackId,
    display_page: displayPage
});

export const getR2AudioStatus = firebaseUser => callMusicAdminFunction(firebaseUser, {
    action: "r2_status"
});

export const prepareR2AudioTest = firebaseUser => callMusicAdminFunction(firebaseUser, {
    action: "prepare_r2_test"
});

export const confirmR2AudioTest = (firebaseUser, testKey) => callMusicAdminFunction(firebaseUser, {
    action: "confirm_r2_test",
    test_key: testKey
});

export const migrateR2AudioBatch = (firebaseUser, limit = 1) => callMusicAdminFunction(firebaseUser, {
    action: "migrate_r2_batch",
    limit
});

export const rollbackR2AudioTrack = (firebaseUser, trackId) => callMusicAdminFunction(firebaseUser, {
    action: "rollback_r2_track",
    track_id: trackId
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
