// Calendar helpers for YYYY-MM-DD strings; UTC maths keeps them free of the browser's timezone.
export const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const mondayOf = date => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
export const weekdayLabel = date => "日一二三四五六"[new Date(`${date}T00:00:00Z`).getUTCDay()];

// "12:30" / "1:02:03" / "90" → seconds. Returns null when the text is empty or not a time.
export const parseTimeInput = value => {
    const text = String(value ?? "").trim();
    if (!text) return null;
    const parts = text.split(":");
    if (parts.length > 3 || parts.some(part => !/^\d{1,5}$/.test(part))) return null;
    if (parts.slice(1).some(part => Number(part) > 59)) return null;
    const seconds = parts.reduce((total, part) => total * 60 + Number(part), 0);
    return seconds <= 86400 ? seconds : null;
};

export const formatSeconds = value => {
    const total = Number(value);
    if (!Number.isFinite(total) || total < 0) return "";
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(Math.floor(total % 60)).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
};

export const formatVideoRange = (start, end) => (
    end ? `${formatSeconds(start || 0)}–${formatSeconds(end)}` : `從 ${formatSeconds(start || 0)} 開始`
);

const videoId = url => {
    try {
        return new URL(url).searchParams.get("v") || "";
    } catch {
        return "";
    }
};

// The backend stores canonical https://www.youtube.com/watch?v=ID links.
export const youtubeEmbedUrl = (url, start, end) => {
    const id = videoId(url);
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return "";
    const params = new URLSearchParams({ start: String(start || 0), rel: "0", playsinline: "1" });
    if (end) params.set("end", String(end));
    return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
};

export const youtubeWatchUrl = (url, start) => {
    const id = videoId(url);
    return id ? `https://www.youtube.com/watch?v=${id}&t=${start || 0}s` : "";
};
