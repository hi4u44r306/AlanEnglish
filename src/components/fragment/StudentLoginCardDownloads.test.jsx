import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StudentLoginCardDownloads from "./StudentLoginCardDownloads";
import { downloadAcademyStudentLoginCardsDocx } from "../../utils/academyStudentLoginCardsDocx";
import { downloadAcademyStudentLoginCardsPdf } from "../../utils/academyStudentLoginCardsPdf";

jest.mock("../../utils/academyStudentLoginCardsDocx", () => ({ downloadAcademyStudentLoginCardsDocx: jest.fn() }));
jest.mock("../../utils/academyStudentLoginCardsPdf", () => ({ downloadAcademyStudentLoginCardsPdf: jest.fn() }));

const credentials = {
    username: "luciahuang",
    temporary_password: "Ae-K7M2-P9RX",
    activation_url: "https://alanenglish.com.tw/academy/student-setup?token=one-time",
    recovery_codes: ["997800", "976145"]
};

const renderIt = (props = {}) => render(
    <StudentLoginCardDownloads credentials={credentials} chineseName="黃小明" englishName="Lucia" {...props} />
);

describe("StudentLoginCardDownloads", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.sessionStorage.clear();
        downloadAcademyStudentLoginCardsPdf.mockResolvedValue();
        downloadAcademyStudentLoginCardsDocx.mockResolvedValue();
    });

    test("PDF 貼紙：用和批次相同的卡片資料，預設放第 1 格，下載後指向第 2 格", async () => {
        const onDownloaded = jest.fn();
        renderIt({ onDownloaded });

        expect(screen.getByLabelText("放在第幾格")).toHaveValue("1");
        fireEvent.click(screen.getByRole("button", { name: "下載 PDF 登入卡" }));

        await waitFor(() => expect(downloadAcademyStudentLoginCardsPdf).toHaveBeenCalledTimes(1));
        const [results, rows, options] = downloadAcademyStudentLoginCardsPdf.mock.calls[0];
        expect(results).toEqual([{ source_row: 1, status: "success", credentials }]);
        expect(rows).toEqual([{ source_row: 1, chinese_name: "黃小明", english_name: "Lucia" }]);
        expect(options).toEqual({ startSlot: 1 });
        expect(await screen.findByRole("status")).toHaveTextContent("這張放在第 1 格。下一位學生預設放第 2 格");
        expect(screen.getByLabelText("放在第幾格")).toHaveValue("2");
        expect(onDownloaded).toHaveBeenCalledTimes(1);
    });

    test("Word 貼紙：選第 5 格就從第 5 格開始，而且下次進來還記得下一格", async () => {
        const first = renderIt();
        fireEvent.change(screen.getByLabelText("放在第幾格"), { target: { value: "5" } });
        fireEvent.click(screen.getByRole("button", { name: "下載 Word 登入卡" }));

        await waitFor(() => expect(downloadAcademyStudentLoginCardsDocx).toHaveBeenCalledTimes(1));
        expect(downloadAcademyStudentLoginCardsDocx.mock.calls[0][2]).toEqual({ startSlot: 5 });
        expect(await screen.findByRole("status")).toHaveTextContent("下一位學生預設放第 6 格");

        // 建立下一位學生時整塊會重新出現，格子要接著上次的進度。
        first.unmount();
        renderIt();
        expect(screen.getByLabelText("放在第幾格")).toHaveValue("6");
    });

    test("第 12 格用完後回到第 1 格，並提醒換新的貼紙紙", async () => {
        renderIt();
        fireEvent.change(screen.getByLabelText("放在第幾格"), { target: { value: "12" } });
        fireEvent.click(screen.getByRole("button", { name: "下載 PDF 登入卡" }));

        expect(await screen.findByRole("status")).toHaveTextContent("這張貼紙紙已用完，請換新的一張");
        expect(screen.getByLabelText("放在第幾格")).toHaveValue("1");
    });

    test("產生失敗時顯示錯誤，不算已保存，也不移動格子", async () => {
        downloadAcademyStudentLoginCardsPdf.mockRejectedValue(new Error("PDF 登入卡產生失敗，請稍後再試"));
        const onDownloaded = jest.fn();
        renderIt({ onDownloaded });

        fireEvent.click(screen.getByRole("button", { name: "下載 PDF 登入卡" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("PDF 登入卡產生失敗");
        expect(onDownloaded).not.toHaveBeenCalled();
        expect(screen.getByLabelText("放在第幾格")).toHaveValue("1");
        expect(screen.getByRole("button", { name: "下載 PDF 登入卡" })).toBeEnabled();
    });
});
