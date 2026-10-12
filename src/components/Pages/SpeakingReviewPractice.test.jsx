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
test("念錯三次進來時，直接停在卡住的那個字母", () => {
    render(<SpeakingReviewPractice challenge={{title:"A–Z",practice_question_id:2,generation_metadata:{interaction_type:"alphabet_round"},speaking_questions:[{id:1,question_text:"A"},{id:2,question_text:"B"},{id:3,question_text:"C"}]}} onExit={jest.fn()} />);
    expect(screen.getByRole("heading",{name:"B"})).toBeInTheDocument();
    expect(screen.getByText(/第 2 \/ 3 題/)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"上一題"})).toBeEnabled();
});
