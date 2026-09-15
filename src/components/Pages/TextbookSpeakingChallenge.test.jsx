import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import TextbookSpeakingChallenge from "./TextbookSpeakingChallenge";
import SpeakingVisualAid from "./SpeakingVisualAid";
import { completeSpeakingChallengeQuestion, getSpeakingChallengeCatalog, getSpeakingChallengeSet, startSpeakingFoundationRound } from "../../services/speakingChallengeService";

const mockFirebaseUser = { uid: "student", getIdToken: jest.fn() };
let mockRole = "student";
jest.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ firebaseUser: mockFirebaseUser, role: mockRole }) }));
jest.mock("../../services/speakingChallengeService", () => ({
    completeSpeakingChallengeQuestion: jest.fn(), getSpeakingChallengeCatalog: jest.fn(), getSpeakingChallengeSet: jest.fn(), startSpeakingFoundationRound: jest.fn()
}));
jest.mock("./WorkbookOneFoundationChallenge", () => function MockFoundationChallenge({ challenge, onComplete, onStartRound, onExit }) {
    return <section data-testid="foundation-challenge" data-interaction={challenge.generation_metadata.interaction_type}>
        <button type="button" onClick={() => onComplete(challenge.speaking_questions[0], { answer_match: true })}>完成基礎題</button>
        <button type="button" onClick={onStartRound}>建立 A–Z 回合</button>
        <button type="button" onClick={onExit}>返回教材關卡列表</button>
    </section>;
});
jest.mock("./WorkbookOnePictureChallenge", () => function MockPictureChallenge({ challenge, onComplete }) {
    return <section data-testid="picture-challenge" data-interaction={challenge.generation_metadata.interaction_type}>
        <button type="button" onClick={() => onComplete(challenge.speaking_questions[0], { answer_match: true })}>完成圖片題</button>
    </section>;
});

const LocationProbe = () => {
    const location = useLocation();
    return <output data-testid="location-path">{location.pathname}</output>;
};

describe("TextbookSpeakingChallenge model audio", () => {
    const originalAudio = global.Audio;
    beforeEach(() => { jest.clearAllMocks(); mockRole = "student"; });
    afterEach(() => { global.Audio = originalAudio; });

    it.each([
        ["alphabet_round", "foundation-challenge"],
        ["letter_spelling", "foundation-challenge"],
        ["picture_qa", "picture-challenge"],
        ["picture_gap_sentence", "picture-challenge"]
    ])("會把 %s 題型分派到正確的 Workbook 1 關卡", async (interactionType, testId) => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7,
                title: "Workbook 1 基礎口說",
                generation_metadata: { interaction_type: interactionType },
                speaking_questions: [{ id: 9, progress_status: "opened" }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByTestId(testId)).toHaveAttribute("data-interaction", interactionType);
    });

    it("Workbook 1 拼讀關完成時沿用既有完成紀錄服務", async () => {
        completeSpeakingChallengeQuestion.mockResolvedValue({ success: true });
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7,
                title: "Workbook 1 拼讀關",
                generation_metadata: { interaction_type: "letter_spelling" },
                speaking_questions: [{ id: 9, progress_status: "opened" }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "完成基礎題" }));

        await waitFor(() => expect(completeSpeakingChallengeQuestion).toHaveBeenCalledWith(mockFirebaseUser, 7, 9));
    });

    it.each([
        ["picture_qa", 21, 2101],
        ["picture_gap_sentence", 22, 2201]
    ])("Workbook 1 %s 圖片題完成時只寫入對應題目的完成紀錄", async (interactionType, questionSetId, questionId) => {
        completeSpeakingChallengeQuestion.mockResolvedValue({ success: true });
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: questionSetId,
                title: "Workbook 1 圖片口說",
                generation_metadata: { interaction_type: interactionType },
                speaking_questions: [{ id: questionId, progress_status: "opened" }]
            }
        });

        render(<MemoryRouter initialEntries={[`/student/speaking-challenges/${questionSetId}`]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "完成圖片題" }));

        await waitFor(() => expect(completeSpeakingChallengeQuestion).toHaveBeenCalledWith(mockFirebaseUser, questionSetId, questionId));
        expect(startSpeakingFoundationRound).not.toHaveBeenCalled();
    });

    it("A–Z 關卡透過後端建立受保護回合，不逐題呼叫一般完成服務", async () => {
        startSpeakingFoundationRound.mockResolvedValue({ round: { round_id: "round-1", questions: [] } });
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7,
                title: "Workbook 1 字母關",
                generation_metadata: { interaction_type: "alphabet_round" },
                speaking_questions: [{ id: 9, progress_status: "opened" }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "建立 A–Z 回合" }));

        await waitFor(() => expect(startSpeakingFoundationRound).toHaveBeenCalledWith(mockFirebaseUser, 7));
        expect(completeSpeakingChallengeQuestion).not.toHaveBeenCalled();
    });

    it("A–Z 返回箭頭會回到目前 Workbook 的關卡列表", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7,
                title: "A–Z 大小寫挑戰",
                books: { name: "Workbook 1" },
                generation_metadata: { interaction_type: "alphabet_round" },
                speaking_questions: [{ id: 9, progress_status: "opened" }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><LocationProbe /><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /><Route path="/student/speaking-challenges/book/:bookKey" element={<div>Workbook 關卡列表</div>} /></Routes></MemoryRouter>);

        fireEvent.click(await screen.findByRole("button", { name: "返回教材關卡列表" }));

        expect(screen.getByTestId("location-path")).toHaveTextContent("/student/speaking-challenges/book/book-Workbook%201");
        expect(screen.getByText("Workbook 關卡列表")).toBeInTheDocument();
    });

    it("removes the global mobile player clearance while the detail page is open", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{ id: 9, question_text: "What's your name?", hint_zh: "說出名字", model_answer: "My name is Alan.", progress_status: "opened" }]
            }
        });

        const { unmount } = render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        await screen.findByText("What's your name?");
        expect(document.body).toHaveClass("speaking-challenge-active");
        unmount();
        expect(document.body).not.toHaveClass("speaking-challenge-active");
    });

    it("plays the stored private model audio instead of browser speech synthesis", async () => {
        const play = jest.fn().mockResolvedValue(undefined);
        global.Audio = jest.fn().mockImplementation(() => ({ play, pause: jest.fn(), addEventListener: jest.fn() }));
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{
                    id: 9, sort_order: 0, question_text: "What's your name?", hint_zh: "說出名字",
                    model_answer: "My name is Alan.", model_audio_status: "ready",
                    model_audio_url: "https://r2.example/signed.mp3", progress_status: "opened"
                }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "不知道怎麼說？" }));
        fireEvent.click(screen.getByRole("button", { name: "聽回答範例" }));

        expect(global.Audio).toHaveBeenCalledWith("https://r2.example/signed.mp3");
        expect(play).toHaveBeenCalled();
    });

    it("does not fall back to device speech while audio is missing", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [{ id: 9, sort_order: 0, question_text: "What's your name?", hint_zh: "說出名字", model_answer: "My name is Alan.", model_audio_status: "missing", model_audio_url: null, progress_status: "opened" }]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        fireEvent.click(await screen.findByRole("button", { name: "不知道怎麼說？" }));
        expect(screen.getByRole("button", { name: "語音準備中" })).toBeDisabled();
    });

    it("一次只顯示一個小關卡，完成後才能前往下一題", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [
                    { id: 9, question_text: "What's your name?", hint_zh: "說出名字", model_answer: "My name is Alan.", model_audio_url: null, progress_status: "completed" },
                    { id: 10, question_text: "How old are you?", hint_zh: "說出年齡", model_answer: "I am ten.", model_audio_url: null, progress_status: "opened" }
                ]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByText("What's your name?")).toBeInTheDocument();
        expect(screen.queryByText("How old are you?")).not.toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "大挑戰完成進度" })).toHaveAttribute("aria-valuenow", "50");
        fireEvent.click(screen.getByRole("button", { name: /下一題/ }));
        expect(screen.getByText("How old are you?")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "How old are you?" })).toHaveFocus();
        expect(screen.queryByText("What's your name?")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /完成大挑戰/ })).toBeDisabled();
    });

    it("學生依教材固定順序看見下一關鎖定狀態", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            challenges: [
                { id: 2, title: "02 顏色與生活物品", topic: "Colors", difficulty: "E1", book: { name: "Workbook 1" }, question_count: 6, completed_count: 0, sequence_order: 2, is_unlocked: false },
                { id: 1, title: "01 我的名字與自我介紹", topic: "Names", difficulty: "E1", book: { name: "Workbook 1" }, question_count: 4, completed_count: 1, sequence_order: 1, is_unlocked: true }
            ]
        });

        await act(async () => {
            render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-Workbook%201"]}><Routes><Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        });

        const firstLesson = screen.getByRole("button", { name: /我的名字與自我介紹/ });
        const secondLesson = screen.getByRole("button", { name: /顏色與生活物品/ });
        const compactToolbar = screen.getByRole("button", { name: /全部教材/ }).closest(".speaking-book-toolbar");
        expect(compactToolbar).toContainElement(screen.getByRole("heading", { name: "Workbook 1" }));
        expect(compactToolbar).toHaveTextContent("依順序完成，解鎖下一關");
        expect(compactToolbar).toHaveTextContent("0/2");
        expect(firstLesson).toBeEnabled();
        expect(secondLesson).toBeDisabled();
        expect(secondLesson).toHaveTextContent("先完成前一關");
        expect(firstLesson.compareDocumentPosition(secondLesson) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("老師預覽會保留固定順序但不鎖任何已發布關卡", async () => {
        mockRole = "teacher";
        getSpeakingChallengeCatalog.mockResolvedValue({
            demo_mode: true,
            challenges: [
                { id: 2, title: "02 顏色與生活物品", book: { name: "Workbook 1" }, question_count: 6, completed_count: 0, sequence_order: 2, is_unlocked: true },
                { id: 1, title: "01 我的名字與自我介紹", book: { name: "Workbook 1" }, question_count: 4, completed_count: 0, sequence_order: 1, is_unlocked: true }
            ]
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-Workbook%201"]}><Routes><Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByText("這是唯讀預覽，所有已發布關卡都可直接開啟。")).toBeInTheDocument();
        expect(await screen.findByRole("button", { name: /顏色與生活物品/ })).toBeEnabled();
    });

    it("學生依入門、課本與主題分區，名稱旁顯示精確配合頁碼", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            challenges: [
                { id: 7, title: "00 A–Z 大小寫挑戰", topic: "字母", difficulty: "E1", book: { name: "Workbook 1" }, generation_metadata: { interaction_type: "alphabet_round" }, source_pages: [], question_count: 26, completed_count: 26, sequence_order: 0, is_unlocked: true, is_completed: true },
                { id: 10, title: "P14 看字拼讀", topic: "拼讀", difficulty: "E1", book: { name: "Workbook 1" }, catalog_section: "textbook", source_pages: [14], question_count: 10, completed_count: 0, sequence_order: 10014, is_unlocked: true },
                { id: 1, title: "01 我的名字與自我介紹", topic: "名字", difficulty: "E1", book: { name: "Workbook 1" }, catalog_section: "textbook", source_pages: [18, 19, 20], question_count: 4, completed_count: 0, sequence_order: 10018, is_unlocked: false },
                { id: 3, title: "02 打招呼與禮貌對話", topic: "問候", difficulty: "E1", book: { name: "Workbook 1" }, generation_metadata: { template_key: "workbook_1_greetings_polite_v1" }, source_pages: [35, 36, 60, 99, 100], question_count: 8, completed_count: 0, sequence_order: 20035, is_unlocked: true }
            ]
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-Workbook%201"]}><Routes><Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByRole("heading", { name: "入門準備" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "課本練習" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "主題練習" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /看字拼讀/ })).toHaveTextContent("配合第 14 頁");
        expect(screen.getByRole("button", { name: /我的名字與自我介紹/ })).toHaveTextContent("配合第 18～20 頁");
        expect(screen.getByRole("button", { name: /打招呼與禮貌對話/ })).toHaveTextContent("配合第 35～36、60、99～100 頁");
        expect(screen.queryByText("P14 看字拼讀")).not.toBeInTheDocument();
        expect(screen.queryByText("02 打招呼與禮貌對話")).not.toBeInTheDocument();
    });

    it("學生列表預設收合遊戲規則，點擊後可展開及再次收起，老師預覽不重複顯示", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [] });

        const { unmount } = render(<MemoryRouter initialEntries={["/student/speaking-challenges"]}><Routes><Route path="/student/speaking-challenges" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        const rulesToggle = await screen.findByRole("button", { name: /遊戲規則.*查看規則/ });
        expect(rulesToggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByText("選一關")).not.toBeInTheDocument();
        fireEvent.click(rulesToggle);
        expect(rulesToggle).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("選一關")).toBeInTheDocument();
        expect(screen.getByText("看題目")).toBeInTheDocument();
        expect(screen.getByText("開口說")).toBeInTheDocument();
        expect(screen.getByText(/通關會顯示打勾並開啟下一關/)).toBeInTheDocument();
        fireEvent.click(rulesToggle);
        expect(rulesToggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByText("選一關")).not.toBeInTheDocument();
        unmount();

        mockRole = "teacher";
        render(<MemoryRouter initialEntries={["/student/speaking-challenges"]}><Routes><Route path="/student/speaking-challenges" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByText("這是唯讀預覽，所有已發布關卡都可直接開啟。")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /遊戲規則/ })).not.toBeInTheDocument();
    });

    it("以真正的台灣國旗呈現台灣視覺提示", () => {
        const { container } = render(<SpeakingVisualAid aid={{ kind: "flag", value: "taiwan", alt_zh: "台灣國旗" }} />);
        expect(screen.getByRole("figure", { name: "台灣國旗" })).toBeInTheDocument();
        expect(container.querySelector('svg[viewBox="0 0 900 600"]')).toBeInTheDocument();
        expect(container).not.toHaveTextContent("TW");
    });

    it("切換大挑戰時立即隱藏上一關內容", async () => {
        let resolveSecondChallenge;
        getSpeakingChallengeSet.mockImplementation((_, id) => id === 7
            ? Promise.resolve({ challenge: { id: 7, title: "01 自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" }, speaking_questions: [{ id: 9, question_text: "What's your name?", progress_status: "opened" }] } })
            : new Promise(resolve => { resolveSecondChallenge = resolve; }));

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<><Link to="/student/speaking-challenges/8">切換到 02</Link><TextbookSpeakingChallenge /></>} /></Routes></MemoryRouter>);
        expect(await screen.findByText("What's your name?")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("link", { name: "切換到 02" }));
        expect(screen.queryByText("What's your name?")).not.toBeInTheDocument();
        expect(screen.getByText("載入小關卡中…")).toBeInTheDocument();

        await act(async () => resolveSecondChallenge({ challenge: { id: 8, title: "02 打招呼", topic: "Greetings", difficulty: "E1", books: { name: "Workbook 1" }, speaking_questions: [{ id: 10, question_text: "Good morning!", progress_status: "opened" }] } }));
        expect(screen.getByText("Good morning!")).toBeInTheDocument();
    });
});
