import {
    ACADEMY_STUDENT_CSV_MAX_ROWS,
    buildAcademyStudentResultCsv,
    parseAcademyStudentCsv
} from "./academyStudentCsv";

describe("academyStudentCsv", () => {
    test("解析中文欄位、引號與逗號", () => {
        const rows = parseAcademyStudentCsv([
            "中文姓名,英文姓名,登入帳號(選填),班級,入班日期,權限截止日,家長Email(選填),備註",
            '王小明,Alan,alanwang,E3,2026-08-24,2026-12-31,Parent@Example.com,"需要留意, 容易分心"'
        ].join("\r\n"));

        expect(rows).toEqual([{
            source_row: 2,
            chinese_name: "王小明",
            english_name: "Alan",
            login_username: "alanwang",
            class_code: "E3",
            enrolled_at: "2026-08-24",
            access_ends_at: "2026-12-31",
            guardian_email: "Parent@Example.com",
            notes: "需要留意, 容易分心"
        }]);
    });

    test("登入帳號與家長 Email 可省略", () => {
        expect(() => parseAcademyStudentCsv([
            "中文姓名,班級,入班日期",
            "王小明,E1,2026-08-24"
        ].join("\n"))).not.toThrow();
    });

    test("保留空白列之後的原始 CSV 列號", () => {
        const rows = parseAcademyStudentCsv([
            "中文姓名,班級,入班日期",
            "",
            "王小明,E1,2026-08-24"
        ].join("\n"));

        expect(rows[0].source_row).toBe(3);
    });

    test("超過單批上限時拒絕預覽", () => {
        const rows = Array.from(
            { length: ACADEMY_STUDENT_CSV_MAX_ROWS + 1 },
            (_, index) => `學生${index},E1,2026-08-24`
        );

        expect(() => parseAcademyStudentCsv([
            "中文姓名,班級,入班日期",
            ...rows
        ].join("\n"))).toThrow(`一次最多匯入 ${ACADEMY_STUDENT_CSV_MAX_ROWS} 位學生`);
    });

    test("結果 CSV 只在成功列包含一次性啟用與復原資料並正確跳脫錯誤", () => {
        const csv = buildAcademyStudentResultCsv([
            {
                row_number: 1,
                status: "success",
                credentials: {
                    username: "alanwang",
                    activation_url: "https://alanenglish.com.tw/academy/student-setup?token=one-time",
                    recovery_codes: ["AE-AAAA-BBBB-CCCC", "AE-DDDD-EEEE-FFFF"]
                }
            },
            {
                row_number: 2,
                status: "failed",
                login_username: "alanwang",
                code: "LOGIN_USERNAME_EXISTS",
                error: "帳號已存在, 請確認"
            }
        ]);

        expect(csv).toContain("AE-AAAA-BBBB-CCCC");
        expect(csv).toContain('"帳號已存在, 請確認"');
        expect(csv.match(/AE-AAAA-BBBB-CCCC/g)).toHaveLength(1);
    });
});
