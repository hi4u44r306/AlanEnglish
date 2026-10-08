import { act, renderHook, waitFor } from "@testing-library/react";
import useStudentPageQuery from "./useStudentPageQuery";
import { useAuth } from "../auth/AuthContext";
import { clearStudentPageCache, fetchStudentPageCache, invalidateStudentPageCache, studentPageScope } from "../services/studentPageCache";

jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));
const auth = { firebaseUser: { uid: "cache-student" }, role: "student", studentProfile: { class: "E1" } };
beforeEach(() => { clearStudentPageCache(); localStorage.clear(); useAuth.mockReturnValue(auth); });

test("returning to a page renders cached data immediately with no duplicate API call", async () => {
    const loader = jest.fn().mockResolvedValue({ title: "Workbook" });
    const first = renderHook(() => useStudentPageQuery("catalog", loader));
    await waitFor(() => expect(first.result.current.data?.title).toBe("Workbook"));
    first.unmount();
    const second = renderHook(() => useStudentPageQuery("catalog", loader));
    expect(second.result.current.data.title).toBe("Workbook");
    expect(second.result.current.loading).toBe(false);
    await act(async () => {});
    expect(loader).toHaveBeenCalledTimes(1);
});

test("reload displays persisted data while waiting for a fresh response", async () => {
    const scope = studentPageScope(auth.firebaseUser, auth.role, auth.studentProfile);
    await fetchStudentPageCache(scope, "catalog", () => ({ title: "Old" }));
    const id = Object.keys(localStorage)[0];
    const raw = localStorage.getItem(id);
    clearStudentPageCache();
    localStorage.setItem(id, raw);
    let finish;
    const loader = jest.fn(() => new Promise(resolve => { finish = resolve; }));
    const query = renderHook(() => useStudentPageQuery("catalog", loader));
    expect(query.result.current.data.title).toBe("Old");
    expect(query.result.current.loading).toBe(false);
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    await act(async () => finish({ title: "New" }));
    expect(query.result.current.data.title).toBe("New");
});

test("background failure preserves data; successful invalidation refreshes mounted pages", async () => {
    const loader = jest.fn().mockResolvedValue({ count: 1 });
    const query = renderHook(() => useStudentPageQuery("summary", loader));
    await waitFor(() => expect(query.result.current.data?.count).toBe(1));
    loader.mockRejectedValueOnce(new Error("offline"));
    await act(async () => query.result.current.refresh());
    expect(query.result.current.data.count).toBe(1);
    expect(query.result.current.error.message).toBe("offline");
    loader.mockResolvedValue({ count: 2 });
    act(() => invalidateStudentPageCache("cache-student"));
    await waitFor(() => expect(query.result.current.data.count).toBe(2));
});

test("account changes immediately hide old data and stale pending responses", async () => {
    let finishOld;
    const loader = jest.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue({ title: "New learner" });
    const query = renderHook(() => useStudentPageQuery("catalog", loader));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    useAuth.mockReturnValue({ ...auth, firebaseUser: { uid: "another-student" } });
    query.rerender();
    expect(query.result.current.data).toBeNull();
    await waitFor(() => expect(query.result.current.data?.title).toBe("New learner"));
    await act(async () => finishOld({ title: "Old learner" }));
    expect(query.result.current.data.title).toBe("New learner");
});

test("an invalidated pending request cannot overwrite the newer refresh error state", async () => {
    let rejectOld;
    const loader = jest.fn().mockImplementationOnce(() => new Promise((resolve, reject) => { rejectOld = reject; })).mockResolvedValue({ count: 2 });
    const query = renderHook(() => useStudentPageQuery("summary", loader));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    act(() => invalidateStudentPageCache("cache-student"));
    await waitFor(() => expect(query.result.current.data?.count).toBe(2));
    await act(async () => rejectOld(new Error("old failure")));
    expect(query.result.current.error).toBeNull();
});

test("two consumers share one pending request and teacher reports never persist", async () => {
    useAuth.mockReturnValue({ ...auth, role: "teacher" });
    const loader = jest.fn().mockResolvedValue({ report: { guardian: { email: "private" } } });
    const view = renderHook(() => [useStudentPageQuery("weekly:1:7", loader), useStudentPageQuery("weekly:1:7", loader)]);
    await waitFor(() => expect(view.result.current[0].data).toBeTruthy());
    expect(loader).toHaveBeenCalledTimes(1);
    expect(Object.keys(localStorage)).toHaveLength(0);
});
