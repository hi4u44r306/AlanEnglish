import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260929143000_add_basic_reading_listening_catalog.sql", import.meta.url);

test("Basic Reading migration registers nine formal books and 399 private R2 tracks", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const collectionRows = [...sql.matchAll(/\((400|800|1200),\s*([123]),\s*'br\1_\2',\s*(51|49|33)(?:,\s*\d+)?\)/g)];
    const uniqueCollections = new Map(collectionRows.map(match => [`${match[1]}-${match[2]}`, Number(match[3])]));

    assert.equal(uniqueCollections.size, 9);
    assert.equal([...uniqueCollections.values()].reduce((total, count) => total + count, 0), 399);
    assert.match(sql, /storage_provider[\s\S]*'r2'/);
    assert.match(sql, /basic-reading\/%s\/Track%s\.mp3/);
    assert.match(sql, /content_scope[\s\S]*'formal'/);
    assert.match(sql, /where not exists/i);
    assert.match(sql, /basic_reading_track_count <> 399/);
});
