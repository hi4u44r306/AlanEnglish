const compareNaturalText = (left, right) => String(left || "").localeCompare(
    String(right || ""),
    "zh-Hant",
    { numeric: true, sensitivity: "base" }
);

const getSortOrder = value => {
    if (value === null || value === undefined || value === "") return Number.MAX_SAFE_INTEGER;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const getTrackLabel = track => track?.display_page || track?.page || track?.music_name || "";

export const sortMusicTracksAscending = tracks => [...(tracks || [])].sort((a, b) => {
    const orderCompare = getSortOrder(a.sort_order) - getSortOrder(b.sort_order);
    if (orderCompare !== 0) return orderCompare;

    const labelCompare = compareNaturalText(getTrackLabel(a), getTrackLabel(b));
    if (labelCompare !== 0) return labelCompare;

    const fileCompare = compareNaturalText(a.music_name, b.music_name);
    if (fileCompare !== 0) return fileCompare;

    return Number(a.id || 0) - Number(b.id || 0);
});
