import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

export const callEdgeFunction = async (functionName, firebaseUser, body = {}) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");

    const firebaseToken = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
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
        const error = new Error(result?.error || `${functionName} 服務暫時無法使用`);
        error.status = response.status;
        error.code = result?.code || null;
        error.details = result?.details || null;
        throw error;
    }

    return result;
};
