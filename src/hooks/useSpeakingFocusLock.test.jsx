import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import useSpeakingFocusLock, { SPEAKING_FOCUS_KEY } from "./useSpeakingFocusLock";

const PREP = "/student/books/WB3?speaking=11&mode=easy&tracks=5";
let navigateRef;
const Probe = ({ auth }) => {
    useSpeakingFocusLock(auth);
    const location = useLocation();
    navigateRef = useNavigate();
    return <output data-testid="where" data-blocked={String(Boolean(location.state?.speakingFocusBlocked))}>{location.pathname}{location.search}</output>;
};
const renderAt = (path, auth = { uid: "s1", role: "student", authLoading: false }) => render(
    <MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<Probe auth={auth} />} /></Routes></MemoryRouter>
);
const where = () => screen.getByTestId("where").textContent;

beforeEach(() => sessionStorage.clear());

test("學生在聽力頁時改網址到其他頁面會被帶回聽力頁", () => {
    const onLeave = jest.fn();
    renderAt(PREP, { uid: "s1", role: "student", authLoading: false, onLeaveBlocked: onLeave });
    expect(JSON.parse(sessionStorage.getItem(SPEAKING_FOCUS_KEY)).returnPath).toBe("/student/speaking-challenges/11?mode=easy");
    act(() => navigateRef("/student/books"));
    expect(where()).toBe(PREP);
    expect(onLeave).toHaveBeenCalledWith(expect.objectContaining({ returnPath: "/student/speaking-challenges/11?mode=easy" }));
    expect(screen.getByTestId("where")).toHaveAttribute("data-blocked", "true");
});

test("重新整理到其他網址（同一個分頁）也會被帶回聽力頁", () => {
    renderAt(PREP);
    renderAt("/student/progress");
    expect(screen.getAllByTestId("where")[1].textContent).toBe(PREP);
});

test("回到原口說關卡後解除鎖定，之後可以自由切換頁面", () => {
    renderAt(PREP);
    act(() => navigateRef("/student/speaking-challenges/11?mode=easy"));
    expect(where()).toBe("/student/speaking-challenges/11?mode=easy");
    expect(sessionStorage.getItem(SPEAKING_FOCUS_KEY)).toBeNull();
    act(() => navigateRef("/student/progress"));
    expect(where()).toBe("/student/progress");
});

test("超過 30 分鐘、換帳號或老師與管理員都不鎖", () => {
    sessionStorage.setItem(SPEAKING_FOCUS_KEY, JSON.stringify({ uid: "s1", prepPath: PREP, returnPath: "/student/speaking-challenges/11?mode=easy", expiresAt: Date.now() - 1 }));
    renderAt("/student/progress");
    expect(where()).toBe("/student/progress");
    renderAt(PREP, { uid: "t1", role: "teacher", authLoading: false });
    expect(sessionStorage.getItem(SPEAKING_FOCUS_KEY)).toBeNull();
    sessionStorage.setItem(SPEAKING_FOCUS_KEY, JSON.stringify({ uid: "other", prepPath: PREP, returnPath: "/student/speaking-challenges/11?mode=easy", expiresAt: Date.now() + 60000 }));
    renderAt("/student/progress");
    expect(screen.getAllByTestId("where").at(-1).textContent).toBe("/student/progress");
});

test("登入狀態確認前不清除也不跳轉", () => {
    renderAt(PREP);
    renderAt("/student/progress", { uid: null, role: null, authLoading: true });
    expect(screen.getAllByTestId("where")[1].textContent).toBe("/student/progress");
    expect(sessionStorage.getItem(SPEAKING_FOCUS_KEY)).not.toBeNull();
});
