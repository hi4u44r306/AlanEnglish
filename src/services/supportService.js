import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callSupport = async (firebaseUser, body) => {
    const token = firebaseUser && typeof firebaseUser.getIdToken === "function"
        ? await firebaseUser.getIdToken(true)
        : null;
    let response;
    try {
        response = await fetch(`${supabaseUrl}/functions/v1/support-manager`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: supabaseKey,
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(body)
        });
    } catch {
        throw new Error("無法連線至客服服務，請檢查網路後再試。");
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) throw new Error(result?.error || "客服服務暫時無法使用");
    return result;
};

export const submitSupportTicket = (firebaseUser, ticket) => callSupport(firebaseUser, { action: "submit", ...ticket });
export const listSupportTickets = firebaseUser => callSupport(firebaseUser, { action: "list" });
export const updateSupportTicket = (firebaseUser, ticket) => callSupport(firebaseUser, { action: "update", ...ticket });
