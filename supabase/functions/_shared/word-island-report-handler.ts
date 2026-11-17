// 老師端「單字島進度」Edge Function 的處理邏輯（只讀，不寫入任何資料）。
// 依賴（資料庫、身分驗證）從外面傳進來，方便用假資料在本機測試。
// 原則：role、班級、學生一律由伺服器重新判斷，不信任前端傳來的值；
// 老師只能看到 teacher_class_permissions 授權的班級（管理員看全部），名單只從該班的在學學生產生。
import { WORD_BANK_VERSION } from "./word-challenge-bank.generated.ts";
import { ROLLOUT_FEATURE_KEY } from "./word-challenge-handler.ts";
import type { ProgressRow } from "./word-challenge-island.ts";
import { SCOPE_CLASS_CODES, getManagedClassCodes } from "./teacher-scope.ts";
import { summarizeStudentIslands } from "./word-island-report.ts";

export type ReportCaller = { id: number; role: string };
export type WordIslandReportDeps = {
    admin: any;
    verifyUser: (req: Request) => Promise<ReportCaller>;
    serverForAll: boolean;
    // 現在的時間（毫秒）。測試用；沒給就用真的時間。
    now?: () => number;
};

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "7200"
};
const respond = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

class HttpError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const PAGE = 1000;
const joined = (value: any) => (Array.isArray(value) ? value[0] : value);

const taiwanDate = (nowMs: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowMs));

// 這個班目前在學的學生：和點名名單同一套規則（已排定離校、停用、非學生都不算）。
async function loadRoster(admin: any, classCode: string, nowMs: number) {
    const { data: klass, error: klassError } = await admin.from("academy_classes").select("id,code").eq("code", classCode).eq("is_active", true).maybeSingle();
    if (klassError) throw klassError;
    if (!klass) throw new HttpError(404, "class_not_found", "找不到班級");
    const today = taiwanDate(nowMs);
    const { data, error } = await admin.from("academy_enrollments")
        // academy_enrollments 有三條指向 students 的關聯，所以要指名是學生本人那一條。
        .select("student_id,scheduled_departure_at,students!academy_enrollments_student_id_fkey(id,name,chinese_name,english_name,role,account_status)")
        .eq("class_id", klass.id).eq("status", "active");
    if (error) throw error;
    return (data || [])
        .filter((row: any) => !row.scheduled_departure_at || String(row.scheduled_departure_at).slice(0, 10) > today)
        .map((row: any) => joined(row.students))
        .filter((student: any) => student?.role === "student" && (!student.account_status || student.account_status === "active"))
        .map((student: any) => ({ id: Number(student.id), name: String(student.chinese_name || student.name || student.english_name || "學生") }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name, "zh-Hant"));
}

// 一次最多回 1000 筆，所以分頁讀到最後一頁，不然人多時會少算。
async function loadProgress(admin: any, studentIds: number[]) {
    const byStudent = new Map<number, ProgressRow[]>();
    if (!studentIds.length) return byStudent;
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin.from("student_word_progress")
            .select("student_id,word_key,status,first_mastered_at,last_missed_at,last_correct_at,upgrade_level,last_upgraded_on")
            .in("student_id", studentIds).eq("bank_version", WORD_BANK_VERSION)
            .order("student_id").order("word_key").range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        for (const row of rows) {
            const id = Number(row.student_id);
            const stamp = (value: unknown) => (value instanceof Date ? value.toISOString() : value == null ? null : String(value));
            const list = byStudent.get(id) ?? [];
            list.push({
                word_key: String(row.word_key), status: String(row.status),
                first_mastered_at: stamp(row.first_mastered_at), last_missed_at: stamp(row.last_missed_at), last_correct_at: stamp(row.last_correct_at),
                upgrade_level: row.upgrade_level == null ? 0 : Number(row.upgrade_level),
                last_upgraded_on: row.last_upgraded_on == null ? null : String(row.last_upgraded_on).slice(0, 10)
            });
            byStudent.set(id, list);
        }
        if (rows.length < PAGE) break;
    }
    return byStudent;
}

export async function handleWordIslandReportRequest(req: Request, deps: WordIslandReportDeps): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return respond(405, { error: "不支援這個方法", code: "method_not_allowed" });

    try {
        const caller = await deps.verifyUser(req);
        if (caller.role !== "teacher" && caller.role !== "admin") throw new HttpError(403, "teacher_only", "只有老師與管理員可以看單字島進度");
        let body: any = {};
        try {
            body = await req.json();
        } catch {
            throw new HttpError(400, "invalid_body", "資料不正確");
        }
        const action = String(body?.action || "");
        const nowMs = (deps.now ?? Date.now)();

        if (action === "bootstrap") {
            return respond(200, { classes: await getManagedClassCodes(deps.admin, caller) });
        }

        if (action === "class_overview") {
            const classCode = String(body?.class_code ?? "").trim().toUpperCase().slice(0, 4);
            if (!SCOPE_CLASS_CODES.has(classCode)) throw new HttpError(400, "invalid_class", "請選擇 E1、E3、E5 或 E7");
            const managed = await getManagedClassCodes(deps.admin, caller);
            if (!managed.includes(classCode)) throw new HttpError(403, "class_not_allowed", "你沒有這個班級的權限");

            const roster = await loadRoster(deps.admin, classCode, nowMs);
            const ids = roster.map((student: any) => student.id);
            const progress = await loadProgress(deps.admin, ids);

            // 有沒有「存到帳號」：全面開放，或這位學生被逐一開放。沒開的學生進度只在他自己的裝置上，老師看不到。
            let recorded = new Set<number>();
            if (deps.serverForAll) {
                recorded = new Set(ids);
            } else if (ids.length) {
                const { data, error } = await deps.admin.from("student_feature_rollouts")
                    .select("student_id,enabled").in("student_id", ids).eq("feature_key", ROLLOUT_FEATURE_KEY);
                if (error) throw error;
                recorded = new Set((data || []).filter((row: any) => row.enabled === true).map((row: any) => Number(row.student_id)));
            }

            const students = roster.map((student: any) => ({
                student_id: student.id,
                name: student.name,
                recorded_to_account: recorded.has(student.id),
                ...summarizeStudentIslands(progress.get(student.id) ?? [], nowMs)
            }));
            const tracked = students.filter((student: any) => student.recorded_to_account);
            return respond(200, {
                class_code: classCode,
                generated_at: new Date(nowMs).toISOString(),
                totals: {
                    students: students.length,
                    recorded: tracked.length,
                    never_played: tracked.filter((student: any) => student.status_code === "never").length,
                    inactive_7_days: tracked.filter((student: any) => ["warning", "concern", "critical"].includes(student.status_code)).length
                },
                students
            });
        }

        throw new HttpError(400, "unknown_action", "不支援這個動作");
    } catch (error) {
        const status = Number((error as { status?: unknown })?.status);
        if (error instanceof HttpError || (Number.isInteger(status) && status >= 400 && status < 500)) {
            const known = error as HttpError;
            return respond(known.status, { error: known.message, code: known.code ?? null });
        }
        console.error("word-island-report failed", (error as { code?: string })?.code || (error as Error)?.name);
        return respond(500, { error: "單字島進度暫時讀不到", code: null });
    }
}
