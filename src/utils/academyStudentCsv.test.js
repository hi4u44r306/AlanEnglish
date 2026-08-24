import {
    ACADEMY_STUDENT_CSV_MAX_ROWS,
    buildAcademyStudentResultCsv,
    parseAcademyStudentCsv
} from "./academyStudentCsv";

describe("academyStudentCsv", () => {
    test("解析中文欄位、引號與逗號", () => {
        const rows = parseAcademyStudentCsv([
            "中文姓名,英文姓名,可收信Email,班級,入班日期,權限截止日,備註",
            '王小明,Alan,Parent@Example.com,E3,2026-08-24,2026-12-31,"需要留意, 容易分心"'
        ].join("\r\n"));

        expect(rows).toEqual([{
            source_row: 2,
            chinese_name: "王小明",
            english_name: "Alan",
            login_email: "Parent@Example.com",
            class_code: "E3",
            enrolled_at: "2026-08-24",
            access_ends_at: "2026-12-31",
            notes: "需要留意, 容易分心"
        }]);
    });

    test("缺少必要欄位時拒絕預覽", () => {
        expect(() => parseAcademyStudentCsv([
            "中文姓名,班級,入班日期",
            "王小明,E1,2026-08-24"
        ].join("\n"))).toThrow("缺少必要欄位：可收信 Email");
    });

    test("保留空白列之後的原始 CSV 列號", () => {
        const rows = parseAcademyStudentCsv([
            "中文姓名,可收信Email,班級,入班日期",
            "",
            "王小明,parent@example.com,E1,2026-08-24"
        ].join("\n"));

        expect(rows[0].source_row).toBe(3);
    });

    test("超過單批上限時拒絕預覽", () => {
        const rows = Array.from(
            { length: ACADEMY_STUDENT_CSV_MAX_ROWS + 1 },
            (_, index) => `學生${index},student${index}@mail.test,E1,2026-08-24`
        );

        expect(() => parseAcademyStudentCsv([
            "中文姓名,可收信Email,班級,入班日期",
            ...rows
        ].join("\n"))).toThrow(`一次最多匯入 ${ACADEMY_STUDENT_CSV_MAX_ROWS} 位學生`);
    });

    test("結果 CSV 只在成功列包含一次性密碼並正確跳脫錯誤", () => {
        const csv = buildAcademyStudentResultCsv([
            {
                row_number: 1,
                status: "success",
                credentials: {
                    email: "student@example.com",
                    temporary_password: "Ae7!temporary"
                }
            },
            {
                row_number: 2,
                status: "failed",
                login_email: "duplicate@example.com",
                code: "LOGIN_EMAIL_EXISTS",
                error: "帳號已存在, 請確認"
            }
        ]);

        expect(csv).toContain("Ae7!temporary");
        expect(csv).toContain('"帳號已存在, 請確認"');
        expect(csv.match(/Ae7!temporary/g)).toHaveLength(1);
    });
});
