import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callTourProgress = async (firebaseUser, body) => {
    if (!firebaseUser) throw new Error("尚未登入");

    const firebaseToken = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/tour-progress`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firebaseToken}`,
            apikey: supabaseKey
        },
        body: JSON.stringify(body)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || "導覽服務執行失敗");
    return result;
};

export const getTourProgress = (firebaseUser, tourKey, tourVersion = 1) => callTourProgress(firebaseUser, {
    action: "get",
    tour_key: tourKey,
    tour_version: tourVersion
});

export const completeTourProgress = (firebaseUser, tourKey, tourVersion = 1) => callTourProgress(firebaseUser, {
    action: "complete",
    tour_key: tourKey,
    tour_version: tourVersion
});
