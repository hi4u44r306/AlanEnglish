import fs from "fs";
import path from "path";

const pageSource = fs.readFileSync(path.join(__dirname, "ReviewCenter.jsx"), "utf8");
const styleSource = fs.readFileSync(path.join(__dirname, "css", "ReviewCenter.scss"), "utf8");

describe("review center child-friendly UI contract", () => {
    test("uses short action-first guidance", () => {
        expect(pageSource).toContain("把不熟的題目練會");
        expect(pageSource).toContain("選答案就可以開始");
    });

    test("keeps progress and weaknesses optional", () => {
        expect(pageSource).toContain('<details className="review-progress-details">');
        expect(pageSource).toContain("查看學習進度");
    });

    test("visually places the active task before progress detail", () => {
        expect(styleSource).toMatch(/\.review-session,[\s\S]*?\.review-state\s*\{[\s\S]*?order:\s*1/);
        expect(styleSource).toMatch(/\.review-progress-details\s*\{[\s\S]*?order:\s*2/);
    });

    test("keeps answer options touch friendly", () => {
        expect(styleSource).toMatch(/\.review-option\s*\{[\s\S]*?min-height:\s*66px/);
    });
});
