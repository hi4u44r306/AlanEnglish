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
        throw new Error(
            result?.error ||
            `${functionName} 執行失敗`
        );
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

export const recordTrackPlay = async (
    firebaseUser,
    trackId
) => {
    return await callListeningFunction(
        "record-play",
        firebaseUser,
        {
            track_id: trackId
        }
    );
};