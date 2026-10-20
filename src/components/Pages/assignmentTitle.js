// 作業名稱自動帶入：日期 班級 教材與頁碼，例如「10/15 E1 Workbook 1 P22～P32」。老師仍可自行修改。

const pageNumber = value => {
    const match = String(value || "").match(/(\d+)/);
    return match ? Number(match[1]) : null;
};

export const formatTitleDate = isoDate => {
    const match = String(isoDate || "").match(/^\d{4}-(\d{2})-(\d{2})$/);
    return match ? `${Number(match[1])}/${Number(match[2])}` : "";
};

// 例如 P22、P32 → "P22～P32"；只有一個 → "P22"；沒有頁碼資訊 → ""
export const trackRangeLabel = tracks => {
    const labeled = (tracks || [])
        .map(track => ({ text: String(track.display_page || track.page || "").trim(), number: pageNumber(track.display_page || track.page) }))
        .filter(item => item.text);
    if (!labeled.length) return "";
    const sorted = [...labeled].sort((left, right) => (left.number ?? 0) - (right.number ?? 0));
    const first = sorted[0].text;
    const last = sorted[sorted.length - 1].text;
    return first === last ? first : `${first}～${last}`;
};

export const buildAssignmentTitle = ({ assignedDate, classCode, groups }) => {
    if (!classCode) return "";
    const parts = [formatTitleDate(assignedDate), classCode];
    (groups || []).forEach(group => {
        const range = trackRangeLabel(group.tracks);
        parts.push([group.book?.name, range].filter(Boolean).join(" "));
    });
    return parts.filter(Boolean).join(" ").slice(0, 200);
};
