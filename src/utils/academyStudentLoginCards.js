export const getSuccessfulStudentLoginCards = (results, rows) => (
    (Array.isArray(results) ? results : [])
        .filter(result => result?.status === "success" && result?.credentials?.activation_url)
        .map(result => ({
            sourceRow: result.source_row,
            chineseName: (Array.isArray(rows) ? rows : [])
                .find(row => row.source_row === result.source_row)?.chinese_name || "學生",
            englishName: (Array.isArray(rows) ? rows : [])
                .find(row => row.source_row === result.source_row)?.english_name || "",
            username: result.credentials.username || "",
            temporaryPassword: result.credentials.temporary_password || "",
            activationUrl: result.credentials.activation_url,
            recoveryCodes: result.credentials.recovery_codes || []
        }))
);

// A4 貼紙紙每頁 12 格（2 欄 × 6 列）。
export const LOGIN_CARDS_PER_PAGE = 12;

// 「放在第幾格」：只接受 1～12，其他（空白、文字、超出範圍）一律修正成合理的值。
export const normalizeStartSlot = value => {
    const slot = Math.floor(Number(value));
    if (!Number.isFinite(slot)) return 1;
    return Math.min(LOGIN_CARDS_PER_PAGE, Math.max(1, slot));
};
