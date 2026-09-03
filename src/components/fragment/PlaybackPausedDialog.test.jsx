import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PlaybackPausedDialog from "./PlaybackPausedDialog";

test("大型提示持續顯示、聚焦確認按鈕且不自動播放", async () => {
    const onResume = jest.fn().mockResolvedValue();
    render(<PlaybackPausedDialog onResume={onResume} />);
    expect(screen.getByRole("alertdialog", { name: "播放已暫停" })).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "我知道了，繼續播放" });
    expect(button).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(button).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onResume).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(onResume).toHaveBeenCalledTimes(1));
});

test("恢復失敗保留提示並可重試，離開提示後還原焦點", async () => {
    const previous = document.createElement("button");
    document.body.appendChild(previous);
    previous.focus();
    const onResume = jest.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValue();
    const { unmount } = render(<PlaybackPausedDialog onResume={onResume} />);
    fireEvent.click(screen.getByRole("button", { name: "我知道了，繼續播放" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("暫時無法播放");
    fireEvent.click(screen.getByRole("button", { name: "我知道了，繼續播放" }));
    await waitFor(() => expect(onResume).toHaveBeenCalledTimes(2));
    unmount();
    expect(previous).toHaveFocus();
    previous.remove();
});
