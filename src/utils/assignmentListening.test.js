import { assignmentDisplayTitle } from "./assignmentListening";

test("a leading eight-digit date is shown with slashes", () => {
    expect(assignmentDisplayTitle("20260824回家功課")).toBe("2026/08/24 回家功課");
    expect(assignmentDisplayTitle("20260824 回家功課")).toBe("2026/08/24 回家功課");
    expect(assignmentDisplayTitle("20260824")).toBe("2026/08/24");
});

test("anything that is not a real date stays as the teacher typed it", () => {
    expect(assignmentDisplayTitle("20261340回家功課")).toBe("20261340回家功課");
    expect(assignmentDisplayTitle("202608241 號練習")).toBe("202608241 號練習");
    expect(assignmentDisplayTitle("Workbook 1 P22")).toBe("Workbook 1 P22");
    expect(assignmentDisplayTitle(undefined)).toBe("");
});
