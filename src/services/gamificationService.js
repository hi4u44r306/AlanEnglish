import { callEdgeFunction } from "./edgeFunctionClient";
import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

export const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const MAX_AVATAR_SOURCE_SIZE = 20 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 1600;

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
    if (kind === "avatar" && file.size > MAX_AVATAR_FILE_SIZE) {
        throw new Error("學生頭像請控制在 5MB 以內");
    }

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

const loadImage = file => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
    };
    image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("無法讀取這張圖片"));
    };
    image.src = url;
});

const canvasToWebp = (canvas, quality) => new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));

export const prepareAvatarImage = async file => {
    if (!(file instanceof File)) throw new Error("請選擇圖片檔案");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("只支援 JPG、PNG、WebP 圖片");
    if (file.size <= MAX_AVATAR_FILE_SIZE) return file;
    if (file.size > MAX_AVATAR_SOURCE_SIZE) throw new Error("原始照片請控制在 20MB 以內");

    const image = await loadImage(file);
    const largestEdge = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height, 1);
    const scale = Math.min(1, MAX_AVATAR_DIMENSION / largestEdge);
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);

    let blob = null;
    for (let quality = 0.9; quality >= 0.5; quality -= 0.1) {
        const candidate = await canvasToWebp(canvas, quality);
        if (!candidate) continue;
        blob = candidate;
        if (candidate.size <= MAX_AVATAR_FILE_SIZE) break;
    }
    if (!blob || blob.size > MAX_AVATAR_FILE_SIZE) throw new Error("照片壓縮後仍超過 5MB，請換一張較小的照片");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "avatar"}.webp`, { type: "image/webp" });
};
