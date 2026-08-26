import { callEdgeFunction } from "./edgeFunctionClient";
import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

export const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const MAX_AVATAR_SOURCE_SIZE = 20 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 1600;
const AVATAR_OUTPUT_SIZE = 800;

const callGamification = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("gamification", firebaseUser, { action, ...payload })
);

export const getGamificationSummary = firebaseUser => callGamification(firebaseUser, "summary");
export const selectStudentAvatarPreset = (firebaseUser, avatarPath) => callGamification(firebaseUser, "select_avatar_preset", { avatar_path: avatarPath });
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

const assertAvatarSource = file => {
    if (!(file instanceof File)) throw new Error("請選擇圖片檔案");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("只支援 JPG、PNG、WebP 圖片");
    if (file.size > MAX_AVATAR_SOURCE_SIZE) throw new Error("原始照片請控制在 20MB 以內");
};

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

export const createSquareAvatarImage = async (file, { zoom = 1, offsetX = 0, offsetY = 0, previewSize = 280 } = {}) => {
    assertAvatarSource(file);

    const image = await loadImage(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const safePreviewSize = Math.max(1, Number(previewSize) || 280);
    const safeZoom = clamp(Number(zoom) || 1, 1, 3);
    const displayScale = Math.max(safePreviewSize / sourceWidth, safePreviewSize / sourceHeight) * safeZoom;
    const cropSize = Math.min(sourceWidth, sourceHeight, safePreviewSize / displayScale);
    const cropLeft = clamp((sourceWidth - cropSize) / 2 - (Number(offsetX) || 0) / displayScale, 0, sourceWidth - cropSize);
    const cropTop = clamp((sourceHeight - cropSize) / 2 - (Number(offsetY) || 0) / displayScale, 0, sourceHeight - cropSize);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("目前瀏覽器無法處理頭像裁切");
    context.drawImage(image, cropLeft, cropTop, cropSize, cropSize, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);

    const blob = await canvasToWebp(canvas, 0.92);
    if (!blob) throw new Error("頭像裁切失敗，請再試一次");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "avatar"}.webp`, { type: "image/webp" });
};

export const prepareAvatarImage = async file => {
    assertAvatarSource(file);
    if (file.size <= MAX_AVATAR_FILE_SIZE) return file;

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
