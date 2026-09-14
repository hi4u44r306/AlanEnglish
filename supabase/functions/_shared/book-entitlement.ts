const STAFF_ROLES = new Set(["teacher", "admin"]);

export const relationOne = (value: any) => Array.isArray(value) ? value[0] || null : value || null;

export const baseBookEntitlementDecision = (user: any, effectiveAccess: any, book: any) => {
    if (STAFF_ROLES.has(String(user?.role || ""))) return true;
    if (!book?.id || book?.enabled === false || book?.archived_at) return false;
    if (book.content_scope === "showcase") return false;
    if (book.content_scope === "trial") {
        return effectiveAccess?.learner_type === "trial_user"
            && effectiveAccess?.plan_codes?.includes("trial_7_day");
    }
    if (book.content_scope !== "formal") return false;
    if (effectiveAccess?.features?.requires_book_entitlement !== true) return true;
    return null;
};

export const isBookEntitled = async (admin: any, user: any, effectiveAccess: any, rawBook: any) => {
    const book = relationOne(rawBook);
    const baseDecision = baseBookEntitlementDecision(user, effectiveAccess, book);
    if (baseDecision !== null) return baseDecision;

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const direct = await admin.from("student_book_entitlements").select("id")
        .eq("student_id", Number(user.id)).eq("book_id", Number(book.id))
        .eq("status", "active").lte("starts_at", now).is("revoked_at", null)
        .or(`is_permanent.eq.true,ends_at.is.null,ends_at.gt.${now}`).limit(1);
    if (direct.error) throw direct.error;
    if (direct.data?.length) return true;

    const enrollment = await admin.from("academy_enrollments").select("id,class_id,academy_classes(code)")
        .eq("student_id", Number(user.id)).eq("status", "active").lte("enrolled_at", today)
        .or(`access_ends_at.is.null,access_ends_at.gte.${today}`)
        .or(`scheduled_departure_at.is.null,scheduled_departure_at.gt.${today}`).limit(1).maybeSingle();
    if (enrollment.error) throw enrollment.error;
    if (!enrollment.data) return false;

    const setting = await admin.from("academy_class_material_settings").select("id")
        .eq("class_id", enrollment.data.class_id).eq("is_active", true).lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`).order("version", { ascending: false }).limit(1).maybeSingle();
    if (setting.error) throw setting.error;
    if (setting.data) {
        const allowed = await admin.from("academy_class_material_books").select("id")
            .eq("setting_id", setting.data.id).eq("book_id", Number(book.id)).limit(1).maybeSingle();
        if (allowed.error) throw allowed.error;
        if (allowed.data) return true;
    }

    const enrolledClass = relationOne(enrollment.data.academy_classes)?.code;
    if (!enrolledClass) return false;
    const assignments = await admin.from("assignments").select("id,due_at")
        .eq("target_class", enrolledClass).eq("enabled", true);
    if (assignments.error) throw assignments.error;
    const activeAssignmentIds = (assignments.data || [])
        .filter((assignment: any) => !assignment.due_at || assignment.due_at > now)
        .map((assignment: any) => assignment.id);
    if (!activeAssignmentIds.length) return false;
    const items = await admin.from("assignment_track_items").select("book_id_snapshot,track_id_snapshot,track_id")
        .in("assignment_id", activeAssignmentIds);
    if (items.error) throw items.error;
    if ((items.data || []).some((item: any) => Number(item.book_id_snapshot) === Number(book.id))) return true;
    const trackIds = [...new Set((items.data || [])
        .map((item: any) => Number(item.track_id_snapshot || item.track_id)).filter(Boolean))];
    if (!trackIds.length) return false;
    const legacyTrack = await admin.from("music_tracks").select("id")
        .in("id", trackIds).eq("book_id", Number(book.id)).limit(1);
    if (legacyTrack.error) throw legacyTrack.error;
    return Boolean(legacyTrack.data?.length);
};

export const assertBookEntitled = async (admin: any, user: any, effectiveAccess: any, book: any) => {
    if (await isBookEntitled(admin, user, effectiveAccess, book)) return;
    throw Object.assign(new Error("尚未取得這本教材，無法開啟或評分此口說關卡"), {
        status: 403,
        code: "book_entitlement_required"
    });
};
