import {
    activateStudentLogin,
    createAcademyStudentsBatch,
    deleteAcademyInvitation,
    deleteAcademyStudentAccount,
    previewAcademyStudents
} from "./academyStudentService";

jest.mock("../components/Pages/supabase-config", () => ({
    supabaseUrl: "https://project.supabase.co",
    supabaseKey: "public-anon-key"
}));

global.fetch = jest.fn();

const firebaseUser = {
    getIdToken: jest.fn().mockResolvedValue("firebase-id-token")
};

const student = {
    chineseName: "王小明",
    englishName: "Alan",
    loginUsername: "AlanWang01",
    classCode: "e3",
    enrolledAt: "2026-08-24",
    accessEndsAt: "",
    notes: "櫃檯批次建立"
};

describe("academyStudentService CSV contracts", () => {
    beforeEach(() => {
        fetch.mockReset();
        firebaseUser.getIdToken.mockReset().mockResolvedValue("firebase-id-token");
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true, rows: [], results: [] })
        });
    });

    test("預覽 action 正規化登入帳號與班級", async () => {
        await previewAcademyStudents(firebaseUser, [student]);

        const request = fetch.mock.calls[0][1];
        expect(request.headers.Authorization).toBe("Bearer firebase-id-token");
        expect(JSON.parse(request.body)).toEqual({
            action: "preview_students",
            rows: [{
                login_username: "alanwang01",
                chinese_name: "王小明",
                english_name: "Alan",
                class_code: "E3",
                guardian_name: null,
                guardian_email: null,
                guardian_phone: null,
                enrolled_at: "2026-08-24",
                access_ends_at: null,
                notes: "櫃檯批次建立"
            }]
        });
    });

    test("批次建立 action 帶 request ID 且不傳入前端角色", async () => {
        await createAcademyStudentsBatch(
            firebaseUser,
            [student],
            "0f9b7f16-a25d-4cf5-bcb6-6d85a5f0d712"
        );

        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body.action).toBe("batch_create_students");
        expect(body.request_id).toBe("0f9b7f16-a25d-4cf5-bcb6-6d85a5f0d712");
        expect(body.rows).toHaveLength(1);
        expect(body.rows[0].login_username).toBe("alanwang01");
        expect(body).not.toHaveProperty("role");
        expect(body.rows[0]).not.toHaveProperty("role");
    });

    test("永久刪除學生帳號需傳入學生 ID 與完整帳號識別碼確認", async () => {
        await deleteAcademyStudentAccount(
            firebaseUser,
            67,
            "student@gmail.com"
        );

        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
            action: "delete_student_account",
            student_id: 67,
            confirmation_identifier: "student@gmail.com"
        });
    });

    test("刪除未領取邀請需傳入邀請 ID 與完整 Email 確認", async () => {
        await deleteAcademyInvitation(
            firebaseUser,
            91,
            "pending@gmail.com"
        );

        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
            action: "delete_invitation",
            invitation_id: 91,
            confirmation_email: "pending@gmail.com"
        });
    });

    test("首次啟用會同時提交中英文姓名", async () => {
        await activateStudentLogin("one-time-token", "green7", {
            chineseName: "王小明",
            englishName: "Alan Wang"
        });

        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
            action: "activate_student_login",
            token: "one-time-token",
            password: "green7",
            chinese_name: "王小明",
            english_name: "Alan Wang"
        });
    });
});
