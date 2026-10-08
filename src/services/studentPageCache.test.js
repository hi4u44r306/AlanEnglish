import { clearStudentPageCache, fetchStudentPageCache, invalidateStudentPageCache, readStudentPageCache, sanitizeStudentSnapshot, studentPageScope } from "./studentPageCache";

const scope = "learner-a|student|1";
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
beforeEach(() => { clearStudentPageCache(); localStorage.clear(); });
afterEach(() => jest.restoreAllMocks());

test("coalesces simultaneous requests and reuses a fresh response when returning to a page", async () => {
    const pending = deferred();
    const loader = jest.fn(() => pending.promise);
    const first = fetchStudentPageCache(scope, "catalog", loader);
    const second = fetchStudentPageCache(scope, "catalog", loader);
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);
    pending.resolve({ categories: [{ name: "Workbook" }] });
    await Promise.all([first, second]);
    await fetchStudentPageCache(scope, "catalog", loader);
    expect(loader).toHaveBeenCalledTimes(1);
});

test("restores display data from disk but always revalidates it after a browser reload", async () => {
    await fetchStudentPageCache(scope, "catalog", () => ({ categories: [{ name: "Old" }] }));
    const id = Object.keys(localStorage)[0];
    const raw = localStorage.getItem(id);
    clearStudentPageCache();
    localStorage.setItem(id, raw);
    expect(readStudentPageCache(scope, "catalog").value.categories[0].name).toBe("Old");
    expect(readStudentPageCache(scope, "catalog").validated).toBe(false);
    const loader = jest.fn(() => ({ categories: [{ name: "New" }] }));
    await fetchStudentPageCache(scope, "catalog", loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(readStudentPageCache(scope, "catalog").value.categories[0].name).toBe("New");
});

test("account, role and membership context changes cannot read a different snapshot", async () => {
    const owner = studentPageScope({ uid: "a" }, "student", { class: "E1" });
    await fetchStudentPageCache(owner, "assignments:v1", () => ({ assignments: [{ id: 1 }] }));
    for (const other of [studentPageScope({ uid: "b" }, "student", { class: "E1" }), studentPageScope({ uid: "a" }, "teacher", { class: "E1" }), studentPageScope({ uid: "a" }, "student", { class: "E3" })]) {
        expect(readStudentPageCache(other, "assignments:v1")).toBeNull();
    }
});

test("logout blocks an in-flight response from recreating local data", async () => {
    const pending = deferred();
    const request = fetchStudentPageCache(scope, "catalog", () => pending.promise);
    clearStudentPageCache("learner-a");
    pending.resolve({ categories: [{ name: "Private" }] });
    await request;
    expect(readStudentPageCache(scope, "catalog")).toBeNull();
    expect(Object.keys(localStorage)).toHaveLength(0);
});

test("a successful write invalidates off-page progress and rejects an older response", async () => {
    await fetchStudentPageCache(scope, "progress:1", () => ({ progress: [1] }));
    const pending = deferred();
    const oldRequest = fetchStudentPageCache(scope, "progress:1", () => pending.promise, { force: true });
    invalidateStudentPageCache("learner-a");
    expect(readStudentPageCache(scope, "progress:1").stale).toBe(true);
    expect(Object.keys(localStorage)).toHaveLength(0);
    await fetchStudentPageCache(scope, "progress:1", () => ({ progress: [3] }));
    pending.resolve({ progress: [2] });
    await oldRequest;
    expect(readStudentPageCache(scope, "progress:1").value.progress).toEqual([3]);
});

test("temporary network failure retains the display snapshot, authorization denial removes it", async () => {
    await fetchStudentPageCache(scope, "catalog", () => ({ categories: [1] }));
    await expect(fetchStudentPageCache(scope, "catalog", () => Promise.reject(new Error("offline")), { force: true })).rejects.toThrow("offline");
    expect(readStudentPageCache(scope, "catalog").value.categories).toEqual([1]);
    await expect(fetchStudentPageCache(scope, "catalog", () => Promise.reject(Object.assign(new Error("denied"), { status: 403 })), { force: true })).rejects.toThrow("denied");
    expect(readStudentPageCache(scope, "catalog")).toBeNull();
});

test("expired snapshots are discarded and persistence never includes private authorization data", async () => {
    const value = { book: { name: "Workbook" }, audio_url: "signed", challenge_session_id: "live", guardian: { email: "private" }, family_message: "private", nested: { image_url: "https://assets/test?X-Amz-Signature=private", token: "private" } };
    expect(sanitizeStudentSnapshot(value)).toEqual({ book: { name: "Workbook" }, nested: {} });
    await fetchStudentPageCache(scope, "book:1", () => value);
    const raw = localStorage.getItem(Object.keys(localStorage)[0]);
    expect(raw).not.toMatch(/private|signed|challenge_session/);
    const future = Date.now() + 25 * 3600000;
    jest.spyOn(Date, "now").mockReturnValue(future);
    expect(readStudentPageCache(scope, "book:1")).toBeNull();
});

test("storage quota failures and oversized data leave the memory cache usable", async () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    await expect(fetchStudentPageCache(scope, "catalog", () => ({ categories: [1] }))).resolves.toEqual({ categories: [1] });
    expect(readStudentPageCache(scope, "catalog").value.categories).toEqual([1]);
});

test("bounded persistence evicts old pages without touching other localStorage keys", async () => {
    localStorage.setItem("other-app", "keep");
    for (let index = 0; index < 30; index += 1) {
        await fetchStudentPageCache(scope, `book:${index}`, () => ({ book: { id: index } }));
    }
    expect(Object.keys(localStorage).filter(key => key.startsWith("ae-student-pages-v1:")).length).toBeLessThanOrEqual(24);
    expect(localStorage.getItem("other-app")).toBe("keep");
});
