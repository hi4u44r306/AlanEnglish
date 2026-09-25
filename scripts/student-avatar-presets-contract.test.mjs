import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const frontend = readFileSync(new URL("../src/constants/defaultStudentAvatars.js", import.meta.url), "utf8");
const gamificationEdge = readFileSync(new URL("../supabase/functions/gamification/index.ts", import.meta.url), "utf8");
const socialEdge = readFileSync(new URL("../supabase/functions/student-social/index.ts", import.meta.url), "utf8");
const settingsCss = readFileSync(new URL("../src/components/Pages/css/StudentSettings.scss", import.meta.url), "utf8");
const gamificationCss = readFileSync(new URL("../src/components/Pages/css/Gamification.scss", import.meta.url), "utf8");

const avatarPaths = source => [...source.matchAll(/"(\/default-avatars\/alan-[^"]+\.(?:png|jpg))"/g)].map(match => match[1]);

test("frontend and backend allowlists expose the same 25 preset avatars", () => {
    const frontendPaths = avatarPaths(frontend);
    const gamificationPaths = avatarPaths(gamificationEdge);
    const socialPaths = avatarPaths(socialEdge);

    assert.equal(frontendPaths.length, 25);
    assert.deepEqual(gamificationPaths, frontendPaths);
    assert.deepEqual(socialPaths, frontendPaths);
});

test("every preset avatar has a bundled public asset", () => {
    for (const avatarPath of avatarPaths(frontend)) {
        const assetUrl = new URL(`../public${avatarPath}`, import.meta.url);
        assert.equal(existsSync(assetUrl), true, `${avatarPath} is missing`);
    }
});

test("friendship notifications carry an allowlisted friends-page destination", () => {
    assert.match(socialEdge, /notification_type: "social"/);
    assert.match(socialEdge, /target_path: "\/student\/friends"/);
});

test("profile and leaderboard styles keep the requested responsive breakpoints", () => {
    assert.match(settingsCss, /\.student-settings-avatar-wrap \{[^}]*width: 200px;[^}]*height: 200px;/);
    assert.match(settingsCss, /@media \(max-width: 720px\)[\s\S]*\.student-settings-avatar-wrap,[\s\S]*width: 150px; height: 150px;/);
    assert.match(settingsCss, /@media \(max-width: 420px\)[\s\S]*\.student-settings-profile-card \{ grid-template-columns: 1fr;/);
    assert.match(gamificationCss, /@media \(max-width: 520px\)[\s\S]*\.gamification-ranking-row[\s\S]*grid-template-columns: 32px 44px minmax\(0, 1fr\)/);
    assert.match(gamificationCss, /@media \(max-width: 360px\)/);
});
