import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpeakingContentAdmin from "./SpeakingContentAdmin";
import {
    createWorkbookOneCuratedQuestionSet, getSpeakingContentBootstrap,
    getSpeakingQuestionAudioPreview, updateDraftSpeakingQuestion
} from "../../services/speakingContentService";

const mockFirebaseUser = { uid: "admin" };
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockFirebaseUser }) }));
jest.mock("../../services/speakingContentService", () => ({
    createWorkbookOneStarterQuestionSet: jest.fn(),
    createWorkbookOneGreetingsQuestionSet: jest.fn(),
    createWorkbookOneCuratedQuestionSet: jest.fn(),
    createWorkbookTwoStarterQuestionSet: jest.fn(),
    getSpeakingContentBootstrap: jest.fn(),
    getSpeakingQuestionAudioPreview: jest.fn(),
    publishSpeakingQuestionSet: jest.fn(),
    generateSpeakingQuestionSetAudio: jest.fn(),
    updateDraftSpeakingQuestion: jest.fn()
}));

const questions = [
    { id: 31, sort_order: 0, question_text: "What's your name?", hint_zh: "請說出名字。", simple_answer: "My name is Amy.", model_answer: "My name is Amy.", keywords: ["name"], accepted_intents: ["名字"], pronunciation_notes_zh: "name 要清楚" },
    { id: 32, sort_order: 1, question_text: "How do you spell your name?", hint_zh: "請拼出名字。", simple_answer: "A-M-Y.", model_answer: "My name is spelled A-M-Y.", keywords: ["spell"], accepted_intents: ["拼字"] }
];
const questionSet = {
    id: 12, source_section_id: 11, title: "01 我的名字與自我介紹", status: "draft", version: 1,
    generation_metadata: { template_key: "workbook_1_name_intro_v1" }, speaking_questions: questions
};
const bootstrap = {
    books: [{ id: 1, name: "Workbook 1", code: "Workbook_1" }, { id: 2, name: "Workbook 2", code: "Workbook_2" }],
    documents: [], chunks: [], sections: [], question_sets: [questionSet]
};

describe("SpeakingContentAdmin challenge manager", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        window.scrollTo = jest.fn();
        getSpeakingContentBootstrap.mockResolvedValue(bootstrap);
        createWorkbookOneCuratedQuestionSet.mockResolvedValue({ success: true, reused: false });
        updateDraftSpeakingQuestion.mockResolvedValue({ success: true });
        getSpeakingQuestionAudioPreview.mockResolvedValue({ audio_url: "https://audio.example/puck.wav" });
    });

    it("uses a compact challenge catalog and hides inactive OCR inputs", async () => {
        render(<SpeakingContentAdmin />);
        expect(await screen.findByRole("heading", { name: "關卡總覽" })).toBeInTheDocument();
        expect(await screen.findByText("我的名字與自我介紹")).toBeInTheDocument();
        expect(screen.getByText("問句與總複習")).toBeInTheDocument();
        expect(screen.queryByText("整本教材分批辨識")).not.toBeInTheDocument();
        expect(screen.queryByText("單一範圍或貼入文字")).not.toBeInTheDocument();
    });

    it("opens one question at a time with a clear topic and question position", async () => {
        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: "繼續編輯" }));
        expect(screen.getByRole("heading", { name: "01 我的名字與自我介紹" })).toBeInTheDocument();
        expect(screen.getByText("第 1 題，共 2 題")).toBeInTheDocument();
        expect(screen.getByDisplayValue("What's your name?")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("How do you spell your name?")).not.toBeInTheDocument();
    });

    it("navigates between questions without expanding every editor", async () => {
        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: "繼續編輯" }));
        fireEvent.click(screen.getByRole("button", { name: "下一題" }));
        expect(screen.getByText("第 2 題，共 2 題")).toBeInTheDocument();
        expect(screen.getByDisplayValue("How do you spell your name?")).toBeInTheDocument();
    });

    it("opens student preview in a separate dialog", async () => {
        render(<SpeakingContentAdmin />);
        fireEvent.click(await screen.findByRole("button", { name: "繼續編輯" }));
        fireEvent.click(screen.getByRole("button", { name: "預覽學生畫面" }));
        expect(screen.getByRole("dialog", { name: "01 我的名字與自我介紹" })).toBeInTheDocument();
        expect(screen.getByText("這是管理員預覽，不會寫入學生進度。")).toBeInTheDocument();
    });

    it("creates a missing curated draft and immediately opens its editor", async () => {
        const created = { ...questionSet, id: 22, title: "03 顏色與生活物品", generation_metadata: { template_key: "workbook_1_colors_objects_v1" } };
        getSpeakingContentBootstrap.mockResolvedValueOnce(bootstrap).mockResolvedValueOnce({ ...bootstrap, question_sets: [questionSet, created] });
        render(<SpeakingContentAdmin />);
        const colorsRow = (await screen.findByText("顏色與生活物品")).closest("article");
        fireEvent.click(colorsRow.querySelector("button"));
        await waitFor(() => expect(createWorkbookOneCuratedQuestionSet).toHaveBeenCalledWith(mockFirebaseUser, 1, "create_workbook_1_colors"));
        expect(await screen.findByRole("heading", { name: "03 顏色與生活物品" })).toBeInTheDocument();
    });
});
