import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/web-push-sw.js", import.meta.url), "utf8");

const loadWorker = () => {
    const handlers = {};
    const shown = [];
    const opened = [];
    const worker = {
        location: { origin: "https://alanenglish.com.tw" },
        registration: { showNotification: async (...args) => { shown.push(args); } },
        clients: {
            matchAll: async () => [],
            openWindow: async url => { opened.push(url); }
        },
        addEventListener: (type, handler) => { handlers[type] = handler; }
    };
    vm.runInNewContext(source, { self: worker, URL, Number });
    return { handlers, shown, opened };
};

test("push worker only opens approved same-origin destinations", async () => {
    const { handlers, shown, opened } = loadWorker();
    assert.equal(handlers.fetch, undefined);
    let work;
    handlers.push({ data: { json: () => ({
        title: "有新的班級作業", path: "https://evil.example/steal", notification_id: 9
    }) }, waitUntil: promise => { work = promise; } });
    await work;
    assert.equal(shown[0][1].data.path, "/student/notifications");
    handlers.notificationclick({
        notification: { data: shown[0][1].data, close: () => {} },
        waitUntil: promise => { work = promise; }
    });
    await work;
    assert.deepEqual(opened, ["https://alanenglish.com.tw/student/notifications"]);
});

test("push worker accepts the approved assignment destination", async () => {
    const { handlers, shown } = loadWorker();
    let work;
    handlers.push({ data: { json: () => ({ path: "/student/assignments" }) }, waitUntil: promise => { work = promise; } });
    await work;
    assert.equal(shown[0][1].data.path, "/student/assignments");
});
