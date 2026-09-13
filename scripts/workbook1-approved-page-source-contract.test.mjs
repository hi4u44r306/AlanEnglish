import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
    new URL("../supabase/migrations/20260911093000_workbook1_page_learning_content.sql", import.meta.url),
    "utf8"
);

const pagePrompts = page => {
    const match = migration.match(new RegExp(`\\(${page}, '[^']+', '(\\[[^\\n]+\\])'::jsonb\\)`));
    assert.ok(match, `Workbook 1 P${page} source is present`);
    return JSON.parse(match[1].replaceAll("''", "'"));
};

test("approved Workbook 1 page source is private and versioned", () => {
    assert.match(migration, /create table if not exists public\.book_page_spiral_review_content/);
    assert.match(migration, /unique \(book_id, page_number, version\)/);
    assert.match(migration, /enable row level security/);
    assert.match(migration, /revoke all on table public\.book_page_spiral_review_content from public, anon, authenticated/);
    assert.match(migration, /grant select, insert, update, delete on table public\.book_page_spiral_review_content to service_role/);
});

test("migration seeds exactly the canonical 119-page formal Workbook 1", () => {
    assert.match(migration, /generate_series\(1, 119\)/);
    assert.match(migration, /book\.code = 'Workbook_1'/);
    assert.match(migration, /book\.content_scope = 'formal'/);
    assert.match(migration, /Workbook_1 page content already exists; review versions instead of overwriting it/);
    assert.match(migration, /content\.status = 'published'\) <> 119/);
});

test("P14 to P17 approved spelling sources match the reviewed textbook pages", () => {
    assert.deepEqual(pagePrompts(14), ["apple", "juice", "world", "orange", "purple", "dance", "plane", "black", "queen", "friends"]);
    assert.deepEqual(pagePrompts(15), ["thanks", "welcome", "nice", "great", "teacher", "chair", "elephant", "paper", "bottle", "computer", "sunny", "weather"]);
    assert.deepEqual(pagePrompts(16), ["Taiwan", "Chinese", "McDonald's", "America", "Kentucky", "Starbucks", "Costco", "Tasty", "Family", "Gogoro", "Microsoft", "Domino's"]);
    assert.deepEqual(pagePrompts(17), ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]);
    assert.equal(pagePrompts(17).includes("thirteen"), false);
});

test("unsafe OCR blanks and restricted song prompts are blocked", () => {
    assert.match(migration, /unsafe blank or song/);
    assert.match(migration, /Baby Shark\|Twinkle Twinkle\|Baa Baa Black Sheep\|Cherish/);
    assert.match(migration, /Workbook_1 seed has no usable automatic-card page/);
});
