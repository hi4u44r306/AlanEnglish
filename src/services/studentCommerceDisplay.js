import { loadStudentCommerceProfile } from "./commerceService";

export const STUDENT_COMMERCE_DISPLAY_KEY = "settings:commerce:v2";
const one = value => Array.isArray(value) ? value[0] : value;
const enrollmentDisplay = record => {
    const classroom = one(record.academy_classes);
    return {
        status: record.status,
        academy_classes: classroom && { code: classroom.code },
        enrolled_at: record.enrolled_at,
        scheduled_departure_at: record.scheduled_departure_at,
        departed_at: record.departed_at
    };
};

// Shared display data only. The page cache removes guardian before persistence.
export const loadStudentCommerceDisplay = async firebaseUser => {
    const result = await loadStudentCommerceProfile(firebaseUser);
    const profile = result?.profile;
    if (!profile) throw new Error("設定資料讀取失敗");
    return {
        enrollment_status: profile.enrollment_status,
        current_enrollment: profile.current_enrollment && enrollmentDisplay(profile.current_enrollment),
        enrollment_history: profile.enrollment_history?.map(enrollmentDisplay) || [],
        class_books: profile.class_books?.filter(Boolean).map(({ id, code, name }) => ({ id, code, name })) || [],
        direct_entitlements: profile.direct_entitlements?.map(item => ({ source: item.source, books: { name: item.books?.name } })) || [],
        plans: profile.plans?.map(plan => ({
            id: plan.id, status: plan.status, current_period_end: plan.current_period_end,
            ends_at: plan.ends_at, cancel_at_period_end: plan.cancel_at_period_end,
            stripe_subscription_status: plan.stripe_subscription_status,
            subscription_plans: Array.isArray(plan.subscription_plans)
                ? plan.subscription_plans.map(({ code, name }) => ({ code, name }))
                : plan.subscription_plans && { code: plan.subscription_plans.code, name: plan.subscription_plans.name }
        })) || [],
        guardian: profile.guardian && { email: profile.guardian.email, email_verified_at: profile.guardian.email_verified_at }
    };
};
