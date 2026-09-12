import fs from "fs";
import path from "path";

const pageSource = fs.readFileSync(path.join(__dirname, "StudentAssignments.jsx"), "utf8");
const styleSource = fs.readFileSync(path.join(__dirname, "css", "StudentAssignments.scss"), "utf8");

describe("student assignments child-friendly UI contract", () => {
    test("starts with a short task-oriented heading", () => {
        expect(pageSource).toContain("今天的作業");
        expect(pageSource).toContain("選一份作業，現在就開始。");
    });

    test("keeps progress details optional", () => {
        expect(pageSource).toContain('<details className="student-homework-summary">');
        expect(pageSource).toContain("查看今天的進度");
    });

    test("does not show an empty state when a v2 assignment exists", () => {
        expect(pageSource).toContain("assignments.length === 0 && v2Assignments.length === 0");
    });

    test("keeps the mobile task action touch friendly", () => {
        expect(styleSource).toMatch(/\.student-homework-action\s*\{[\s\S]*?min-height:\s*48px/);
    });
});
