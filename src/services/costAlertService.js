import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const request = async (firebaseUser, body) => {
    if (!firebaseUser) throw new Error("請先登入 Alan English");
    const response = await fetch(`${supabaseUrl}/functions/v1/cost-alert-manager`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await firebaseUser.getIdToken()}`, apikey: supabaseKey },
        body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "成本提醒服務暫時無法使用");
    return result;
};
export const getCostAlerts = firebaseUser => request(firebaseUser, { action: "status" });
export const subscribeCostAlerts = firebaseUser => request(firebaseUser, { action: "subscribe" });
export const acknowledgeCostAlert = (firebaseUser, alert) => request(firebaseUser, { action: "acknowledge", alert_id: alert.id, generation: alert.generation });
