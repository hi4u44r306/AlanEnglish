// 系統回報（網站崩潰、載入失敗）的純邏輯：清理診斷資訊、產生案件主旨與內容。不做任何 I/O，方便單元測試。
// 身分（姓名、角色）一律由後端依 Firebase token 查資料庫後傳入，不信任前端傳來的任何姓名或信箱。

export const SYSTEM_SUBJECT_PREFIX = "【系統回報】";
export const ANONYMOUS_PLACEHOLDER_EMAIL = "system-report@alanenglish.com.tw";

export type ReportKind = "render_crash" | "chunk_load" | "service_failure" | "manual";

const KIND_LABELS: Record<ReportKind, string> = {
    render_crash: "頁面崩潰",
    chunk_load: "載入失敗",
    service_failure: "連線異常",
    manual: "使用者回報"
};
const URGENT_KINDS = new Set<ReportKind>(["render_crash", "chunk_load"]);

export const isReportKind = (value: unknown): value is ReportKind =>
    typeof value === "string" && Object.prototype.hasOwnProperty.call(KIND_LABELS, value);

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

// 依序移除 token、簽名網址、email、長英數字串。清理完才截斷，避免截斷後長度又被清理改變。
export const sanitizeDiagnostic = (value: unknown, max = 600): string => {
    let text = String(value ?? "");
    text = text.replace(/eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g, "[token]");
    text = text.replace(/Bearer\s+[\w.~+/=-]+/gi, "Bearer [token]");
    text = text.replace(/https?:\/\/[^\s"'<>)]+/gi, url => {
        try {
            const parsed = new URL(url);
            return `${parsed.origin}${parsed.pathname}`;
        } catch {
            return "[url]";
        }
    });
    text = text.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]");
    text = text.replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[id]");
    return text.replace(/\s+\n/g, "\n").trim().slice(0, max);
};

// 堆疊只留前 5 行。
export const sanitizeStack = (value: unknown, max = 900): string =>
    sanitizeDiagnostic(String(value ?? "").split("\n").slice(0, 5).join("\n"), max);

// 只留路徑，不留 query／hash（邀請碼、重設密碼碼都在那裡）。
export const safePath = (value: unknown): string => {
    const raw = String(value ?? "").trim();
    const withoutQuery = raw.split(/[?#]/)[0];
    return withoutQuery.startsWith("/") ? withoutQuery.slice(0, 160) : "/";
};

// 簡單的 32 位雜湊，用來把「同一種錯誤」歸成同一個簽章。
export const errorSignature = (kind: string, name: string, message: string): string => {
    let hash = 5381;
    const input = `${kind}|${name}|${message.replace(/\d+/g, "#").slice(0, 120)}`;
    for (let index = 0; index < input.length; index += 1) hash = ((hash << 5) + hash + input.charCodeAt(index)) >>> 0;
    return hash.toString(16).padStart(8, "0").slice(0, 6);
};

export const isSafeReportId = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]{8,40}$/.test(value);

export type ReportIdentity = { studentId: number | null; name: string; role: string | null; email: string | null };

export type BuiltSystemReport = {
    kind: ReportKind;
    priority: "urgent" | "normal";
    subject: string;
    message: string;
    signature: string;
    reportId: string;
};

export const buildSystemReport = (body: Record<string, unknown>, identity: ReportIdentity, now = new Date()): BuiltSystemReport | null => {
    if (!isReportKind(body.kind) || !isSafeReportId(body.report_id)) return null;
    const kind = body.kind;
    const errorName = sanitizeDiagnostic(body.error_name, 60) || "Error";
    const errorMessage = sanitizeDiagnostic(body.error_message, 300);
    const signature = errorSignature(kind, errorName, errorMessage);
    const reportId = body.report_id;
    const subject = `${SYSTEM_SUBJECT_PREFIX}${KIND_LABELS[kind]} ${errorName} #${signature} r:${reportId.slice(0, 12)}`.slice(0, 160);
    const note = sanitizeDiagnostic(body.user_note, 200);
    const lines = [
        `類型：${KIND_LABELS[kind]}`,
        `身分：${identity.studentId ? `${identity.role || "unknown"}（學生資料 #${identity.studentId}）` : "未登入訪客"}`,
        `頁面：${safePath(body.path)}`,
        `時間：${now.toISOString()}`,
        `錯誤：${errorName}: ${errorMessage || "（無訊息）"}`,
        `版本：${clean(body.build, 60) || "未知"}`,
        `瀏覽器：${sanitizeDiagnostic(body.user_agent, 200) || "未知"}`,
        `視窗：${clean(body.viewport, 20) || "未知"}　網路：${body.online === false ? "離線" : "連線中"}`,
        note ? `使用者補充：${note}` : "使用者補充：（沒有填寫）",
        "",
        "堆疊（前 5 行）：",
        sanitizeStack(body.stack) || "（無）"
    ];
    return {
        kind,
        priority: URGENT_KINDS.has(kind) ? "urgent" : "normal",
        subject,
        message: lines.join("\n").slice(0, 3900),
        signature,
        reportId
    };
};
