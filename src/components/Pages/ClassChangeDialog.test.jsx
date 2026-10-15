import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClassChangeDialog, { getClassChangeDirection } from "./ClassChangeDialog";

const student = { id: 7, chinese_name: "王小明", name: "wang", class: "E3" };

describe("getClassChangeDirection", () => {
    it("knows promote, demote and no change", () => {
        expect(getClassChangeDirection("E1", "E3")).toBe("promote");
        expect(getClassChangeDirection("E5", "E1")).toBe("demote");
        expect(getClassChangeDirection("E3", "E3")).toBeNull();
        expect(getClassChangeDirection("E3", "E2")).toBeNull();
    });
});

describe("ClassChangeDialog", () => {
    it("lists the three other classes, each tagged 升班 or 降班", () => {
        render(<ClassChangeDialog student={student} enrolledAt="2026-01-01" onClose={jest.fn()} onSubmit={jest.fn()} />);

        expect(screen.getByRole("dialog", { name: /調整班級：王小明/ })).toBeInTheDocument();
        expect(screen.queryByRole("radio", { name: /E3/ })).not.toBeInTheDocument();
        expect(screen.getByRole("radio", { name: /E1.*降班/ })).toBeInTheDocument();
        expect(screen.getByRole("radio", { name: /E5.*升班/ })).toBeInTheDocument();
        expect(screen.getByRole("radio", { name: /E7.*升班/ })).toBeInTheDocument();
    });

    it("stays disabled until a class and a reason are chosen, then submits a demotion", async () => {
        const onSubmit = jest.fn().mockResolvedValue();
        render(<ClassChangeDialog student={student} enrolledAt="2026-01-01" onClose={jest.fn()} onSubmit={onSubmit} />);

        const submit = screen.getByRole("button", { name: "請先選擇班級" });
        expect(submit).toBeDisabled();

        fireEvent.click(screen.getByRole("radio", { name: /E1/ }));
        expect(screen.getByRole("button", { name: "確認降班到 E1" })).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText(/升班後程度/), { target: { value: "程度跟不上，先回原班" } });
        const confirm = screen.getByRole("button", { name: "確認降班到 E1" });
        expect(confirm).toBeEnabled();
        fireEvent.click(confirm);

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ classCode: "E1", reason: "程度跟不上，先回原班" }));
        expect(onSubmit.mock.calls[0][0].effectiveOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("labels a promotion as 升班", () => {
        render(<ClassChangeDialog student={student} onClose={jest.fn()} onSubmit={jest.fn()} />);
        fireEvent.click(screen.getByRole("radio", { name: /E5/ }));
        expect(screen.getByRole("button", { name: "確認升班到 E5" })).toBeInTheDocument();
    });

    it("blocks future dates and dates before the student joined the class", () => {
        render(<ClassChangeDialog student={student} enrolledAt="2026-01-01" onClose={jest.fn()} onSubmit={jest.fn()} />);
        fireEvent.click(screen.getByRole("radio", { name: /E1/ }));
        fireEvent.change(screen.getByPlaceholderText(/升班後程度/), { target: { value: "回原班" } });
        const date = screen.getByLabelText("生效日期");

        fireEvent.change(date, { target: { value: "2999-01-01" } });
        expect(screen.getByRole("alert")).toHaveTextContent("只能選今天或過去");
        expect(screen.getByRole("button", { name: "確認降班到 E1" })).toBeDisabled();

        fireEvent.change(date, { target: { value: "2025-12-31" } });
        expect(screen.getByRole("alert")).toHaveTextContent("不能早於進入目前班級的日期（2026-01-01）");
    });

    it("shows the server's message when the change fails and lets the admin try again", async () => {
        const onSubmit = jest.fn().mockRejectedValue(new Error("這位學生目前是暫停狀態，請先恢復再調整班級"));
        render(<ClassChangeDialog student={student} enrolledAt="2026-01-01" onClose={jest.fn()} onSubmit={onSubmit} />);
        fireEvent.click(screen.getByRole("radio", { name: /E1/ }));
        fireEvent.change(screen.getByPlaceholderText(/升班後程度/), { target: { value: "回原班" } });
        fireEvent.click(screen.getByRole("button", { name: "確認降班到 E1" }));

        expect(await screen.findByText("這位學生目前是暫停狀態，請先恢復再調整班級")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "確認降班到 E1" })).toBeEnabled();
    });

    it("closes with Escape and with the close button", () => {
        const onClose = jest.fn();
        render(<ClassChangeDialog student={student} onClose={onClose} onSubmit={jest.fn()} />);
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        fireEvent.click(screen.getByRole("button", { name: "關閉" }));
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
