import {
    ACADEMY_STUDENT_CSV_EXAMPLE_NOTE,
    ACADEMY_STUDENT_CSV_HEADERS,
    ACADEMY_STUDENT_CSV_MAX_ROWS,
    buildAcademyStudentCsvExample,
    buildAcademyStudentCsvTemplate,
    buildAcademyStudentResultCsv,
    normalizeAcademyCsvDate,
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

    test("英文姓名必填，登入帳號與家長 Email 可省略", () => {
        expect(() => parseAcademyStudentCsv([
            "中文姓名,英文姓名,班級,入班日期",
            "王小明,Alan,E1,2026-08-24"
        ].join("\n"))).not.toThrow();

        expect(() => parseAcademyStudentCsv([
            "中文姓名,班級,入班日期",
            "王小明,E1,2026-08-24"
        ].join("\n"))).toThrow("缺少必要欄位：英文姓名");
    });

    test("保留空白列之後的原始 CSV 列號", () => {
        const rows = parseAcademyStudentCsv([
            "中文姓名,英文姓名,班級,入班日期",
            "",
            "王小明,Alan,E1,2026-08-24"
        ].join("\n"));

        expect(rows[0].source_row).toBe(3);
    });

    test("超過單批上限時拒絕預覽", () => {
        const rows = Array.from(
            { length: ACADEMY_STUDENT_CSV_MAX_ROWS + 1 },
            (_, index) => `學生${index},Alan${index},E1,2026-08-24`
        );

        expect(() => parseAcademyStudentCsv([
            "中文姓名,英文姓名,班級,入班日期",
            ...rows
        ].join("\n"))).toThrow(`一次最多匯入 ${ACADEMY_STUDENT_CSV_MAX_ROWS} 位學生`);
    });

    test("日期轉成後端要求的 YYYY-MM-DD，無效日期原樣保留交給預覽報錯", () => {
        expect(normalizeAcademyCsvDate("2026/9/1")).toBe("2026-09-01");
        expect(normalizeAcademyCsvDate("2026-9-1")).toBe("2026-09-01");
        expect(normalizeAcademyCsvDate("2026.12.5")).toBe("2026-12-05");
        expect(normalizeAcademyCsvDate("20260901")).toBe("2026-09-01");
        expect(normalizeAcademyCsvDate(" 2026-09-01 ")).toBe("2026-09-01");
        expect(normalizeAcademyCsvDate("")).toBe("");
        expect(normalizeAcademyCsvDate("2026/2/30")).toBe("2026/2/30");
        expect(normalizeAcademyCsvDate("九月一日")).toBe("九月一日");
    });

    test("讀取時自動修正班級與日期，並接受兩層 BOM 與新版選填欄位名稱", () => {
        const rows = parseAcademyStudentCsv([
            "﻿﻿中文姓名,英文姓名,班級,入班日期,權限截止日(選填),備註(選填)",
            "王小明,Alan,ｅ１,2026/9/1,20270630,"
        ].join("\r\n"));

        expect(rows[0]).toMatchObject({ class_code: "E1", enrolled_at: "2026-09-01", access_ends_at: "2027-06-30", notes: "" });
    });

    test("範本欄位必填在前，空白範本與填寫範例都能被讀取規則辨識", () => {
        expect(ACADEMY_STUDENT_CSV_HEADERS.slice(0, 4)).toEqual(["中文姓名", "英文姓名", "班級", "入班日期"]);
        expect(buildAcademyStudentCsvTemplate().startsWith("﻿中文姓名,英文姓名,班級,入班日期")).toBe(true);
        expect(() => parseAcademyStudentCsv(buildAcademyStudentCsvTemplate())).toThrow("CSV 沒有學生資料");

        const example = buildAcademyStudentCsvExample();
        expect(example.split("\r\n").filter(Boolean)).toHaveLength(4);
        expect(() => parseAcademyStudentCsv(example)).toThrow("第 2、3、4 列是範例資料，請刪除後再上傳");
    });

    test("把範例列刪掉、填上真的學生後可以正常讀取", () => {
        const lines = buildAcademyStudentCsvExample().replace(/^﻿/, "").split("\r\n").filter(Boolean);
        const filled = [lines[0], lines[1].replace(ACADEMY_STUDENT_CSV_EXAMPLE_NOTE, "")].join("\r\n");
        expect(parseAcademyStudentCsv(filled)).toEqual([expect.objectContaining({
            chinese_name: "王小明", english_name: "Ming Wang", class_code: "E1", enrolled_at: "2026-09-01", guardian_email: "parent@example.com"
        })]);
    });

    test("結果 CSV 只在成功列包含一次性啟用與復原資料並正確跳脫錯誤", () => {
        const csv = buildAcademyStudentResultCsv([
            {
                row_number: 1,
                status: "success",
                credentials: {
                    username: "alanwang",
                    temporary_password: "Ae-K7M2-P9RX",
                    activation_url: "https://alanenglish.com.tw/academy/student-setup?token=one-time",
                    recovery_codes: ["123456", "654321"]
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

        expect(csv).toContain("123456");
        expect(csv).toContain("Ae-K7M2-P9RX");
        expect(csv).toContain("一次性臨時密碼");
        expect(csv).toContain('"帳號已存在, 請確認"');
        expect(csv.match(/123456/g)).toHaveLength(1);
    });
});
