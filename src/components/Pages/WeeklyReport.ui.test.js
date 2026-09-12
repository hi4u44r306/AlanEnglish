import fs from "fs";
import path from "path";

const pageSource = fs.readFileSync(path.join(__dirname, "WeeklyReport.jsx"), "utf8");
const styleSource = fs.readFileSync(path.join(__dirname, "css", "WeeklyReport.scss"), "utf8");

describe("weekly report student UI contract", () => {
    test("uses a short student heading without changing the manager heading", () => {
        expect(pageSource).toContain('weekly-report-page--student');
        expect(pageSource).toContain('"這週做得怎麼樣？"');
        expect(pageSource).toContain('`${report.student.name} 的每週成長報告`');
    });

    test("shows encouragement and next actions before detailed charts for students", () => {
        expect(styleSource).toMatch(/weekly-report-page--student[\s\S]*?weekly-report-insights[\s\S]*?order:\s*1/);
        expect(styleSource).toMatch(/weekly-report-page--student[\s\S]*?weekly-report-key-metrics[\s\S]*?order:\s*2/);
    });

    test("keeps the manager layout outside the student-only scope", () => {
        expect(styleSource).not.toMatch(/weekly-report-page--manager[^}]*display:\s*flex/);
    });
});
