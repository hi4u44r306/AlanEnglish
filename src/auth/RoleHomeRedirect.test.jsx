jest.mock("./AuthContext", () => ({ useAuth: jest.fn() }));

import { getRoleHome } from "./RoleHomeRedirect";

describe("getRoleHome", () => {
    test("sends students to the leaderboard and preserves staff dashboards", () => {
        expect(getRoleHome("student")).toBe("/student/leaderboard");
        expect(getRoleHome("teacher")).toBe("/teacher/dashboard");
        expect(getRoleHome("admin")).toBe("/admin/dashboard");
    });
});
