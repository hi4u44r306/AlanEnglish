import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TeacherAssignments from "./TeacherAssignments";
import { createAssignment, createAssignmentV2, getTeacherAssignmentBootstrap, getTeacherAssignments } from "../../services/assignmentService";
import { clearTeacherAssignmentDraft, readTeacherAssignmentDraft, saveTeacherAssignmentDraft } from "../../services/teacherAssignmentDraft";

let mockUser = { uid: "teacher-a" };
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockUser }) }));
jest.mock("../../services/assignmentService", () => ({ createAssignment: jest.fn(), createAssignmentV2: jest.fn(),
    getTeacherAssignmentBootstrap: jest.fn(), getTeacherAssignments: jest.fn(), deleteAssignment: jest.fn(),
    getAssignmentResults: jest.fn(), previewAssignmentV2: jest.fn(), upsertPageLearningContent: jest.fn() }));
const book = { id: 1, name: "Workbook 1" };
const bootstrap = { classes: ["E1"], class_materials: [{ class_code: "E1", books: [book] }],
    tracks: [{ id: 11, book_id: 1, book, page: "P22" }], page_content: [{ id: 3, book_id: 1, page_label: "P22", status: "published", pronunciation_prompts: ["Hello."] }], ai_materials: [{ id: 4, title: "Quiz" }] };
const legacy = { id: 8, title: "上週聽力", target_class: "E1", description: "原說明", source_type: "music_track", assigned_date: "2020-01-01",
    copy_template: { source_type: "music_track", track_ids: [11], required_listens: 7 } };
beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear(); clearTeacherAssignmentDraft(); mockUser = { uid: "teacher-a" };
    jest.spyOn(window, "confirm").mockReturnValue(true);
    getTeacherAssignmentBootstrap.mockResolvedValue(bootstrap);
    getTeacherAssignments.mockResolvedValue({ assignments: [legacy] });
    createAssignment.mockResolvedValue({ success: true }); createAssignmentV2.mockResolvedValue({ success: true });
});
afterEach(() => jest.restoreAllMocks());
const openCreate = () => fireEvent.click(screen.getByRole("tab", { name: /建立作業/ }));
const next = () => fireEvent.click(screen.getByRole("button", { name: "下一步" }));
const ready = async () => waitFor(() => expect(screen.getByRole("button", { name: "複製作業" })).toBeEnabled());

test("copy is a draft, keeps listens, resets dates, survives failure and clears after success", async () => {
    createAssignment.mockRejectedValueOnce(new Error("連線失敗"));
    render(<TeacherAssignments />); await ready();
    fireEvent.click(screen.getByRole("button", { name: "複製作業" }));
    expect(screen.getByLabelText("作業名稱")).toHaveValue("上週聽力（副本）");
    expect(screen.getByLabelText("發布日期").value).not.toBe("2020-01-01");
    expect(createAssignment).not.toHaveBeenCalled();
    next(); next();
    fireEvent.click(screen.getByRole("button", { name: "發布作業" }));
    await screen.findByText("連線失敗");
    expect(readTeacherAssignmentDraft(mockUser.uid).draft.trackIds).toEqual([11]);
    expect(createAssignment.mock.calls[0][1]).toMatchObject({ target_class: "E1", track_ids: [11], required_listens: 7 });
    fireEvent.click(screen.getByRole("button", { name: "發布作業" }));
    await screen.findByText("聽力作業已發布，共 1 個音檔。");
    expect(readTeacherAssignmentDraft(mockUser.uid)).toBeNull();
});
test("mixed copy preserves all activities and non-default completion settings", async () => {
    const items = [
        { item_type: "listening", book_id: 1, track_ids: [11], required_listens: 7 },
        { item_type: "ai_quiz", book_id: 1, page_content_ids: [3], ai_material_id: 4, passing_score: 95 },
        { item_type: "pronunciation", book_id: 1, page_content_ids: [3], prompt_keys: ["3:Hello."], completion_mode: "target_score", target_score: 90, max_scored_attempts: 5 }
    ];
    getTeacherAssignments.mockResolvedValue({ assignments: [{ ...legacy, source_type: "multi_activity_v2", copy_template: { source_type: "multi_activity_v2", items } }] });
    render(<TeacherAssignments />); await ready(); fireEvent.click(screen.getByRole("button", { name: "複製作業" }));
    next();
    fireEvent.change(screen.getByLabelText("活動 2 達標分數"), { target: { value: "85" } });
    next();
    fireEvent.click(screen.getByRole("button", { name: "確認發布混合作業" }));
    await waitFor(() => expect(createAssignmentV2).toHaveBeenCalledTimes(1));
    expect(createAssignmentV2.mock.calls[0][1].items).toMatchObject([items[0], { ...items[1], passing_score: 85 }, items[2]]);
    expect(createAssignment).not.toHaveBeenCalled();
});
test("leaving and remounting offers restoration without silently changing draft dates", async () => {
    const first = render(<TeacherAssignments />); await ready(); openCreate();
    fireEvent.change(screen.getByLabelText("作業名稱"), { target: { value: "未完成內容" } });
    fireEvent.change(screen.getByLabelText("發布日期"), { target: { value: "2026-01-01" } });
    first.unmount(); render(<TeacherAssignments />); openCreate();
    await waitFor(() => expect(screen.getByRole("button", { name: "恢復草稿" })).toBeEnabled());
    expect(screen.getByLabelText("作業名稱")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "恢復草稿" }));
    expect(screen.getByLabelText("作業名稱")).toHaveValue("未完成內容");
    expect(screen.getByLabelText("發布日期")).toHaveValue("2026-01-01");
    expect(createAssignment).not.toHaveBeenCalled();
});
test("account change remounts editor and does not expose another teacher's draft", async () => {
    const view = render(<TeacherAssignments />); await ready(); openCreate();
    fireEvent.change(screen.getByLabelText("作業名稱"), { target: { value: "A 的草稿" } });
    mockUser = { uid: "teacher-b" }; view.rerender(<TeacherAssignments />); await ready();
    expect(screen.getByLabelText("作業名稱")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "恢復草稿" })).not.toBeInTheDocument();
});
test("unavailable copied source blocks publishing instead of silently dropping an activity", async () => {
    getTeacherAssignments.mockResolvedValue({ assignments: [{ ...legacy, source_type: "multi_activity_v2", copy_template: { source_type: "multi_activity_v2",
        items: [{ item_type: "listening", book_id: 9, track_ids: [999], required_listens: 3 }] } }] });
    render(<TeacherAssignments />); await ready(); fireEvent.click(screen.getByRole("button", { name: "複製作業" }));
    next();
    expect(screen.getByText(/教材不在本班目前教材中/)).toBeInTheDocument(); next();
    fireEvent.click(screen.getByRole("button", { name: "確認發布混合作業" }));
    expect(createAssignmentV2).not.toHaveBeenCalled();
});
test("discard requires an explicit action and removes the local draft only", async () => {
    saveTeacherAssignmentDraft(mockUser.uid, { form: { title: "draft", target_class: "E1" } });
    render(<TeacherAssignments />); openCreate();
    await waitFor(() => expect(screen.getByRole("button", { name: "恢復草稿" })).toBeEnabled());
    window.confirm.mockReturnValueOnce(false); fireEvent.click(screen.getByRole("button", { name: "捨棄草稿" }));
    expect(readTeacherAssignmentDraft(mockUser.uid)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "捨棄草稿" }));
    expect(readTeacherAssignmentDraft(mockUser.uid)).toBeNull();
    expect(screen.getByLabelText("作業名稱")).toHaveValue("");
});

test("list first, validates steps, keeps draft when switching workspaces, does not publish on Next", async () => {
    render(<TeacherAssignments />); await ready();
    expect(screen.getByRole("tab", { name: "已發布作業" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("textbox", { name: "作業名稱" })).not.toBeInTheDocument();
    openCreate(); next(); expect(screen.getByText(/請先填寫作業名稱/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("作業名稱"), { target: { value: "本週練習" } });
    fireEvent.change(screen.getByLabelText("發布班級"), { target: { value: "E1" } });
    next(); next(); expect(screen.getByText("請至少選擇一個教材活動。")).toBeInTheDocument();
    expect(createAssignment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "已發布作業" })); openCreate();
    expect(screen.getByLabelText("作業名稱")).toHaveValue("本週練習");
});
