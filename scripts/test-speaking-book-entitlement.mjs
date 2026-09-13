import assert from "node:assert/strict";
import {
    assertBookEntitled,
    baseBookEntitlementDecision,
    isBookEntitled,
    relationOne
} from "../supabase/functions/_shared/book-entitlement.ts";

const student = { id: 7, role: "student" };
const formalBook = { id: 11, enabled: true, archived_at: null, content_scope: "formal" };
const restrictedAccess = {
    learner_type: "textbook_customer",
    plan_codes: ["basic_299"],
    features: { requires_book_entitlement: true }
};

assert.equal(baseBookEntitlementDecision({ id: 1, role: "admin" }, {}, null), true);
assert.equal(baseBookEntitlementDecision({ id: 2, role: "teacher" }, {}, null), true);
assert.equal(baseBookEntitlementDecision(student, restrictedAccess, null), false);
assert.equal(baseBookEntitlementDecision(student, restrictedAccess, { ...formalBook, enabled: false }), false);
assert.equal(baseBookEntitlementDecision(student, restrictedAccess, { ...formalBook, archived_at: "2026-09-13T00:00:00Z" }), false);
assert.equal(baseBookEntitlementDecision(student, restrictedAccess, { ...formalBook, content_scope: "showcase" }), false);
assert.equal(baseBookEntitlementDecision(student, restrictedAccess, { ...formalBook, content_scope: "unknown" }), false);
assert.equal(baseBookEntitlementDecision(student, restrictedAccess, formalBook), null);
assert.equal(baseBookEntitlementDecision(student, {
    learner_type: "academy_student",
    plan_codes: ["academy_internal"],
    features: { requires_book_entitlement: false }
}, formalBook), true);
assert.equal(baseBookEntitlementDecision(student, {
    learner_type: "trial_user",
    plan_codes: ["trial_7_day"],
    features: { requires_book_entitlement: true }
}, { ...formalBook, content_scope: "trial" }), true);
assert.equal(baseBookEntitlementDecision(student, {
    learner_type: "textbook_customer",
    plan_codes: ["trial_7_day"],
    features: { requires_book_entitlement: true }
}, { ...formalBook, content_scope: "trial" }), false);
assert.equal(relationOne([{ id: 1 }, { id: 2 }]).id, 1);
assert.equal(relationOne(null), null);

const fakeAdmin = responses => ({
    from(table) {
        const response = Array.isArray(responses[table]) ? responses[table].shift() : responses[table];
        const builder = {
            select: () => builder,
            eq: () => builder,
            lte: () => builder,
            gte: () => builder,
            is: () => builder,
            or: () => builder,
            in: () => builder,
            order: () => builder,
            limit: () => builder,
            maybeSingle: () => Promise.resolve(response || { data: null, error: null }),
            then: (resolve, reject) => Promise.resolve(response || { data: [], error: null }).then(resolve, reject)
        };
        return builder;
    }
});

assert.equal(await isBookEntitled(fakeAdmin({
    student_book_entitlements: { data: [{ id: 1 }], error: null }
}), student, restrictedAccess, formalBook), true);

assert.equal(await isBookEntitled(fakeAdmin({
    student_book_entitlements: { data: [], error: null },
    academy_enrollments: { data: null, error: null }
}), student, restrictedAccess, formalBook), false);

await assert.rejects(
    assertBookEntitled(fakeAdmin({
        student_book_entitlements: { data: [], error: null },
        academy_enrollments: { data: null, error: null }
    }), student, restrictedAccess, formalBook),
    error => error?.status === 403 && error?.code === "book_entitlement_required"
);

await assert.rejects(
    isBookEntitled(fakeAdmin({
        student_book_entitlements: { data: null, error: new Error("query failed") }
    }), student, restrictedAccess, formalBook),
    /query failed/
);

assert.equal(await isBookEntitled(fakeAdmin({
    student_book_entitlements: { data: [], error: null },
    academy_enrollments: { data: { id: 2, class_id: 3, academy_classes: { code: "E1" } }, error: null },
    academy_class_material_settings: { data: { id: 4 }, error: null },
    academy_class_material_books: { data: { id: 5 }, error: null }
}), student, restrictedAccess, formalBook), true);

assert.equal(await isBookEntitled(fakeAdmin({
    student_book_entitlements: { data: [], error: null },
    academy_enrollments: { data: { id: 2, class_id: 3, academy_classes: { code: "E1" } }, error: null },
    academy_class_material_settings: { data: null, error: null },
    assignments: { data: [], error: null }
}), student, restrictedAccess, formalBook), false);

console.log("Speaking per-book entitlement contract passed");
