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