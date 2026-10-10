import React, { useState } from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import PromotionQuestionsEditor, { validatePromotionQuestions } from "./PromotionQuestionsEditor";
const questions = Array.from({ length: 5 }, (_, i) => ({ question: `Q${i + 1}`, options: ["A", "B", "C", "D"], answer: "A", custom: "preserved" }));
function Editor() { const [value, onChange] = useState(JSON.stringify(questions)); return <PromotionQuestionsEditor value={value} onChange={onChange} />; }
test("reordering and adding keep fields and advanced edits share the same draft", () => {
    render(<Editor />); fireEvent.click(screen.getByRole("button", { name: "第 1 題下移" }));
    expect(screen.getByLabelText("第 1 題題目")).toHaveValue("Q2");
    fireEvent.click(screen.getByRole("button", { name: "新增測驗題目" }));
    expect(screen.getByLabelText("第 6 題題目")).toBeVisible();
    fireEvent.click(screen.getByText("進階：編輯題目 JSON"));
    const data = JSON.parse(screen.getByLabelText("題目 JSON").value); expect(data).toHaveLength(6); expect(data[0].custom).toBe("preserved");
    fireEvent.click(screen.getByRole("button", { name: "刪除第 6 題" }));
    expect(screen.getByRole("button", { name: "刪除第 1 題", hidden: true })).toBeDisabled();
});
test("validates count, missing prompt, options and answer before an API write", () => {
    expect(validatePromotionQuestions(JSON.stringify(questions))).toBe("");
    expect(validatePromotionQuestions("[]")).toContain("5～50");
    expect(validatePromotionQuestions(JSON.stringify(Array(51).fill(questions[0])))).toContain("5～50");
    expect(validatePromotionQuestions(JSON.stringify([{ ...questions[0], question: " " }, ...questions.slice(1)]))).toContain("填寫題目");
    expect(validatePromotionQuestions(JSON.stringify([{ ...questions[0], answer: "wrong" }, ...questions.slice(1)]))).toContain("正確答案");
});
