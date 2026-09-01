import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import Stripe from "npm:stripe@22.4.0";
import { createR2PresignedUrl } from "../_shared/r2.ts";
import { cleanText, verifyFirebaseRequest, type VerifiedAlanUser } from "../_shared/firebase-auth.ts";
import { loadEffectiveAccess } from "../_shared/effective-access.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const CLASS_CODES = new Set(["E1", "E3", "E5", "E7"]);
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
});
const one = (value: any) => Array.isArray(value) ? value[0] || null : value || null;
const int = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const ids = (value: unknown) => [...new Set((Array.isArray(value) ? value : []).map(int).filter(Boolean))] as number[];
const isoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(cleanText(value, 10)) ? cleanText(value, 10) : null;
const relation = (value: any) => Array.isArray(value) ? value : [];
const errorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) return error.message;
    const message = (error as any)?.message;
    return typeof message === "string" && message.trim() ? message : "教材商務服務暫時無法使用";
};
const errorStatus = (error: unknown) => {
    const explicit = Number((error as any)?.status);
    if (Number.isInteger(explicit) && explicit >= 400 && explicit <= 599) return explicit;
    const code = String((error as any)?.code || "");
    if (code === "42501") return 403;
    if (code === "P0002") return 404;
    if (new Set(["23505", "40001"]).has(code)) return 409;
    if (code === "23514") return 400;
    return 500;
};
const taipeiToday = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

const createAdmin = () => {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Supabase 伺服器設定不完整");
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

async function optionalCaller(req: Request, admin: any): Promise<VerifiedAlanUser | null> {
    if (!(req.headers.get("Authorization") || "").startsWith("Bearer ")) return null;
    return await verifyFirebaseRequest(req, admin);
}

async function managedClasses(admin: any, caller: VerifiedAlanUser) {
    if (caller.role === "admin") {
        const { data, error } = await admin.from("academy_classes")
            .select("id,code,name_zh,sort_order").in("code", [...CLASS_CODES]).eq("is_active", true).order("sort_order");
        if (error) throw error;
        return data || [];
    }
    if (caller.role !== "teacher") return [];
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin.from("teacher_class_permissions")
        .select("class_id,can_publish,starts_at,ends_at,academy_classes(id,code,name_zh,sort_order)")
        .eq("teacher_id", caller.id).lte("starts_at", today).or(`ends_at.is.null,ends_at.gte.${today}`);
    if (error) throw error;
    return (data || []).map((row: any) => ({ ...one(row.academy_classes), can_publish: row.can_publish }));
}

async function currentClassSetting(admin: any, classId: number, at = new Date().toISOString().slice(0, 10)) {
    const { data, error } = await admin.from("academy_class_material_settings")
        .select("*,academy_class_material_books(id,book_id,sort_order,books(id,name,code,category_id,content_scope))")
        .eq("class_id", classId).eq("is_active", true).lte("effective_from", at)
        .or(`effective_to.is.null,effective_to.gte.${at}`).order("version", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
}

async function publicPackages(admin: any, _caller: VerifiedAlanUser | null) {
    const { data, error } = await admin.from("material_packages").select(`
        id,name,level_code,suitable_for,learning_goals,description,cover_url,recommendation_rank,
        standard_price_twd,includes_90_day_access,status,inventory_quantity,max_quantity_per_order,
        prerequisite_package_id,next_package_id,
        material_package_books(id,role,sort_order,books(id,name,code,description,preview_image_url)),
        material_package_tracks(id,role,sort_order,music_tracks(id,book_id,title,music_name,audio_url,storage_provider,preview_enabled))
    `).eq("status", "published").eq("stripe_livemode", false).order("recommendation_rank").order("id");
    if (error) throw error;
    const packages = await Promise.all((data || []).map(async (item: any) => {
        const samples = [];
        for (const join of relation(item.material_package_tracks)) {
            const track = one(join.music_tracks);
            if (join.role !== "sample_audio" || !track?.preview_enabled) continue;
            let signedUrl: string | null = null;
            const path = cleanText(track.audio_url, 2000).replace(/^\/+/, "");
            if (path && track.storage_provider === "r2") signedUrl = await createR2PresignedUrl(path, "GET", 600);
            else if (path) {
                const { data: signed } = await admin.storage.from("music").createSignedUrl(path, 600);
                signedUrl = signed?.signedUrl || null;
            }
            samples.push({ id: track.id, title: track.title || track.music_name, audio_url: signedUrl });
        }
        return {
            ...item,
            stripe_product_id: undefined,
            price_type: "standard",
            display_price_twd: item.standard_price_twd,
            member_price_eligible: false,
            samples
        };
    }));
    return packages;
}

async function placementAssessment(admin: any) {
    const { data, error } = await admin.from("placement_assessments")
        .select("id,name,placement_questions(id,skill,prompt,audio_prompt,choices,difficulty,sort_order,track_id)")
        .eq("status", "published").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
        id: data.id, name: data.name,
        questions: relation(data.placement_questions).sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((q: any) => ({
                id: q.id, skill: q.skill, prompt: q.prompt, choices: q.choices,
                audio_prompt: q.skill === "listening" && !q.track_id ? q.audio_prompt : null
            }))
    };
}

async function submitPlacement(admin: any, caller: VerifiedAlanUser | null, body: any) {
    const assessmentId = int(body.assessment_id);
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    if (!assessmentId) throw Object.assign(new Error("測驗資料不完整"), { status: 400 });
    const { data: questions, error } = await admin.from("placement_questions")
        .select("id,skill,correct_choice,difficulty").eq("assessment_id", assessmentId);
    if (error) throw error;
    if (!questions?.length) throw Object.assign(new Error("找不到程度測驗"), { status: 404 });
    const scores: Record<string, { correct: number; total: number }> = {
        vocabulary: { correct: 0, total: 0 }, sentence: { correct: 0, total: 0 }, listening: { correct: 0, total: 0 }
    };
    let weighted = 0;
    let possible = 0;
    for (const q of questions) {
        scores[q.skill].total += 1;
        possible += Number(q.difficulty || 1);
        if (Number(answers[String(q.id)]) === Number(q.correct_choice)) {
            scores[q.skill].correct += 1;
            weighted += Number(q.difficulty || 1);
        }
    }
    const ratio = possible ? weighted / possible : 0;
    const packages = await publicPackages(admin, caller);
    const pivot = packages.length ? Math.min(packages.length - 1, Math.max(0, Math.floor(ratio * packages.length))) : -1;
    const recommendations = pivot < 0
        ? []
        : packages.length < 3
            ? [{ label: "建議", package: packages[pivot] }]
            : [
                { label: "較簡單", package: packages[Math.max(0, pivot - 1)] },
                { label: "建議", package: packages[pivot] },
                { label: "較有挑戰", package: packages[Math.min(packages.length - 1, pivot + 1)] }
            ].filter((x, index, all) => all.findIndex(y => y.package?.id === x.package?.id) === index);
    const { error: insertError } = await admin.from("placement_attempts").insert({
        assessment_id: assessmentId, student_id: caller?.role === "student" ? caller.id : null,
        anonymous_key: caller ? null : cleanText(body.anonymous_key, 120) || crypto.randomUUID(),
        answers, skill_scores: scores, recommended_package_id: recommendations.find(x => x.label === "建議")?.package?.id || null
    });
    if (insertError) throw insertError;
    return { skill_scores: scores, score_ratio: ratio, recommendations };
}

async function studentProfile(admin: any, caller: VerifiedAlanUser) {
    if (caller.role !== "student") throw Object.assign(new Error("只有學生可以查看此設定"), { status: 403 });
    const [enrollment, entitlements, purchases, access, guardian, game, level, grants] = await Promise.all([
        admin.from("academy_enrollments").select("*,academy_classes(id,code,name_zh)").eq("student_id", caller.id).order("enrolled_at", { ascending: false }),
        admin.from("student_book_entitlements").select("*,books(id,name,code)").eq("student_id", caller.id).eq("status", "active"),
        admin.from("material_purchases").select("id,status,price_type,amount_twd,paid_at,created_at,material_packages(id,name,level_code)").eq("student_id", caller.id).order("created_at", { ascending: false }),
        loadEffectiveAccess(admin, caller.id),
        admin.from("guardian_contacts").select("guardian_name,email,notification_enabled").eq("student_id", caller.id).maybeSingle(),
        admin.from("student_gamification_balances").select("total_xp,points_balance").eq("student_id", caller.id).maybeSingle(),
        admin.from("student_level_progress").select("unlocked_rank,learning_levels(id,code,name_zh,name_en,rank)").eq("student_id", caller.id).maybeSingle(),
        admin.from("student_access_grants").select("id,status,ends_at,current_period_end,cancel_at_period_end,stripe_subscription_status,subscription_plans(id,code,name,access_model)").eq("student_id", caller.id).order("created_at", { ascending: false })
    ]);
    const firstError = [enrollment.error, entitlements.error, purchases.error, guardian.error, game.error, level.error, grants.error].find(Boolean);
    if (firstError) throw firstError;
    const current = (enrollment.data || []).find((e: any) => ["active", "paused"].includes(e.status)) || null;
    const status = current?.scheduled_departure_at ? "scheduled_departure" : current ? "active" : (enrollment.data || []).length ? "departed" : "not_enrolled";
    const classBooks = current ? relation((await currentClassSetting(admin, current.class_id))?.academy_class_material_books).map((j: any) => one(j.books)) : [];
    return {
        student: caller, enrollment_status: status, current_enrollment: current, enrollment_history: enrollment.data || [],
        class_books: classBooks, direct_entitlements: entitlements.data || [], purchases: purchases.data || [],
        access, guardian: guardian.data || null, gamification: game.data || { total_xp: 0, points_balance: 0 },
        level: level.data ? { ...level.data, learning_levels: one(level.data.learning_levels) } : null,
        plans: grants.data || []
    };
}

async function staffBootstrap(admin: any, caller: VerifiedAlanUser) {
    if (!new Set(["teacher", "admin"]).has(caller.role)) throw Object.assign(new Error("沒有管理權限"), { status: 403 });
    const classes = await managedClasses(admin, caller);
    const classIds = classes.map((c: any) => c.id);
    const [books, settings, audit, packages, tracks, students] = await Promise.all([
        admin.from("books").select("id,name,code,category_id,content_scope,book_categories(id,name,code)").eq("enabled", true).is("archived_at", null).order("category_id").order("sort_order"),
        classIds.length ? admin.from("academy_class_material_settings").select("*,academy_class_material_books(*,books(id,name,code,category_id))").in("class_id", classIds).order("version", { ascending: false }) : { data: [], error: null },
        classIds.length ? admin.from("academy_class_material_audit_log").select("*,students!academy_class_material_audit_log_created_by_fkey(id,name)").in("class_id", classIds).order("created_at", { ascending: false }).limit(100) : { data: [], error: null },
        caller.role === "admin" ? admin.from("material_packages").select("*,material_package_books(*),material_package_tracks(*)").order("created_at", { ascending: false }) : { data: [], error: null },
        caller.role === "admin" ? admin.from("music_tracks").select("id,book_id,title,music_name,preview_enabled,subtitle_status").eq("enabled", true).order("book_id").order("sort_order") : { data: [], error: null },
        caller.role === "admin" ? admin.from("students").select("id,name,chinese_name,english_name,class,learner_type,account_status,academy_enrollments!academy_enrollments_student_id_fkey(id,status,enrolled_at,scheduled_departure_at,departed_at,access_ends_at,class_id)").eq("role", "student").order("name") : { data: [], error: null }
    ]);
    const firstError = [books.error, settings.error, audit.error, packages.error, tracks.error, students.error].find(Boolean);
    if (firstError) throw firstError;
    return { role: caller.role, read_only: caller.role !== "admin", classes, books: books.data || [], settings: settings.data || [], audit: audit.data || [], packages: packages.data || [], tracks: tracks.data || [], students: students.data || [] };
}

async function classImpact(admin: any, classId: number, effectiveFrom: string, bookIds: number[]) {
    const { data, error } = await admin.rpc("preview_academy_class_material_rollover", {
        p_class_id: classId, p_effective_from: effectiveFrom, p_book_ids: bookIds
    });
    if (error) throw error;
    return data || {};
}

async function saveClassMaterials(admin: any, caller: VerifiedAlanUser, body: any) {
    if (caller.role !== "admin") throw Object.assign(new Error("只有管理員可以修改班級教材"), { status: 403 });
    const classCode = cleanText(body.class_code, 2);
    const effectiveFrom = isoDate(body.effective_from);
    const termLabel = cleanText(body.term_label, 80);
    const bookIds = ids(body.book_ids);
    if (!CLASS_CODES.has(classCode) || !effectiveFrom || !termLabel || !bookIds.length) throw Object.assign(new Error("班級、學期名稱、教材或生效日不完整"), { status: 400 });
    const { data: klass, error: classError } = await admin.from("academy_classes").select("id,code").eq("code", classCode).eq("is_active", true).single();
    if (classError) throw classError;
    const { data: validBooks, error: bookError } = await admin.from("books").select("id").in("id", bookIds).eq("enabled", true).is("archived_at", null);
    if (bookError) throw bookError;
    if ((validBooks || []).length !== bookIds.length) throw Object.assign(new Error("包含不存在或已停用的教材"), { status: 400 });
    const impact = await classImpact(admin, klass.id, effectiveFrom, bookIds);
    if (!body.confirmed) return { preview: true, ...impact };
    const { data, error } = await admin.rpc("rollover_academy_class_materials", {
        p_class_id: klass.id,
        p_effective_from: effectiveFrom,
        p_book_ids: bookIds,
        p_term_label: termLabel,
        p_actor_id: caller.id
    });
    if (error) throw error;
    return data || {};
}

async function correctClassMaterials(admin: any, caller: VerifiedAlanUser, body: any) {
    if (caller.role !== "admin") throw Object.assign(new Error("只有管理員可以修正班級教材"), { status: 403 });
    const classCode = cleanText(body.class_code, 2);
    const settingId = int(body.setting_id);
    const termLabel = cleanText(body.term_label, 80);
    const bookIds = ids(body.book_ids);
    if (!CLASS_CODES.has(classCode) || !settingId || !termLabel || !bookIds.length) {
        throw Object.assign(new Error("班級、目前版本、學期名稱或教材不完整"), { status: 400 });
    }
    const { data: klass, error: classError } = await admin.from("academy_classes")
        .select("id,code").eq("code", classCode).eq("is_active", true).single();
    if (classError) throw classError;
    const { data: validBooks, error: bookError } = await admin.from("books")
        .select("id").in("id", bookIds).eq("enabled", true).is("archived_at", null);
    if (bookError) throw bookError;
    if ((validBooks || []).length !== bookIds.length) {
        throw Object.assign(new Error("包含不存在或已停用的教材"), { status: 400 });
    }
    if (!body.confirmed) {
        const { data, error } = await admin.rpc("preview_academy_class_material_correction", {
            p_class_id: klass.id,
            p_setting_id: settingId,
            p_book_ids: bookIds,
            p_term_label: termLabel
        });
        if (error) throw error;
        return data || {};
    }
    const expectedUpdatedAt = cleanText(body.expected_updated_at, 60);
    if (!expectedUpdatedAt) throw Object.assign(new Error("請重新預覽目前版本後再確認修正"), { status: 400 });
    const { data, error } = await admin.rpc("correct_academy_class_materials", {
        p_class_id: klass.id,
        p_setting_id: settingId,
        p_book_ids: bookIds,
        p_term_label: termLabel,
        p_actor_id: caller.id,
        p_expected_updated_at: expectedUpdatedAt
    });
    if (error) throw error;
    return data || {};
}

async function savePackage(admin: any, caller: VerifiedAlanUser, body: any) {
    if (caller.role !== "admin") throw Object.assign(new Error("只有管理員可以管理教材商品包"), { status: 403 });
    const packageId = int(body.id);
    const name = cleanText(body.name, 160);
    if (!name) throw Object.assign(new Error("請填寫商品包名稱"), { status: 400 });
    if (packageId) {
        const { data: existing, error: existingError } = await admin.from("material_packages").select("status").eq("id", packageId).maybeSingle();
        if (existingError) throw existingError;
        if (!existing) throw Object.assign(new Error("找不到商品包"), { status: 404 });
        if (existing.status === "published") {
            throw Object.assign(new Error("已上架商品包請先停售，再修改價格或教材內容"), { status: 409 });
        }
    }
    const nullablePrice = (v: unknown) => v === null || v === "" || v === undefined ? null : int(v);
    const nullableInventory = (v: unknown) => {
        if (v === null || v === "" || v === undefined) return null;
        const parsed = Number(v);
        if (!Number.isInteger(parsed) || parsed < 0) throw Object.assign(new Error("實體庫存必須是 0 以上的整數，或留空表示不追蹤"), { status: 400 });
        return parsed;
    };
    const payload = {
        name, level_code: cleanText(body.level_code, 80) || null, suitable_for: cleanText(body.suitable_for, 300) || null,
        learning_goals: cleanText(body.learning_goals, 3000), description: cleanText(body.description, 5000), cover_url: cleanText(body.cover_url, 1000) || null,
        prerequisite_package_id: int(body.prerequisite_package_id), next_package_id: int(body.next_package_id), recommendation_rank: Number(body.recommendation_rank || 0),
        standard_price_twd: nullablePrice(body.standard_price_twd), member_price_twd: null,
        inventory_quantity: nullableInventory(body.inventory_quantity), max_quantity_per_order: int(body.max_quantity_per_order) || 10,
        includes_90_day_access: body.includes_90_day_access !== false, stripe_product_id: cleanText(body.stripe_product_id, 300) || null,
        stripe_standard_price_id: cleanText(body.stripe_standard_price_id, 300) || null, stripe_member_price_id: null,
        stripe_livemode: false, updated_by: caller.id
    };
    if (payload.max_quantity_per_order > 20) throw Object.assign(new Error("每筆最多購買數量必須介於 1 到 20"), { status: 400 });
    const result = packageId ? await admin.from("material_packages").update(payload).eq("id", packageId).select("*").single()
        : await admin.from("material_packages").insert({ ...payload, created_by: caller.id }).select("*").single();
    if (result.error) throw result.error;
    const id = result.data.id;
    await Promise.all([admin.from("material_package_books").delete().eq("package_id", id), admin.from("material_package_tracks").delete().eq("package_id", id)]);
    const bookRows = relation(body.books).map((x: any, index) => ({ package_id: id, book_id: int(x.book_id), role: cleanText(x.role, 40), sort_order: index })).filter((x: any) => x.book_id && new Set(["textbook","workbook","listening_book","web_material"]).has(x.role));
    const trackRows = relation(body.tracks).map((x: any, index) => ({ package_id: id, track_id: int(x.track_id), role: cleanText(x.role, 40), sort_order: index })).filter((x: any) => x.track_id && new Set(["included_audio","sample_audio"]).has(x.role));
    if (bookRows.length) { const x = await admin.from("material_package_books").insert(bookRows); if (x.error) throw x.error; }
    if (trackRows.length) { const x = await admin.from("material_package_tracks").insert(trackRows); if (x.error) throw x.error; }
    await admin.from("commerce_audit_log").insert({ actor_id: caller.id, action: packageId ? "package_updated" : "package_created", entity_type: "material_package", entity_id: id, after_snapshot: { ...result.data, books: bookRows, tracks: trackRows } });
    return { package: result.data };
}

async function setPackageStatus(admin: any, caller: VerifiedAlanUser, body: any, status: "published" | "discontinued") {
    if (caller.role !== "admin") throw Object.assign(new Error("只有管理員可以管理教材商品包"), { status: 403 });
    const packageId = int(body.id); if (!packageId) throw Object.assign(new Error("商品包編號不正確"), { status: 400 });
    const { data: before } = await admin.from("material_packages").select("*").eq("id", packageId).maybeSingle();
    if (!before) throw Object.assign(new Error("找不到商品包"), { status: 404 });
    const { data, error } = await admin.from("material_packages").update({ status, updated_by: caller.id }).eq("id", packageId).select("*").single();
    if (error) throw error;
    await admin.from("commerce_audit_log").insert({ actor_id: caller.id, action: `package_${status}`, entity_type: "material_package", entity_id: packageId, before_snapshot: before, after_snapshot: data });
    return { package: data };
}

async function lifecycleDetail(admin: any, caller: VerifiedAlanUser, studentId: number, materialHistoryAsOf = taipeiToday()) {
    if (caller.role !== "admin") throw Object.assign(new Error("只有管理員可以管理離校流程"), { status: 403 });
    const { data: student, error } = await admin.from("students").select("id,name,chinese_name,english_name,class,learner_type,account_status").eq("id", studentId).eq("role", "student").maybeSingle();
    if (error) throw error; if (!student) throw Object.assign(new Error("找不到學生"), { status: 404 });
    const profile = await studentProfile(admin, { ...student, firebase_uid: "", email: null, role: "student" });
    const [{ data: assignments }, materialHistory] = await Promise.all([
        admin.from("assignments").select("id,title,due_at,enabled").eq("target_class", student.class).eq("enabled", true),
        admin.rpc("get_student_academy_material_history", { p_student_id: studentId, p_as_of: materialHistoryAsOf })
    ]);
    if (materialHistory.error) throw materialHistory.error;
    return { ...profile, historical_class_books: materialHistory.data || [], affected_assignments: assignments || [] };
}

async function changeDeparture(admin: any, caller: VerifiedAlanUser, body: any, action: string) {
    if (caller.role !== "admin") throw Object.assign(new Error("只有管理員可以管理離校流程"), { status: 403 });
    const studentId = int(body.student_id); if (!studentId) throw Object.assign(new Error("學生編號不正確"), { status: 400 });
    const processedOn = taipeiToday();
    const detail = await lifecycleDetail(admin, caller, studentId, isoDate(body.effective_date) || processedOn);
    const enrollment = detail.current_enrollment
        || (action === "restore_student" ? detail.enrollment_history?.[0] || null : null);
    if (!enrollment) throw Object.assign(new Error("學生目前沒有在校紀錄"), { status: 409 });
    const { data: stripeGrants, error: stripeGrantError } = await admin.from("student_access_grants")
        .select("id,stripe_subscription_id,stripe_subscription_status,cancel_at_period_end")
        .eq("student_id", studentId).eq("source", "stripe");
    if (stripeGrantError) throw stripeGrantError;
    if (action === "departure_preview") return { preview: true, detail };
    if (action === "schedule_departure") {
        const date = isoDate(body.effective_date);
        if (!date || date < processedOn) throw Object.assign(new Error("離校生效日不得早於今天"), { status: 400 });
        if (!body.confirmed) return { preview: true, detail };
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2026-07-29.dahlia" }) : null;
        for (const grant of stripeGrants || []) {
            if (stripe && grant.stripe_subscription_id && ["active", "trialing", "past_due"].includes(grant.stripe_subscription_status)) {
                await stripe.subscriptions.update(grant.stripe_subscription_id, { cancel_at_period_end: true });
                await admin.from("student_access_grants").update({ cancel_at_period_end: true }).eq("id", grant.id);
            }
        }
        const { error } = await admin.from("academy_enrollments").update({ scheduled_departure_at: date, departure_reason: cleanText(body.reason, 1000) || null, departure_scheduled_by: caller.id }).eq("id", enrollment.id);
        if (error) throw error;
        await admin.from("academy_enrollment_lifecycle_events").insert({ enrollment_id: enrollment.id, student_id: studentId, event_type: "departure_scheduled", effective_date: date, impact_snapshot: detail, reason: cleanText(body.reason, 1000) || null, created_by: caller.id });
        return { scheduled_departure_at: date };
    }
    if (action === "cancel_departure" || action === "restore_student") {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2026-07-29.dahlia" }) : null;
        for (const grant of stripeGrants || []) {
            if (stripe && grant.stripe_subscription_id && grant.cancel_at_period_end && grant.stripe_subscription_status !== "canceled") {
                await stripe.subscriptions.update(grant.stripe_subscription_id, { cancel_at_period_end: false });
                await admin.from("student_access_grants").update({ cancel_at_period_end: false }).eq("id", grant.id);
            }
        }
        const update = action === "restore_student" ? { status: "active", scheduled_departure_at: null, departed_at: null, access_ends_at: null, departure_completed_by: null }
            : { scheduled_departure_at: null, departure_reason: null, departure_scheduled_by: null };
        const { error } = await admin.from("academy_enrollments").update(update).eq("id", enrollment.id); if (error) throw error;
        await admin.from("academy_enrollment_lifecycle_events").insert({ enrollment_id: enrollment.id, student_id: studentId, event_type: action === "restore_student" ? "restored" : "departure_cancelled", impact_snapshot: detail, created_by: caller.id });
        return { restored: true };
    }
    if (action === "process_departure") {
        if (!enrollment.scheduled_departure_at || enrollment.scheduled_departure_at > processedOn) throw Object.assign(new Error("尚未到離校生效日"), { status: 409 });
        const { data, error } = await admin.rpc("process_academy_departure_with_materials", {
            p_enrollment_id: enrollment.id,
            p_student_id: studentId,
            p_completed_by: caller.id,
            p_processed_on: processedOn,
            p_impact_snapshot: detail
        });
        if (error) throw error;
        return data || { departed_at: enrollment.scheduled_departure_at };
    }
    throw Object.assign(new Error("不支援的離校操作"), { status: 400 });
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    try {
        const admin = createAdmin();
        const body = await req.json().catch(() => ({}));
        const action = cleanText(body.action || "packages", 60);
        const isPublic = new Set(["packages", "placement_assessment", "submit_placement"]).has(action);
        const caller = isPublic ? await optionalCaller(req, admin) : await verifyFirebaseRequest(req, admin);
        if (action === "packages") return json(200, { success: true, packages: await publicPackages(admin, caller) });
        if (action === "placement_assessment") return json(200, { success: true, assessment: await placementAssessment(admin) });
        if (action === "submit_placement") return json(200, { success: true, ...(await submitPlacement(admin, caller, body)) });
        if (!caller) return json(401, { error: "請先登入 Alan English" });
        if (action === "student_profile") return json(200, { success: true, profile: await studentProfile(admin, caller) });
        if (action === "staff_bootstrap") return json(200, { success: true, ...(await staffBootstrap(admin, caller)) });
        if (action === "preview_class_materials" || action === "save_class_materials") return json(200, { success: true, ...(await saveClassMaterials(admin, caller, { ...body, confirmed: action === "save_class_materials" && body.confirmed === true })) });
        if (action === "preview_current_class_materials" || action === "correct_current_class_materials") return json(200, { success: true, ...(await correctClassMaterials(admin, caller, { ...body, confirmed: action === "correct_current_class_materials" && body.confirmed === true })) });
        if (action === "save_package") return json(200, { success: true, ...(await savePackage(admin, caller, body)) });
        if (action === "publish_package") return json(200, { success: true, ...(await setPackageStatus(admin, caller, body, "published")) });
        if (action === "discontinue_package") return json(200, { success: true, ...(await setPackageStatus(admin, caller, body, "discontinued")) });
        if (action === "grant_book") {
            if (caller.role !== "admin") return json(403, { error: "只有管理員可以贈送教材" });
            const studentId = int(body.student_id), bookId = int(body.book_id); if (!studentId || !bookId) return json(400, { error: "學生或教材編號不正確" });
            const { data, error } = await admin.from("student_book_entitlements").upsert({ student_id: studentId, book_id: bookId, source: "admin_grant", source_reference_type: "admin", source_reference_id: caller.id, status: "active", is_permanent: true, created_by: caller.id }, { onConflict: "student_id,book_id,source,source_reference_type,source_reference_id" }).select("*").single();
            if (error) throw error;
            await admin.from("commerce_audit_log").insert({ actor_id: caller.id, action: "book_granted", entity_type: "student_book_entitlement", entity_id: data.id, after_snapshot: data });
            return json(200, { success: true, entitlement: data });
        }
        if (action === "student_detail") return json(200, { success: true, detail: await lifecycleDetail(admin, caller, int(body.student_id) || 0) });
        if (new Set(["departure_preview","schedule_departure","cancel_departure","restore_student","process_departure"]).has(action)) return json(200, { success: true, ...(await changeDeparture(admin, caller, body, action)) });
        return json(400, { error: "不支援的教材商務操作" });
    } catch (error) {
        const status = errorStatus(error);
        const message = errorMessage(error);
        if (status >= 500) console.error("commerce-manager unexpected error", message);
        return json(status, { error: message, code: (error as any)?.code || null });
    }
});
