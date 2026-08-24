import { deleteAssignment } from "./assignmentService";

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
});
