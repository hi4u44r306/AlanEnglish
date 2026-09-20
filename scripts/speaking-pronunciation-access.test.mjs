import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeSpeakingPronunciation } from "../supabase/functions/_shared/speaking-pronunciation-access.ts";

const activeAccess = {
    is_active: true,
    features: { pronunciation: true }
};

test("只有管理員能在不讀取學生資格的情況下進行評分示範", async () => {
    let loadCalls = 0;
    const loadAccess = async () => {
        loadCalls += 1;
        return activeAccess;
    };

    assert.deepEqual(
        await authorizeSpeakingPronunciation({ id: 1, role: "admin" }, loadAccess),
        { adminDemo: true, effectiveAccess: null }
    );
    assert.equal(loadCalls, 0);

    await assert.rejects(
        authorizeSpeakingPronunciation({ id: 2, role: "teacher" }, loadAccess),
        error => error?.status === 403
    );
    assert.equal(loadCalls, 0);
});

test("學生送評仍須通過有效的 AI 發音資格", async () => {
    const loadAccess = async studentId => {
        assert.equal(studentId, 7);
        return activeAccess;
    };
    assert.deepEqual(
        await authorizeSpeakingPronunciation({ id: 7, role: "student" }, loadAccess),
        { adminDemo: false, effectiveAccess: activeAccess }
    );

    await assert.rejects(
        authorizeSpeakingPronunciation(
            { id: 7, role: "student" },
            async () => ({ is_active: true, features: { pronunciation: false } })
        ),
        error => error?.status === 403 && error?.code === "pronunciation_access_required"
    );
});
