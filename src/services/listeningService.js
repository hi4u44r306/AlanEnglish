import {
    supabaseKey,
    supabaseUrl
} from "../components/Pages/supabase-config";

const callListeningFunction = async (
    functionName,
    firebaseUser,
    body = {}
) => {
    if (!firebaseUser) {
        throw new Error("尚未登入");
    }

    const firebaseToken = await firebaseUser.getIdToken();

    const response = await fetch(
        `${supabaseUrl}/functions/v1/${functionName}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${firebaseToken}`,
                apikey: supabaseKey
            },
            body: JSON.stringify(body)
        }
    );

    const result = await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
        const error = new Error(
            result?.error ||
            `${functionName} 執行失敗`
        );
        error.status = response.status;
        throw error;
    }

    return result;
};

export const getDashboardStats = async firebaseUser => {
    return await callListeningFunction(
        "get-dashboard-stats",
        firebaseUser
    );
};

export const getBookPlaybackProgress = async (
    firebaseUser,
    bookId
) => {
    return await callListeningFunction(
        "get-playback-progress",
        firebaseUser,
        {
            book_id: bookId
        }
    );
};

// 接著聽：伺服器記得的「最近完整聽過的音檔」，換電腦或登出再登入也還在。
export const getRecentListening = async firebaseUser => callListeningFunction(
    "get-playback-progress",
    firebaseUser,
    { action: "recent_tracks" }
);

export const recordTrackPlay = async (
    firebaseUser,
    trackId,
    listeningSession = {}
) => {
    return await callListeningFunction(
        "record-play",
        firebaseUser,
        {
            track_id: trackId,
            action: "complete",
            listening_session: listeningSession
        }
    );
};

export const startListeningSession = async (
    firebaseUser,
    trackId,
    durationSeconds
) => {
    return await callListeningFunction(
        "record-play",
        firebaseUser,
        {
            track_id: trackId,
            action: "start",
            duration_seconds: durationSeconds
        }
    );
};
