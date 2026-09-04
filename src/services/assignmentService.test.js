import { createAssignmentV2, deleteAssignment, getStudentAssignmentsV2, previewAssignmentV2, submitAssignmentV2Ai, upsertPageLearningContent } from "./assignmentService";

jest.mock("../components/Pages/supabase-config", () => ({
    supabaseUrl: "https://project.supabase.co",
    supabaseKey: "public-anon-key"
}));

global.fetch = jest.fn();

describe("assignmentService contracts", () => {
    const firebaseUser = {
        getIdToken: jest.fn().mockResolvedValue("firebase-id-token")
    };

    beforeEach(() => {
        fetch.mockReset();
        firebaseUser.getIdToken.mockReset().mockResolvedValue("firebase-id-token");
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, assignment_id: 42 })
        });
    });

    test("刪除作業使用後端 delete_assignment action", async () => {
        await deleteAssignment(firebaseUser, 42);

        const request = fetch.mock.calls[0][1];
        expect(request.headers.Authorization).toBe("Bearer firebase-id-token");
        expect(JSON.parse(request.body)).toEqual({
            action: "delete_assignment",
            assignment_id: 42
        });
    });

    test("混合作業預覽、發布與頁面來源都使用指定的安全 action", async () => {
        await previewAssignmentV2(firebaseUser, { title: "預覽" });
        await createAssignmentV2(firebaseUser, { title: "發布" });
        await upsertPageLearningContent(firebaseUser, { page_label: "P22" });

        expect(JSON.parse(fetch.mock.calls[0][1].body).action).toBe("preview_assignment_v2");
        expect(JSON.parse(fetch.mock.calls[1][1].body).action).toBe("create_assignment_v2");
        expect(JSON.parse(fetch.mock.calls[2][1].body).action).toBe("upsert_page_learning_content");
    });

    test("學生新版作業讀取與 AI 交卷不讓前端指定學生身分或分數", async () => {
        await getStudentAssignmentsV2(firebaseUser);
        await submitAssignmentV2Ai(firebaseUser, 42, 9, ["A", "B"]);

        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: "student_assignments_v2" });
        expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
            action: "submit_assignment_v2_ai", assignment_id: 42, assignment_item_id: 9, answers: ["A", "B"]
        });
    });
});
