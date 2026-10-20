export const ACADEMY_STUDENT_CSV_MAX_ROWS = 25;

// 範本欄位：必填在前、選填在後（標示「(選填)」）。讀取時依欄位名稱對應，欄位順序不影響。
export const ACADEMY_STUDENT_CSV_HEADERS = [
    "中文姓名",
    "英文姓名",
    "班級",
    "入班日期",
    "登入帳號(選填)",
    "家長Email(選填)",
    "權限截止日(選填)",
    "備註(選填)"
];

// 填寫範例檔用的備註；上傳時若還有這一列會被擋下，避免建立假學生。
export const ACADEMY_STUDENT_CSV_EXAMPLE_NOTE = "範例資料，上傳前請刪除這一列";

const EXAMPLE_ROWS = [
    ["王小明", "Ming Wang", "E1", "2026-09-01", "", "parent@example.com", "", ACADEMY_STUDENT_CSV_EXAMPLE_NOTE],
    ["陳小華", "Hua Chen", "E3", "2026-09-01", "huachen", "", "", ACADEMY_STUDENT_CSV_EXAMPLE_NOTE],
    ["林小美", "Mei Lin", "E5", "2026-09-01", "", "", "2027-06-30", ACADEMY_STUDENT_CSV_EXAMPLE_NOTE]
];

const HEADER_FIELDS = new Map([
    ["中文姓名", "chinese_name"],
    ["英文姓名", "english_name"],
    ["登入帳號(選填)", "login_username"],
    ["登入帳號（選填）", "login_username"],
    ["登入帳號", "login_username"],
    ["班級", "class_code"],
    ["入班日期", "enrolled_at"],
    ["權限截止日", "access_ends_at"],
    ["權限截止日(選填)", "access_ends_at"],
    ["權限截止日（選填）", "access_ends_at"],
    ["家長email(選填)", "guardian_email"],
    ["家長email（選填）", "guardian_email"],
    ["家長email", "guardian_email"],
    ["備註", "notes"],
    ["備註(選填)", "notes"],
    ["備註（選填）", "notes"]
]);

const REQUIRED_FIELDS = new Map([
    ["chinese_name", "中文姓名"],
    ["english_name", "英文姓名"],
    ["class_code", "班級"],
    ["enrolled_at", "入班日期"]
]);

const normalizeHeader = value => String(value || "")
    .replace(/^\uFEFF+/, "")
    .trim()
    .toLowerCase();

const parseCsvCells = text => {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];

        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                cell += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                cell += character;
            }
            continue;
        }

        if (character === '"' && cell.length === 0) {
            quoted = true;
        } else if (character === ",") {
            row.push(cell);
            cell = "";
        } else if (character === "\n" || character === "\r") {
            if (character === "\r" && text[index + 1] === "\n") index += 1;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += character;
        }
    }

    if (quoted) throw new Error("CSV 有未關閉的雙引號");
    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }

    return rows;
};

const isBlankRow = row => row.every(cell => !String(cell || "").trim());

// 日期一律轉成後端要求的 YYYY-MM-DD。接受 2026-9-1、2026/9/1、2026.9.1、20260901；
// 不是有效日期就原樣保留，交給預覽顯示錯誤，不自行猜測。
export const normalizeAcademyCsvDate = value => {
    const text = String(value || "").trim();
    if (!text) return "";
    const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/) || text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return text;
    const iso = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    const date = new Date(`${iso}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : text;
};

// 班級：全形轉半形、去空白、轉大寫（ｅ１ → E1）。是否為 E1／E3／E5／E7 由預覽檢查。
const normalizeClassCode = value => String(value || "").normalize("NFKC").replace(/\s+/g, "").toUpperCase();

export const parseAcademyStudentCsv = text => {
    const source = String(text || "").replace(/^\uFEFF+/, "");
    if (!source.trim()) throw new Error("CSV 檔案沒有內容");

    const parsedRows = parseCsvCells(source);
    if (parsedRows.length === 0) throw new Error("CSV 檔案沒有標題列");

    const headers = parsedRows[0].map(normalizeHeader);
    const fields = headers.map(header => HEADER_FIELDS.get(header) || null);
    const unknownHeaders = headers.filter((header, index) => header && !fields[index]);
    if (unknownHeaders.length > 0) {
        throw new Error(`無法辨識欄位：${unknownHeaders.join("、")}`);
    }

    const duplicateFields = fields.filter((field, index) => field && fields.indexOf(field) !== index);
    if (duplicateFields.length > 0) throw new Error("CSV 有重複欄位");

    const missingHeaders = Array.from(REQUIRED_FIELDS.entries())
        .filter(([field]) => !fields.includes(field))
        .map(([, label]) => label);
    if (missingHeaders.length > 0) {
        throw new Error(`缺少必要欄位：${missingHeaders.join("、")}`);
    }

    const dataRows = parsedRows
        .slice(1)
        .map((cells, index) => ({ cells, sourceRow: index + 2 }))
        .filter(item => !isBlankRow(item.cells));
    if (dataRows.length === 0) throw new Error("CSV 沒有學生資料");
    if (dataRows.length > ACADEMY_STUDENT_CSV_MAX_ROWS) {
        throw new Error(`一次最多匯入 ${ACADEMY_STUDENT_CSV_MAX_ROWS} 位學生`);
    }

    const exampleRows = dataRows.filter(({ cells }) => cells.some(cell => String(cell || "").trim() === ACADEMY_STUDENT_CSV_EXAMPLE_NOTE));
    if (exampleRows.length > 0) {
        throw new Error(`第 ${exampleRows.map(item => item.sourceRow).join("、")} 列是範例資料，請刪除後再上傳`);
    }

    return dataRows.map(({ cells, sourceRow }) => {
        const student = {
            source_row: sourceRow
        };

        fields.forEach((field, columnIndex) => {
            if (!field) return;
            student[field] = String(cells[columnIndex] || "").trim();
        });
        if ("class_code" in student) student.class_code = normalizeClassCode(student.class_code);
        if ("enrolled_at" in student) student.enrolled_at = normalizeAcademyCsvDate(student.enrolled_at);
        if ("access_ends_at" in student) student.access_ends_at = normalizeAcademyCsvDate(student.access_ends_at);

        return student;
    });
};

const escapeCsvCell = value => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text)
        ? `"${text.replaceAll('"', '""')}"`
        : text;
};

export const buildAcademyStudentCsvTemplate = () => (
    `\uFEFF${ACADEMY_STUDENT_CSV_HEADERS.map(escapeCsvCell).join(",")}\r\n`
);

export const buildAcademyStudentCsvExample = () => (
    `\uFEFF${[ACADEMY_STUDENT_CSV_HEADERS, ...EXAMPLE_ROWS].map(row => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`
);

export const buildAcademyStudentResultCsv = results => {
    const headers = ["原始列號", "建立結果", "登入帳號", "一次性臨時密碼", "啟用連結", "復原碼1", "復原碼2", "錯誤代碼", "錯誤訊息"];
    const rows = (Array.isArray(results) ? results : []).map(result => [
        Number(result?.source_row || result?.row_number || 0),
        result?.status === "success" ? "成功" : "失敗",
        result?.credentials?.username || result?.login_username || "",
        result?.credentials?.temporary_password || "",
        result?.credentials?.activation_url || "",
        result?.credentials?.recovery_codes?.[0] || "",
        result?.credentials?.recovery_codes?.[1] || "",
        result?.code || "",
        result?.error || ""
    ]);

    return `\uFEFF${[headers, ...rows]
        .map(row => row.map(escapeCsvCell).join(","))
        .join("\r\n")}\r\n`;
};
