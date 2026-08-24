export const ACADEMY_STUDENT_CSV_MAX_ROWS = 25;

export const ACADEMY_STUDENT_CSV_HEADERS = [
    "中文姓名",
    "英文姓名",
    "可收信Email",
    "班級",
    "入班日期",
    "權限截止日",
    "備註"
];

const HEADER_FIELDS = new Map([
    ["中文姓名", "chinese_name"],
    ["英文姓名", "english_name"],
    ["可收信email", "login_email"],
    ["可收信 email", "login_email"],
    ["登入email", "login_email"],
    ["email", "login_email"],
    ["班級", "class_code"],
    ["入班日期", "enrolled_at"],
    ["權限截止日", "access_ends_at"],
    ["備註", "notes"]
]);

const REQUIRED_FIELDS = new Map([
    ["chinese_name", "中文姓名"],
    ["login_email", "可收信 Email"],
    ["class_code", "班級"],
    ["enrolled_at", "入班日期"]
]);

const normalizeHeader = value => String(value || "")
    .replace(/^\uFEFF/, "")
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

export const parseAcademyStudentCsv = text => {
    const source = String(text || "").replace(/^\uFEFF/, "");
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

    return dataRows.map(({ cells, sourceRow }) => {
        const student = {
            source_row: sourceRow
        };

        fields.forEach((field, columnIndex) => {
            if (!field) return;
            student[field] = String(cells[columnIndex] || "").trim();
        });

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

export const buildAcademyStudentResultCsv = results => {
    const headers = ["原始列號", "建立結果", "登入Email", "一次性臨時密碼", "錯誤代碼", "錯誤訊息"];
    const rows = (Array.isArray(results) ? results : []).map(result => [
        Number(result?.source_row || result?.row_number || 0),
        result?.status === "success" ? "成功" : "失敗",
        result?.credentials?.email || result?.login_email || "",
        result?.credentials?.temporary_password || "",
        result?.code || "",
        result?.error || ""
    ]);

    return `\uFEFF${[headers, ...rows]
        .map(row => row.map(escapeCsvCell).join(","))
        .join("\r\n")}\r\n`;
};
