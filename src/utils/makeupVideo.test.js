import { addDays, formatSeconds, formatVideoRange, mondayOf, parseTimeInput, weekdayLabel, youtubeEmbedUrl, youtubeWatchUrl } from "./makeupVideo";

describe("makeup video helpers", () => {
    test("finds the week of a class day", () => {
        expect(weekdayLabel("2026-10-13")).toBe("二");
        expect(mondayOf("2026-10-13")).toBe("2026-10-12");
        expect(mondayOf("2026-10-18")).toBe("2026-10-12");
        expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    });

    test("parses teacher time input", () => {
        expect(parseTimeInput("12:30")).toBe(750);
        expect(parseTimeInput("1:02:03")).toBe(3723);
        expect(parseTimeInput("90")).toBe(90);
        expect(parseTimeInput("")).toBeNull();
        expect(parseTimeInput("12:75")).toBeNull();
        expect(parseTimeInput("abc")).toBeNull();
    });

    test("formats seconds and ranges", () => {
        expect(formatSeconds(750)).toBe("12:30");
        expect(formatSeconds(3723)).toBe("1:02:03");
        expect(formatVideoRange(750, 1125)).toBe("12:30–18:45");
        expect(formatVideoRange(0, null)).toBe("從 0:00 開始");
    });

    test("builds links that jump to the taught segment", () => {
        const url = "https://www.youtube.com/watch?v=abcdefghijk";
        expect(youtubeEmbedUrl(url, 750, 1125)).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk?start=750&rel=0&playsinline=1&end=1125");
        expect(youtubeWatchUrl(url, 750)).toBe("https://www.youtube.com/watch?v=abcdefghijk&t=750s");
        expect(youtubeEmbedUrl("https://example.com/watch?v=bad", 0, null)).toBe("");
    });
});
