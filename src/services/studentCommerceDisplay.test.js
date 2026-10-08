import { loadStudentCommerceDisplay } from "./studentCommerceDisplay";
import { loadStudentCommerceProfile } from "./commerceService";
import { sanitizeStudentSnapshot } from "./studentPageCache";

jest.mock("./commerceService", () => ({ loadStudentCommerceProfile: jest.fn() }));
test("shares current class identifiers but excludes payment and student details from display snapshots", async () => {
    loadStudentCommerceProfile.mockResolvedValue({ profile: {
        student: { name: "Private student" }, purchases: [{ amount_twd: 100 }],
        enrollment_status: "active", current_enrollment: { status: "active", academy_classes: [{ code: "E3" }] },
        class_books: [{ id: 3, name: "Workbook 3", code: "Workbook_3", content_scope: "formal" }],
        guardian: { email: "parent@example.com", email_verified_at: "2026-10-01" },
        plans: [{ id: 2, stripe_customer_id: "private", subscription_plans: { code: "basic", name: "Basic" } }]
    } });
    const display = await loadStudentCommerceDisplay({ uid: "a" });
    expect(display.class_books).toEqual([{ id: 3, name: "Workbook 3", code: "Workbook_3" }]);
    expect(display.current_enrollment.academy_classes.code).toBe("E3");
    expect(display.guardian.email).toBe("parent@example.com");
    const disk = JSON.stringify(sanitizeStudentSnapshot(display));
    expect(disk).not.toMatch(/parent@example|Private student|amount_twd|stripe_customer_id/);
});

test("rejects missing profiles and keeps the HTTP status of denied requests", async () => {
    loadStudentCommerceProfile.mockResolvedValue({});
    await expect(loadStudentCommerceDisplay({ uid: "a" })).rejects.toThrow("設定資料讀取失敗");
    loadStudentCommerceProfile.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    await expect(loadStudentCommerceDisplay({ uid: "a" })).rejects.toHaveProperty("status", 403);
});
