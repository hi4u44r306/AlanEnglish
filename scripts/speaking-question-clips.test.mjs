import assert from "node:assert/strict";
import test from "node:test";
import { clipsAllowedForMode, loadApprovedClips, normalizeMusicStoragePath, toPublicClip, validateClipImport } from "../supabase/functions/_shared/speaking-question-clips.ts";

const context = { questionIds: new Set([265, 266]), tracks: new Map([[114, null], [200, 30]]) };

test("an audio clip on the same book's track is accepted", () => {
    const result = validateClipImport({ question_id: 265, source_type: "audio", track_id: 114, start_ms: 6280, end_ms: 11580, transcript_en: " It is an eye. " }, context);
    assert.deepEqual(result, { row: { question_id: 265, source_type: "audio", track_id: 114, youtube_video_id: null, start_ms: 6280, end_ms: 11580, transcript_en: "It is an eye." } });
});

test("clips for other sets, other books, bad times or bad lengths are rejected", () => {
    const base = { question_id: 265, source_type: "audio", track_id: 114, start_ms: 1000, end_ms: 5000 };
    assert.ok("error" in validateClipImport({ ...base, question_id: 999 }, context));
    assert.ok("error" in validateClipImport({ ...base, track_id: 999 }, context));
    assert.ok("error" in validateClipImport({ ...base, end_ms: 1000 }, context));
    assert.ok("error" in validateClipImport({ ...base, start_ms: -1 }, context));
    assert.ok("error" in validateClipImport({ ...base, end_ms: 1200 }, context), "shorter than 0.5 s");
    assert.ok("error" in validateClipImport({ ...base, end_ms: 200000 }, context), "longer than 120 s");
    assert.ok("error" in validateClipImport({ ...base, source_type: "text" }, context));
    assert.ok("error" in validateClipImport({ ...base, track_id: 200, end_ms: 31000 }, context), "past the track length");
    assert.ok("row" in validateClipImport({ ...base, track_id: 200, end_ms: 30000 }, context));
});

test("a video clip needs an 11-character YouTube id", () => {
    const base = { question_id: 266, source_type: "video", start_ms: 0, end_ms: 4000 };
    assert.ok("error" in validateClipImport({ ...base, youtube_video_id: "abc" }, context));
    assert.deepEqual(validateClipImport({ ...base, youtube_video_id: "dQw4w9WgXcQ" }, context).row.track_id, null);
});

test("clips are only offered when the answer is already visible", () => {
    assert.equal(clipsAllowedForMode({ challengeMode: "easy", demoMode: false, practiceOnly: false }), true);
    assert.equal(clipsAllowedForMode({ challengeMode: "challenge", demoMode: false, practiceOnly: false }), false);
    assert.equal(clipsAllowedForMode({ challengeMode: "challenge", demoMode: true, practiceOnly: false }), true);
    assert.equal(clipsAllowedForMode({ challengeMode: "challenge", demoMode: false, practiceOnly: true }), true);
});

test("public clips never leak track ids and need a signed url for audio", () => {
    assert.equal(toPublicClip({ source_type: "audio", track_id: 114, start_ms: 1, end_ms: 900 }, undefined), null);
    assert.deepEqual(toPublicClip({ source_type: "audio", track_id: 114, start_ms: 1, end_ms: 900 }, "https://signed"), { type: "audio", url: "https://signed", start_ms: 1, end_ms: 900 });
    assert.deepEqual(toPublicClip({ source_type: "video", youtube_video_id: "dQw4w9WgXcQ", start_ms: 0, end_ms: 900 }), { type: "video", youtube_video_id: "dQw4w9WgXcQ", start_ms: 0, end_ms: 900 });
});

test("storage paths are normalised like content-access", () => {
    assert.equal(normalizeMusicStoragePath("/books/wb3/p4.mp3"), "books/wb3/p4.mp3");
    assert.equal(normalizeMusicStoragePath("https://x.supabase.co/storage/v1/object/public/music/a%20b.mp3"), "a b.mp3");
    assert.equal(normalizeMusicStoragePath("https://example.com/other.mp3"), "");
});

const fakeAdmin = (clips, tracks) => ({
    from(table) {
        const rows = table === "speaking_question_media_clips" ? clips : tracks;
        const query = { filters: [] };
        const chain = {
            select: () => chain,
            in: (column, values) => { query.filters.push(row => values.includes(row[column])); return chain; },
            eq: (column, value) => { query.filters.push(row => row[column] === value); return chain; },
            then: resolve => resolve({ data: rows.filter(row => query.filters.every(filter => filter(row))), error: null })
        };
        return chain;
    },
    storage: { from: () => ({ createSignedUrl: async path => ({ data: { signedUrl: `supa:${path}` } }) }) }
});

test("only approved clips on enabled tracks of the same book are returned, each track signed once", async () => {
    const signed = [];
    const admin = fakeAdmin([
        { question_id: 1, source_type: "audio", track_id: 114, start_ms: 0, end_ms: 1000, status: "approved" },
        { question_id: 2, source_type: "audio", track_id: 114, start_ms: 2000, end_ms: 3000, status: "approved" },
        { question_id: 3, source_type: "audio", track_id: 999, start_ms: 0, end_ms: 1000, status: "approved" },
        { question_id: 4, source_type: "audio", track_id: 114, start_ms: 0, end_ms: 1000, status: "draft" },
        { question_id: 5, source_type: "video", youtube_video_id: "dQw4w9WgXcQ", start_ms: 0, end_ms: 1000, status: "approved" }
    ], [
        { id: 114, book_id: 3, enabled: true, storage_provider: "r2", audio_url: "wb3/p4.mp3" },
        { id: 999, book_id: 8, enabled: true, storage_provider: "r2", audio_url: "other.mp3" }
    ]);
    const clips = await loadApprovedClips(admin, [1, 2, 3, 4, 5], 3, async key => { signed.push(key); return `r2:${key}`; });
    assert.deepEqual([...clips.keys()].sort(), [1, 2, 5]);
    assert.equal(clips.get(2).url, "r2:wb3/p4.mp3");
    assert.deepEqual(signed, ["wb3/p4.mp3"]);
    assert.equal(clips.get(5).type, "video");
});
