import {
    supabaseKey,
    supabaseUrl
} from "../components/Pages/supabase-config";

const callAiMaterialFunction = async (
    firebaseUser,
    body = {}
) => {
    if (!firebaseUser) {
        throw new Error("請先登入 Alan English");
    }

    const firebaseToken = await firebaseUser.getIdToken();

    const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-ai-material`,
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
            "AI 教材服務暫時無法使用"
        );

        error.status = response.status;
        error.usage = result?.usage || null;
        throw error;
    }

    return result;
};

export const getAiMaterialUsage = async firebaseUser => {
    return await callAiMaterialFunction(
        firebaseUser,
        {
            action: "status"
        }
    );
};

export const getAiMaterialHistory = async firebaseUser => {
    return await callAiMaterialFunction(
        firebaseUser,
        {
            action: "history"
        }
    );
};

export const generateAiMaterial = async (
    firebaseUser,
    payload
) => {
    return await callAiMaterialFunction(
        firebaseUser,
        {
            action: "generate",
            ...payload
        }
    );
};

export const updateAiMaterialFavorite = async (
    firebaseUser,
    materialId,
    isFavorite
) => {
    return await callAiMaterialFunction(
        firebaseUser,
        {
            action: "favorite",
            material_id: materialId,
            is_favorite: isFavorite
        }
    );
};

export const markAiMaterialReviewed = async (
    firebaseUser,
    materialId
) => {
    return await callAiMaterialFunction(
        firebaseUser,
        {
            action: "mark_reviewed",
            material_id: materialId
        }
    );
};

export const submitAiMaterialAttempt = async (
    firebaseUser,
    materialId,
    answers
) => {
    return await callAiMaterialFunction(
        firebaseUser,
        {
            action: "submit_attempt",
            material_id: materialId,
            answers
        }
    );
};

export const getAiCostDashboard = async (
    firebaseUser,
    month
) => {
    return await callAiMaterialFunction(
        firebaseUser,
        {
            action: "cost_dashboard",
            month
        }
    );
};

export const updateAiCostBudget = async (
    firebaseUser,
    payload
) => {
    return await callAiMaterialFunction(
        firebaseUser,
        {
            action: "update_cost_budget",
            ...payload
        }
    );
};
