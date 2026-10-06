jest.mock("./AuthContext", () => ({ useAuth: jest.fn() }));

import { getRoleHome } from "./RoleHomeRedirect";

describe("getRoleHome", () => {
    test("sends students to today's learning and preserves staff dashboards", () => {
        expect(getRoleHome("student")).toBe("/student/dashboard");
        expect(getRoleHome("teacher")).toBe("/teacher/dashboard");
        expect(getRoleHome("admin")).toBe("/admin/dashboard");
    });
});
