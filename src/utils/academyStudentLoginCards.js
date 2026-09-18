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
