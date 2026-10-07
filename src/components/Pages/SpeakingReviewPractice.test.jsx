import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpeakingReviewPractice from "./SpeakingReviewPractice";
jest.mock("./SpeakingPronunciationRecorder", () => ({ practiceOnly, question }) => <p>{practiceOnly ? "純回聽" : "會送評"} {question.id}</p>);
jest.mock("./SpeakingVisualAid", () => () => null);
test("完成的 A–Z 可切換練習字母，離開推薦換關，沒有送評或通關操作", () => {
    const onExit=jest.fn();
    render(<SpeakingReviewPractice challenge={{title:"A–Z",generation_metadata:{interaction_type:"alphabet_round"},speaking_questions:[{id:1,question_text:"A"},{id:2,question_text:"B"}]}} onExit={onExit} />);
    expect(screen.getByRole("heading",{name:"A"})).toBeInTheDocument();
    expect(screen.getByText("純回聽 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"下一題"}));
    expect(screen.getByRole("heading",{name:"B"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"返回地圖，換一關"}));
    expect(onExit).toHaveBeenCalledTimes(1);
});
