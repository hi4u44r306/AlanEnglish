import { clearStaffPageCache, fetchStaffPageCache, readStaffPageCache, updateStaffPageCache, writeStaffView, readStaffView } from "./staffPageCache";
const scope = "admin-a|admin|123";
beforeEach(() => clearStaffPageCache());
afterEach(() => jest.restoreAllMocks());
test("deduplicates pending reads and reuses a fresh snapshot without writing browser storage", async () => {
    const storage = jest.spyOn(Storage.prototype, "setItem"); let finish;
    const loader = jest.fn(() => new Promise(resolve => { finish = resolve; }));
    const first = fetchStaffPageCache(scope, "accounts", loader); const second = fetchStaffPageCache(scope, "accounts", loader);
    expect(first).toBe(second); await Promise.resolve(); finish({ accounts: [{ id: 1, name: "Demo" }] });
    await first; await fetchStaffPageCache(scope, "accounts", loader); expect(loader).toHaveBeenCalledTimes(1); expect(storage).not.toHaveBeenCalled();
});
test("expired freshness revalidates and a transient failure keeps the last list", async () => {
    let clock = 1000; jest.spyOn(Date, "now").mockImplementation(() => clock);
    await fetchStaffPageCache(scope, "accounts", () => ({ accounts: [1] })); clock += 31000;
    await expect(fetchStaffPageCache(scope, "accounts", () => Promise.reject(new TypeError("offline")))).rejects.toThrow("offline");
    expect(readStaffPageCache(scope, "accounts").value.accounts).toEqual([1]); clock += 5 * 60 * 1000;
    expect(readStaffPageCache(scope, "accounts")).toBeNull();
});
test.each([401, 403, 404])("status %s removes the list and its navigation preferences", async status => {
    await fetchStaffPageCache(scope, "accounts", () => ({ accounts: [1] })); writeStaffView(scope, "accounts", { searchText: "Demo" });
    await expect(fetchStaffPageCache(scope, "accounts", () => Promise.reject(Object.assign(new Error("blocked"), { status })), { force: true })).rejects.toThrow();
    expect(readStaffPageCache(scope, "accounts")).toBeNull(); expect(readStaffView(scope, "accounts")).toBeNull();
});
test("logout cannot be undone by a late request and another UID/role cannot read its view", async () => {
    let finish; const pending = fetchStaffPageCache(scope, "accounts", () => new Promise(resolve => { finish = resolve; })); await Promise.resolve();
    writeStaffView(scope, "accounts", { page: 2 }); expect(readStaffView("admin-a|teacher|123", "accounts")).toBeNull();
    clearStaffPageCache("admin-a"); finish({ accounts: [1] }); await pending;
    expect(readStaffPageCache(scope, "accounts")).toBeNull(); expect(readStaffView(scope, "accounts")).toBeNull();
});
test("a confirmed update cannot be overwritten by an older read and the next visit revalidates", async () => {
    await fetchStaffPageCache(scope, "accounts", () => ({ accounts: [{ id: 1, name: "Old" }] }));
    let finish; const pending = fetchStaffPageCache(scope, "accounts", () => new Promise(resolve => { finish = resolve; }), { force: true }); await Promise.resolve();
    updateStaffPageCache(scope, "accounts", value => ({ ...value, accounts: [{ id: 1, name: "New" }] })); finish({ accounts: [{ id: 1, name: "Old" }] }); await pending;
    expect(readStaffPageCache(scope, "accounts").value.accounts[0].name).toBe("New");
    const loader = jest.fn(() => ({ accounts: [{ id: 1, name: "Confirmed" }] })); await fetchStaffPageCache(scope, "accounts", loader); expect(loader).toHaveBeenCalledTimes(1);
});
test("only display fields enter the memory cache; login credentials and signed URLs are excluded", async () => {
    await fetchStaffPageCache(scope, "accounts", () => ({ accounts: [{ id: 1, must_change_password: true, token: "private", password: "private", credentials: { recovery_codes: ["private"] }, audio_url: "https://example.com/a?X-Amz-Signature=private" }] }));
    expect(readStaffPageCache(scope, "accounts").value).toEqual({ accounts: [{ id: 1, must_change_password: true }] });
});
