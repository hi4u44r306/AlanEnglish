const { test, expect } = require("@playwright/test");
const { login } = require("./support/auth");
const { readJson, waitForEdgeResponse } = require("./support/edge-response");

const CLASS_CODES = new Set(["E1", "E3", "E5", "E7"]);
const sharedPassword = process.env.E2E_PLAN_PASSWORD;
const requireAcademyAssignment = process.env.E2E_REQUIRE_ACADEMY_ASSIGNMENT === "true";

const accountCases = [
    {
        label: "一般會員",
        identifierEnv: "E2E_BASIC_IDENTIFIER",
        assignments: false,
        enrollmentStatus: "not_enrolled",
        requiresEntitledBook: false
    },
    {
        label: "英文班在校生",
        identifierEnv: "E2E_ACADEMY_IDENTIFIER",
        assignments: true,
        enrollmentStatus: "active",
        requiresEntitledBook: true
    },
    {
        label: "英文班離校生",
        identifierEnv: "E2E_ALUMNI_IDENTIFIER",
        assignments: false,
        enrollmentStatus: "departed",
        requiresEntitledBook: false
    }
];

const flattenBooks = catalog => (catalog?.categories || [])
    .flatMap(category => category.books || []);

const verifyBookBoundary = async (page, accountCase, catalog) => {
    const books = flattenBooks(catalog);
    expect(books.length, "教材目錄至少需要一本啟用教材").toBeGreaterThan(0);

    const unlockedBooks = books.filter(book => !book.locked);
    const entitledBooks = books.filter(book => book.entitled === true);
    expect(
        unlockedBooks.every(book => book.entitled === true),
        "所有可開啟教材都必須有後端 entitlement"
    ).toBe(true);

    if (accountCase.requiresEntitledBook) {
        expect(entitledBooks.length, "在校生測試資料至少要有一本班級教材 entitlement").toBeGreaterThan(0);
    }

    if (entitledBooks.length > 0) {
        const entitledBook = unlockedBooks[0] || entitledBooks[0];
        const responsePromise = waitForEdgeResponse(page, "content-access", "book");
        await page.goto(`/student/books/${encodeURIComponent(entitledBook.code)}`);
        const response = await responsePromise;
        const payload = await readJson(response);
        if (entitledBook.lock_reason === "level_locked") {
            expect(response.status(), "有教材 entitlement 但等級未解鎖時仍須拒絕").toBe(403);
            expect(payload.code).toBe("level_locked");
            test.info().annotations.push({
                type: "level-gate",
                description: `${accountCase.label}有教材 entitlement，但目前測試帳號尚未通過教材所需等級。`
            });
        } else {
            expect(response.status(), "有權限且等級已解鎖的教材應可由後端開啟").toBe(200);
            expect(payload?.book?.code).toBe(entitledBook.code);
        }
    } else {
        test.info().annotations.push({
            type: "fixture",
            description: `${accountCase.label}目前沒有教材 entitlement；已驗證目錄沒有錯誤解鎖。`
        });
    }

    const forbiddenBook = books.find(book => (
        book.entitled === false
        && book.lock_reason === "book_entitlement_required"
    ));
    expect(forbiddenBook, "測試資料至少要保留一本未取得權限的教材").toBeTruthy();

    const responsePromise = waitForEdgeResponse(page, "content-access", "book");
    await page.goto(`/student/books/${encodeURIComponent(forbiddenBook.code)}`);
    const response = await responsePromise;
    const payload = await readJson(response);
    expect(response.status(), "直接輸入未授權教材網址也必須由後端拒絕").toBe(403);
    expect(payload.code).toBe("book_entitlement_required");
    await expect(page.getByText(/尚未取得這本教材/)).toBeVisible();
};

for (const accountCase of accountCases) {
    test.describe(`${accountCase.label}作業與教材權限`, () => {
        const identifier = process.env[accountCase.identifierEnv];

        test.skip(
            !identifier || !sharedPassword,
            `未提供 ${accountCase.identifierEnv}／E2E_PLAN_PASSWORD`
        );

        test("只取得符合身分的作業、歷史與教材", async ({ page }) => {
            await login(page, identifier, sharedPassword);

            await expect(page.getByRole("link", { name: "今日作業", exact: true }))[
                accountCase.assignments ? "toBeAttached" : "toHaveCount"
            ](accountCase.assignments ? undefined : 0);

            const assignmentResponsePromise = waitForEdgeResponse(
                page,
                "assignment-manager",
                "student_assignments"
            );
            await page.goto("/student/assignments");
            const assignmentResponse = await assignmentResponsePromise;
            const assignmentPayload = await readJson(assignmentResponse);

            if (accountCase.assignments) {
                expect(assignmentResponse.status(), "在校生應可讀取班級作業").toBe(200);
                expect(CLASS_CODES.has(assignmentPayload.student_class)).toBe(true);
                if (requireAcademyAssignment) {
                    expect(
                        assignmentPayload.assignments?.length,
                        "在校生測試 fixture 至少要有一份目前班級作業"
                    ).toBeGreaterThan(0);
                }
                expect(
                    (assignmentPayload.assignments || []).every(
                        assignment => assignment.target_class === assignmentPayload.student_class
                    ),
                    "回傳作業只能屬於在校生目前班級"
                ).toBe(true);
                await expect(page.getByRole("heading", { name: "今天的課後任務" })).toBeVisible();
            } else {
                expect([402, 403], "一般會員與離校生不得取得新作業").toContain(
                    assignmentResponse.status()
                );
                expect(["membership_required", "assignments_not_available"]).toContain(
                    assignmentPayload.code
                );
                expect(assignmentPayload.assignments).toBeUndefined();
            }

            const profileResponsePromise = waitForEdgeResponse(
                page,
                "commerce-manager",
                "student_profile"
            );
            const catalogResponsePromise = waitForEdgeResponse(
                page,
                "content-access",
                "catalog"
            );
            await page.goto("/student/settings");
            const [profileResponse, catalogResponse] = await Promise.all([
                profileResponsePromise,
                catalogResponsePromise
            ]);
            const profilePayload = await readJson(profileResponse);
            const catalog = await readJson(catalogResponse);

            expect(profileResponse.status()).toBe(200);
            expect(profilePayload?.profile?.enrollment_status).toBe(accountCase.enrollmentStatus);
            if (accountCase.enrollmentStatus === "active") {
                expect(
                    profilePayload?.profile?.class_books?.length,
                    "在校生設定頁至少要回傳一本班級教材"
                ).toBeGreaterThan(0);
            }
            if (accountCase.enrollmentStatus === "departed") {
                expect(
                    profilePayload?.profile?.enrollment_history?.length,
                    "離校生仍需保留就讀歷史"
                ).toBeGreaterThan(0);
                await expect(page.getByText("離校", { exact: true })).toBeVisible();
            }

            expect(catalogResponse.status()).toBe(200);
            await verifyBookBoundary(page, accountCase, catalog);
        });
    });
}
