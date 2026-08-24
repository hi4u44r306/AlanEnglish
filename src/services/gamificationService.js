import { callEdgeFunction } from "./edgeFunctionClient";
import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callGamification = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("gamification", firebaseUser, { action, ...payload })
);

export const getGamificationSummary = firebaseUser => callGamification(firebaseUser, "summary");
export const getGamificationClasses = firebaseUser => callGamification(firebaseUser, "classes");
export const getGamificationLeaderboard = (firebaseUser, period = "week", classCode = null) => (
    callGamification(firebaseUser, "leaderboard", { period, class_code: classCode })
);
export const getRewards = firebaseUser => callGamification(firebaseUser, "rewards");
export const redeemReward = (firebaseUser, rewardId) => callGamification(firebaseUser, "redeem", { reward_id: rewardId });
export const recordGameResult = (firebaseUser, { gameKey, sessionKey, won = false }) => (
    callGamification(firebaseUser, "game_result", {
        game_key: gameKey,
        session_key: sessionKey,
        won
    })
);
export const getRewardAdminCatalog = firebaseUser => callGamification(firebaseUser, "admin_catalog");
export const saveReward = (firebaseUser, reward) => callGamification(firebaseUser, "admin_save_reward", { reward });
export const deleteReward = (firebaseUser, rewardId) => callGamification(firebaseUser, "admin_delete_reward", { reward_id: rewardId });
export const updateRewardRedemption = (firebaseUser, redemptionId, status, note = "") => (
    callGamification(firebaseUser, "admin_update_redemption", {
        redemption_id: redemptionId,
        status,
        note
    })
);

export const uploadGamificationImage = async (firebaseUser, kind, file) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");
    if (!(file instanceof File)) throw new Error("請選擇圖片檔案");

    const firebaseToken = await firebaseUser.getIdToken();
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);

    const response = await fetch(`${supabaseUrl}/functions/v1/gamification`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${firebaseToken}`,
            apikey: supabaseKey
        },
        body: formData
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(result?.error || "圖片上傳失敗");
        error.status = response.status;
        throw error;
    }

    return result;
};
