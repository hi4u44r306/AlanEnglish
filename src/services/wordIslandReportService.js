import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

// 老師端「單字島進度」：只讀。身分與班級權限都由伺服器判斷，這裡只送動作與班級代碼。
const callReport = async (firebaseUser, body) => {
    if (!firebaseUser) throw new Error("尚未登入");
    const firebaseToken = await firebaseUser.getIdToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/word-island-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${firebaseToken}`, apikey: supabaseKey },
        body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || "單字島進度暫時讀不到");
    return result;
};

export const getWordIslandReportBootstrap = firebaseUser => callReport(firebaseUser, { action: "bootstrap" });
export const getWordIslandClassOverview = (firebaseUser, classCode) => callReport(firebaseUser, { action: "class_overview", class_code: classCode });
