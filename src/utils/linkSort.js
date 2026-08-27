const CATEGORY_ORDER = ["special", "exercise", "listening", "discovery", "speedphonics"];

const compareNaturalText = (left, right) => String(left || "").localeCompare(
    String(right || ""),
    "zh-Hant",
    { numeric: true, sensitivity: "base" }
);

const getCategoryOrder = value => {
    const index = CATEGORY_ORDER.indexOf(String(value || ""));
    return index === -1 ? CATEGORY_ORDER.length : index;
};

export const sortLinkItemsAscending = items => [...(items || [])].sort((a, b) => {
    const categoryCompare = getCategoryOrder(a.category) - getCategoryOrder(b.category);
    if (categoryCompare !== 0) return categoryCompare;

    const titleCompare = compareNaturalText(a.title, b.title);
    if (titleCompare !== 0) return titleCompare;

    const orderCompare = Number(a.sort_order || 0) - Number(b.sort_order || 0);
    if (orderCompare !== 0) return orderCompare;

    return Number(a.id || 0) - Number(b.id || 0);
});
