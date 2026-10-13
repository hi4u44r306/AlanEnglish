export const ATTENDANCE_STATUSES = new Set(["present", "late", "absent", "leave"]);
// 缺席與請假的學生才需要補課。
export const ABSENT_STATUSES = new Set(["absent", "leave"]);

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

// Accepts a single YouTube video link in any common form and returns the canonical watch URL.
// Playlists and other hosts are rejected so a makeup button can only open a known video.
export const normalizeYouTubeUrl = (value: unknown) => {
    let parsed: URL;
    try {
        parsed = new URL(String(value ?? "").trim());
    } catch {
        return "";
    }
    if (parsed.protocol !== "https:") return "";
    const host = parsed.hostname.replace(/^(www|m)\./, "");
    let id = "";
    if (host === "youtu.be") id = parsed.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com") {
        const [, kind, segment] = parsed.pathname.split("/");
        if (kind === "watch") id = parsed.searchParams.get("v") || "";
        else if (kind === "embed" || kind === "shorts" || kind === "live") id = segment || "";
    }
    return YOUTUBE_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : "";
};

export const normalizeSeconds = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 86400 ? parsed : null;
};

export const isValidSessionDate = (value: string, today: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value && value <= today;
};

// Start of the class day in Taiwan; listening before this does not count as makeup.
export const sessionStartIso = (sessionDate: string) => new Date(`${sessionDate}T00:00:00+08:00`).toISOString();
