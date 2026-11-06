// Behaviour tests for membership-manager redeem_code / admin_generate_codes
// (normalizeActivationCode, createActivationCode). Real handler, stubbed Deno.serve, in-memory admin.
// The caller is found by firebase_uid only, so these tests do not depend on the findCaller email
// fallback or complete_signup that other agents are changing.
// Run: node --experimental-strip-types --test scripts/activation-code-handler.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { callJson, createFakeAdmin, loadHandler, resolveRelativeImports } from "./edge-handler-harness.mjs";

const shared = await resolveRelativeImports("membership-manager");
const sha256 = value => createHash("sha256").update(value).digest("hex");
const CODE = "AE-ABCD-EFGH-JKMN";
const NORMALIZED = "AEABCDEFGHJKMN";

const baseTables = () => ({
    students: [
        { id: 7, firebase_uid: "uid-student", email: "student@school.test", name: "Student", role: "student", account_status: "active", learner_type: "textbook_customer" },
        { id: 8, firebase_uid: "uid-other", email: "other@school.test", name: "Other", role: "student", account_status: "active" },
        { id: 9, firebase_uid: "uid-archived", email: "arch@school.test", name: "Archived", role: "student", account_status: "archived" },
        { id: 20, firebase_uid: "uid-teacher", email: "t@school.test", name: "Teacher", role: "teacher", account_status: "active" },
        { id: 30, firebase_uid: "uid-admin", email: "a@school.test", name: "Admin", role: "admin", account_status: "active" }
    ],
    memberships: [{ id: 1, student_id: 7, status: "active" }, { id: 2, student_id: 8, status: "active" }],
    activation_codes: [
        { id: 61, code_hash: sha256(NORMALIZED), book_id: 3, plan_id: 91, duration_days: 180, max_redemptions: 1, redemption_count: 0, status: "active", expires_at: null }
    ],
    activation_code_redemptions: [],
    student_book_entitlements: [],
    books: [{ id: 3, enabled: true, archived_at: null }]
});

// Models the committed-on-return semantics of public.redeem_activation_code
// (20260821161809): each RPC is its own transaction; on success the redemption row and
// redemption_count are already durable before the Edge Function continues.
const redeemRpc = ({ p_student_id, p_code_hash }, tables) => {
    const code = tables.activation_codes.find(row => row.code_hash === String(p_code_hash).trim().toLowerCase());
    const fail = message => ({ data: null, error: { message } });
    if (!code) return fail("code_not_found");
    if (code.status !== "active") return fail("code_not_active");
    if (code.expires_at && new Date(code.expires_at) <= new Date()) return fail("code_expired");
    if (code.redemption_count >= code.max_redemptions) return fail("code_exhausted");
    if (tables.activation_code_redemptions.some(row => row.activation_code_id === code.id && row.student_id === p_student_id)) {
        return fail("code_already_redeemed");
    }
    const redemption = { id: 900 + tables.activation_code_redemptions.length, activation_code_id: code.id, student_id: p_student_id, book_entitlement_id: null };
    tables.activation_code_redemptions.push(redemption);
    code.redemption_count += 1;
    return { data: { redemption_id: redemption.id, access_ends_at: "2027-05-01T00:00:00.000Z" }, error: null };
};

const harness = ({ uid = "uid-student", rpcError = null, failures = {}, mutate } = {}) => {
    const tables = baseTables();
    mutate?.(tables);
    const admin = createFakeAdmin({
        tables,
        failures,
        rpc: {
            redeem_activation_code: (args, current) => rpcError ? { data: null, error: { message: rpcError } } : redeemRpc(args, current),
            get_student_effective_access: ({ p_student_id }) => ({ data: { student_id: p_student_id, role: "student", is_active: true, plan_codes: [], grants: [], features: {} }, error: null }),
            claim_paid_store_orders_for_student: () => ({ data: { claimed_orders: 0 }, error: null })
        }
    });
    const call = loadHandler("membership-manager", {
        ...shared,
        createClient: () => admin,
        jwtVerify: async () => ({ payload: { sub: uid, email: tables.students.find(row => row.firebase_uid === uid)?.email, email_verified: true } })
    });
    return { admin, tables, call: body => callJson(call(body)) };
};

const redeem = (run, code = CODE, extra = {}) => run.call({ action: "redeem_code", code, ...extra });

test("codes that differ only by case, dashes or spaces hash to the same value", async () => {
    const hashes = [];
    for (const variant of [CODE, CODE.toLowerCase(), NORMALIZED, NORMALIZED.toLowerCase(), " ae abcd efgh jkmn ", "ae_abcd.efgh/jkmn"]) {
        const run = harness();
        const { status } = await redeem(run, variant);
        assert.equal(status, 200, variant);
        hashes.push(run.admin.rpcCalls("redeem_activation_code")[0].args.p_code_hash);
    }
    assert.equal(new Set(hashes).size, 1);
    assert.equal(hashes[0], sha256(NORMALIZED));
});

test("a code generated by admin_generate_codes is redeemable in lowercase without dashes", async () => {
    const adminRun = harness({ uid: "uid-admin", mutate: tables => { tables.activation_codes = []; } });
    const generated = await adminRun.call({ action: "admin_generate_codes", quantity: 2, duration_days: 180 });
    assert.equal(generated.status, 201);
    assert.equal(generated.body.codes.length, 2);
    for (const item of generated.body.codes) {
        assert.match(item.code, /^AE-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
        assert.ok(!item.code_hint.includes(item.code.slice(7, 11)), "hint hides the middle of the code");
    }
    const stored = adminRun.tables.activation_codes;
    assert.equal(stored.length, 2);
    assert.ok(stored.every(row => !JSON.stringify(row).includes(generated.body.codes[0].code)), "plaintext code is never stored");

    const plain = generated.body.codes[0].code;
    const studentRun = harness({ mutate: tables => { tables.activation_codes = stored.map(row => ({ ...row, redemption_count: 0 })); } });
    const { status } = await redeem(studentRun, plain.toLowerCase().replaceAll("-", ""));
    assert.equal(status, 200);
    assert.equal(studentRun.tables.activation_codes.find(row => row.code_hash === sha256(plain.replaceAll("-", ""))).redemption_count, 1);
});

test("codes shorter than 10 significant characters are rejected before any lookup", async () => {
    for (const short of ["", "AE-1234", "------------", "ae 12 34 5"]) {
        const run = harness();
        const { status } = await redeem(run, short);
        assert.equal(status, 400, short);
        assert.equal(run.admin.log.filter(entry => entry.rpc || entry.table === "activation_codes").length, 0);
    }
});

test("each redeem_activation_code error maps to its HTTP status", async () => {
    for (const [message, status] of [
        ["code_not_found", 404], ["code_expired", 410], ["code_exhausted", 409], ["code_not_active", 409],
        ["code_already_redeemed", 409], ["membership_already_unlimited", 409], ["membership_not_found", 500]
    ]) {
        const run = harness({ rpcError: message });
        const response = await redeem(run);
        assert.equal(response.status, status, message);
        assert.equal(run.admin.writes("student_book_entitlements").length, 0, message);
    }
});

test("errors from the modelled SQL flow: unknown, expired, exhausted, repeat", async () => {
    assert.equal((await redeem(harness(), "AE-ZZZZ-ZZZZ-ZZZZ")).status, 404);
    assert.equal((await redeem(harness({ mutate: tables => { tables.activation_codes[0].expires_at = "2020-01-01T00:00:00Z"; } }))).status, 410);
    assert.equal((await redeem(harness({ mutate: tables => { tables.activation_codes[0].redemption_count = 1; } }))).status, 409);
    const run = harness({ mutate: tables => { tables.activation_codes[0].max_redemptions = 5; } });
    assert.equal((await redeem(run)).status, 200);
    const again = await redeem(run);
    assert.equal(again.status, 409);
    assert.equal(again.body.error, "你已經使用過這組啟用碼");
});

test("teacher and admin get 400 and never call the RPC", async () => {
    for (const uid of ["uid-teacher", "uid-admin"]) {
        const run = harness({ uid });
        const { status } = await redeem(run);
        assert.equal(status, 400, uid);
        assert.equal(run.admin.rpcCalls("redeem_activation_code").length, 0);
        assert.equal(run.admin.reads("activation_codes").length, 0);
    }
});

test("archived student is refused with ACCOUNT_ARCHIVED before the code is touched", async () => {
    const run = harness({ uid: "uid-archived" });
    const { status, body } = await redeem(run);
    assert.equal(status, 403);
    assert.equal(body.code, "ACCOUNT_ARCHIVED");
    assert.equal(run.admin.rpcCalls("redeem_activation_code").length, 0);
});

test("the redeeming student comes from the verified token, not the request body", async () => {
    const run = harness();
    await redeem(run, CODE, { student_id: 8, p_student_id: 8, role: "admin" });
    assert.equal(run.admin.rpcCalls("redeem_activation_code")[0].args.p_student_id, 7);
    assert.ok(run.tables.student_book_entitlements.every(row => row.student_id === 7));
});

test("a book code creates one active entitlement and links it to the redemption", async () => {
    const run = harness();
    const { status, body } = await redeem(run);
    assert.equal(status, 200);
    assert.equal(body.success, true);
    const [entitlement] = run.tables.student_book_entitlements;
    assert.equal(run.tables.student_book_entitlements.length, 1);
    assert.equal(entitlement.student_id, 7);
    assert.equal(entitlement.book_id, 3);
    assert.equal(entitlement.status, "active");
    assert.equal(entitlement.source, "activation_code");
    assert.equal(entitlement.source_reference_id, 61);
    assert.equal(run.tables.activation_code_redemptions[0].book_entitlement_id, entitlement.id);
});

test("a code without a book writes no entitlement", async () => {
    const run = harness({ mutate: tables => { tables.activation_codes[0].book_id = null; } });
    assert.equal((await redeem(run)).status, 200);
    assert.equal(run.tables.student_book_entitlements.length, 0);
});

// Suspected bug refuted as a design decision: a 180-day workbook_platform_access code still
// writes is_permanent: true (L1291-1296). The plan text in 20261013060041 and AGENTS §6 say book
// ownership is kept permanently while the 180/365-day platform window lives in the access grant
// written by redeem_activation_code. This pins that contract so a change is deliberate.
test("a limited-duration book code grants permanent book ownership (platform time limit lives in the grant)", async () => {
    const run = harness();
    await redeem(run);
    assert.equal(run.tables.activation_codes[0].duration_days, 180);
    assert.equal(run.tables.student_book_entitlements[0].is_permanent, true);
    assert.equal(run.tables.student_book_entitlements[0].ends_at, undefined);
});

// KNOWN BUG: redeem_activation_code commits the redemption (redemption_count + redemption row,
// L1275-1278) before the entitlement upsert (L1291-1299) runs in a separate request. When the
// upsert or the link update fails, the student gets 500, the code is already consumed, and a retry
// returns 409 code_already_redeemed: the book is never granted. Confirmed: the retry below is 409
// and the student has no entitlement.
test("a failed entitlement write does not strand the student", { todo: "KNOWN BUG: code consumed before entitlement write" }, async () => {
    const run = harness({ failures: { "student_book_entitlements:upsert": { message: "temporary write failure" } } });
    const first = await redeem(run);
    assert.equal(first.status, 500);
    const retryRun = harness({ mutate: tables => {
        tables.activation_codes = run.tables.activation_codes;
        tables.activation_code_redemptions = run.tables.activation_code_redemptions;
    } });
    const retry = await redeem(retryRun);
    assert.equal(retry.status, 200, "student can recover by retrying");
    assert.equal(retryRun.tables.student_book_entitlements.length, 1);
});

test("a failed entitlement write reports failure, not success", async () => {
    const run = harness({ failures: { "student_book_entitlements:upsert": { message: "temporary write failure" } } });
    const { status, text } = await redeem(run);
    assert.equal(status, 500);
    assert.ok(!/"success":true/.test(text));
});
