import { changeAcademyStudentClass } from "./academyStudentService";
import { callEdgeFunction } from "./edgeFunctionClient";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

describe("changeAcademyStudentClass", () => {
    it("calls the admin-only academy-class-change function with a clean payload", async () => {
        callEdgeFunction.mockResolvedValue({ success: true, change: { to_class: "E1", change_type: "demote" } });
        const user = { uid: "admin" };

        const result = await changeAcademyStudentClass(user, { studentId: "7", classCode: " e1 ", effectiveOn: " 2026-10-15 ", reason: "  程度調整  " });

        expect(callEdgeFunction).toHaveBeenCalledWith("academy-class-change", user, {
            student_id: 7, class_code: "E1", effective_on: "2026-10-15", reason: "程度調整"
        });
        expect(result.change.change_type).toBe("demote");
    });

    it("lets the server's plain-language error reach the admin", async () => {
        callEdgeFunction.mockRejectedValue(new Error("學生已經在這個班級，不需要調整"));
        await expect(changeAcademyStudentClass({}, { studentId: 1, classCode: "E3", effectiveOn: "2026-10-15", reason: "測試" }))
            .rejects.toThrow("學生已經在這個班級，不需要調整");
    });
});
