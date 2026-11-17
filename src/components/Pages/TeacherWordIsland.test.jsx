import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "../../auth/AuthContext";
import * as service from "../../services/wordIslandReportService";
import TeacherWordIsland from "./TeacherWordIsland";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/wordIslandReportService", () => ({
    getWordIslandReportBootstrap: jest.fn(),
    getWordIslandClassOverview: jest.fn()
}));

const level = (n, claimed) => ({ level: n, claimed, upgraded: 1, islands_total: 5, islands_full: 0, current_island: 1, current_claimed: claimed, current_total: 16, review_islands: 0 });
const student = (id, name, extra = {}) => ({
    student_id: id, name, recorded_to_account: true, claimed_total: 5, upgraded_total: 2, review_total: 0,
    last_practiced_at: "2026-11-17T04:00:00.000Z", inactive_days: 1, status_code: "normal",
    current: { level: 1, island: 1, claimed: 5, total: 16, all_done: false }, per_level: [level(1, 5)], ...extra
});
const overview = (code = "E1") => ({
    class_code: code, generated_at: "2026-11-18T04:00:00.000Z",
    totals: { students: 4, recorded: 3, never_played: 1, inactive_7_days: 1 },
    students: [
        student(1, "王小明"),
        student(2, "林小華", { claimed_total: 0, upgraded_total: 0, status_code: "never", inactive_days: null, last_practiced_at: null, current: null, per_level: [] }),
        student(3, "陳小美", { status_code: "warning", inactive_days: 9, review_total: 3 }),
        student(4, "張小強", { recorded_to_account: false, status_code: "never", claimed_total: 0, current: null, per_level: [], inactive_days: null })
    ]
});

beforeEach(() => {
    service.getWordIslandReportBootstrap.mockReset();
    service.getWordIslandClassOverview.mockReset();
    useAuth.mockReturnValue({ firebaseUser: { uid: "teacher-1" } });
});

test("a teacher with one class sees that class straight away, with the numbers and student cards", async () => {
    service.getWordIslandReportBootstrap.mockResolvedValue({ classes: ["E1"] });
    service.getWordIslandClassOverview.mockResolvedValue(overview());
    render(<TeacherWordIsland />);
    await screen.findByText("王小明");
    expect(service.getWordIslandClassOverview).toHaveBeenCalledWith({ uid: "teacher-1" }, "E1");
    expect(screen.queryByRole("group", { name: "選擇班級" })).not.toBeInTheDocument();
    const stats = screen.getByRole("list", { name: "班級統計" });
    expect(stats).toHaveTextContent("4班上人數");
    expect(stats).toHaveTextContent("1還沒玩過");
    expect(screen.getAllByText("目前：一年級・第 1 座島 5/16").length).toBeGreaterThan(0);
    expect(screen.getByText("一週沒玩")).toBeInTheDocument();
    expect(screen.getByText("9 天前")).toBeInTheDocument();
});

test("students whose progress is not saved to the account are labelled as such, not as not-playing", async () => {
    service.getWordIslandReportBootstrap.mockResolvedValue({ classes: ["E1"] });
    service.getWordIslandClassOverview.mockResolvedValue(overview());
    render(<TeacherWordIsland />);
    await screen.findByText("張小強");
    expect(screen.getByText("進度沒存到帳號")).toBeInTheDocument();
    expect(screen.getByText(/老師看不到，不代表他沒有玩/)).toBeInTheDocument();
    // 「還沒玩」篩選只看有存到帳號的學生，所以不包含張小強。
    fireEvent.click(screen.getByRole("button", { name: "還沒玩" }));
    expect(screen.getByText("林小華")).toBeInTheDocument();
    expect(screen.queryByText("張小強")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "沒存到帳號" }));
    expect(screen.getByText("張小強")).toBeInTheDocument();
    expect(screen.queryByText("林小華")).not.toBeInTheDocument();
});

test("filters and sorting work", async () => {
    service.getWordIslandReportBootstrap.mockResolvedValue({ classes: ["E1"] });
    service.getWordIslandClassOverview.mockResolvedValue(overview());
    render(<TeacherWordIsland />);
    await screen.findByText("王小明");
    fireEvent.click(screen.getByRole("button", { name: "7 天以上沒玩" }));
    expect(screen.getByText("陳小美")).toBeInTheDocument();
    expect(screen.queryByText("王小明")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "有待複習" }));
    expect(screen.getByText("陳小美")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "全部" }));
    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "idle" } });
    const names = [...document.querySelectorAll(".twi-student__head strong")].map(node => node.textContent);
    expect(names[0]).toBe("陳小美");
});

test("a teacher with several classes picks one; switching loads that class", async () => {
    service.getWordIslandReportBootstrap.mockResolvedValue({ classes: ["E1", "E3"] });
    service.getWordIslandClassOverview.mockImplementation(async (_user, code) => overview(code));
    render(<TeacherWordIsland />);
    await screen.findByText("王小明");
    expect(screen.getByRole("button", { name: "E1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "E3" }));
    await waitFor(() => expect(service.getWordIslandClassOverview).toHaveBeenLastCalledWith({ uid: "teacher-1" }, "E3"));
});

test("no permitted class gives a plain message; a server error is shown and nothing breaks", async () => {
    service.getWordIslandReportBootstrap.mockResolvedValue({ classes: [] });
    const { unmount } = render(<TeacherWordIsland />);
    await screen.findByText(/目前沒有可以查看的班級/);
    expect(service.getWordIslandClassOverview).not.toHaveBeenCalled();
    unmount();

    service.getWordIslandReportBootstrap.mockResolvedValue({ classes: ["E1"] });
    service.getWordIslandClassOverview.mockRejectedValue(new Error("你沒有這個班級的權限"));
    render(<TeacherWordIsland />);
    expect(await screen.findByRole("alert")).toHaveTextContent("你沒有這個班級的權限");
});
