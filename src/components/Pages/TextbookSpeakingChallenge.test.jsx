import { clearStudentPageCache } from "../../services/studentPageCache";
beforeEach(() => clearStudentPageCache());
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
jest.mock("./WorkbookOneFoundationChallenge", () => function MockFoundationChallenge({ challenge, onComplete, onStartRound, onExit, adminScoringPreview }) {
    return <section data-testid="foundation-challenge" data-interaction={challenge.generation_metadata.interaction_type} data-admin-scoring-preview={String(adminScoringPreview)}>
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
    return <output data-testid="location-path" data-loading-return={location.state?.speakingEntry?.bookCatalogPath || ""}>{location.pathname}</output>;
};

describe("TextbookSpeakingChallenge model audio", () => {
    const originalAudio = global.Audio;
    beforeEach(() => { jest.clearAllMocks(); mockRole = "student"; });
    afterEach(() => { global.Audio = originalAudio; });

    it("今日完成的 A–Z 直接顯示回聽，不建立正式回合或寫完成紀錄", async () => {
        getSpeakingChallengeSet.mockResolvedValue({challenge:{id:7,title:"A–Z",practice_only:true,completed_today:true,generation_metadata:{interaction_type:"alphabet_round"},speaking_questions:[{id:701,question_text:"A"}]}});
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByText("錄音回聽練習")).toBeInTheDocument();
        expect(screen.queryByTestId("foundation-challenge")).not.toBeInTheDocument();
        expect(startSpeakingFoundationRound).not.toHaveBeenCalled();
        expect(completeSpeakingChallengeQuestion).not.toHaveBeenCalled();
    });

    it("下一個目標只推薦已解鎖未完成關卡，入口開摘要並在 Escape 後還原焦點", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [
            { id: 1, title: "P14 已完成", source_pages: [14], book: { name: "Workbook 1" }, question_count: 7, completed_count: 7, is_completed: true },
            { id: 2, title: "P15 問候", topic: "認識新朋友", source_pages: [15], book: { name: "Workbook 1" }, question_count: 7, completed_count: 2, is_unlocked: true },
            { id: 3, title: "P16 下一頁", source_pages: [16], book: { name: "Workbook 1" }, question_count: 7, completed_count: 0, is_unlocked: true }
        ] });
        const { container } = render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-Workbook%201"]}><Routes><Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        const goal = await screen.findByRole("button", { name: "繼續這一關" });
        expect(screen.getByLabelText("地圖學習目標")).toHaveTextContent("P.15 · 已完成 2 / 7 題");
        expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
        expect(container.querySelector('[aria-current="step"]')).toHaveAttribute("data-question-set-id", "2");
        expect(screen.getByRole("button", { name: /下一頁，尚未解鎖/ })).toBeInTheDocument();
        fireEvent.click(goal);
        expect(screen.getByRole("dialog", { name: "認識新朋友" })).toHaveTextContent("P.15");
        expect(screen.getByRole("button", { name: /挑戰 · 看題目回答/ })).toHaveFocus();
        expect(getSpeakingChallengeSet).not.toHaveBeenCalled();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(goal).toHaveFocus();
    });

    it("各路徑皆有可玩關卡時只標記一個推薦目標，全部完成後不再推薦", async () => {
        const items = [
            { id: 1, title: "A–Z", catalog_section: "preparation" },
            { id: 2, title: "P15 問候", catalog_section: "textbook", source_pages: [15] },
            { id: 3, title: "顏色練習", catalog_section: "topic" }
        ].map(item => ({ ...item, book: { name: "Workbook 1" }, question_count: 2, completed_count: 0, is_unlocked: true }));
        getSpeakingChallengeCatalog.mockResolvedValue({ challenges: items });
        const mountMap = () => render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-Workbook%201"]}><Routes><Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        const first = mountMap();
        await screen.findByRole("button", { name: "開始這一關" });
        expect(first.container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
        expect(first.container.querySelector('[aria-current="step"]')).toHaveAttribute("data-question-set-id", "1");
        first.unmount();
        clearStudentPageCache(); // The mock server changed outside the rendered page.
        getSpeakingChallengeCatalog.mockResolvedValue({ challenges: items.map(item => ({ ...item, is_completed: true, completed_count: 2 })) });
        const completed = mountMap();
        await screen.findByText("這本已全部通關！");
        expect(screen.queryByRole("button", { name: /這一關/ })).not.toBeInTheDocument();
        expect(completed.container.querySelector('[aria-current="step"]')).not.toBeInTheDocument();
    });

    it("鎖定關卡只聚焦可操作的關閉按鈕，不啟用練習入口", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({ challenges: [
            { id: 1, title: "P14 前一關", source_pages: [14], book: { name: "Workbook 1" }, question_count: 7 },
            { id: 2, title: "P15 問候", source_pages: [15], book: { name: "Workbook 1" }, question_count: 7, is_unlocked: false }
        ] });
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-Workbook%201"]}><Routes><Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: /P.15，問候，尚未解鎖/ }));
        expect(screen.getByRole("button", { name: "關閉關卡摘要" })).toHaveFocus();
        expect(screen.getByRole("button", { name: "尚未解鎖" })).toBeDisabled();
        fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
        expect(screen.getByRole("button", { name: "返回地圖" })).toHaveFocus();
    });

    it("shows the existing Workbook 2 object clue inline without duplicating a manually edited clue", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 121, book_id: 2, title: "P10 口說練習", topic: "物品", difficulty: "國小中年級",
                books: { id: 2, name: "Workbook 2" },
                generation_metadata: { interaction_type: "text_qa", candidate_filter: { generation_strategy: "ai_grouped_numbered_text_qa" } },
                speaking_questions: [
                    { id: 551, interaction_type: "text_qa", question_text: "What are these?", hint_zh: "題目線索：鞋子。請用完整句回答。", model_answer: "They are shoes.", progress_status: "opened" },
                    { id: 552, interaction_type: "text_qa", question_text: "What are（襪子） these?", hint_zh: "題目線索：襪子。請用完整句回答。", model_answer: "They are socks.", progress_status: "opened" }
                ]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/121"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "What are these?（鞋子）" })).toBeInTheDocument();
        expect(screen.queryByText("題目線索：鞋子")).not.toBeInTheDocument();
    });

    it("挑戰模式在看提示前不顯示中翻英答案", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 122, book_id: 4, title: "P26 中翻英", topic: "運動", difficulty: "國小中年級",
                books: { id: 4, name: "Workbook 4" },
                generation_metadata: { interaction_type: "text_qa", prompt_mode: "zh_to_en" },
                speaking_questions: [{ id: 553, interaction_type: "text_qa", question_text: "你每天有做任何運動嗎？它對你的健康有益", hint_zh: "請說出完整英文翻譯。", model_answer: "Do you do any exercise every day? It is good for your health.", progress_status: "opened" }]
            }
        });
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/122?mode=challenge"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "你每天有做任何運動嗎？它對你的健康有益" })).toBeInTheDocument();
        expect(screen.getByText("看中文句子，按下麥克風說出完整英文翻譯。")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "不知道怎麼說？" })).not.toBeInTheDocument();
        expect(screen.queryByText("Do you do any exercise every day? It is good for your health.")).not.toBeInTheDocument();
    });

    it("uses the per-question grammar cue mode in a mixed text challenge", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 123, book_id: 4, title: "P89 綜合練習", topic: "日期", difficulty: "國小",
                books: { id: 4, name: "Workbook 4" },
                generation_metadata: { interaction_type: "text_qa", prompt_mode: "mixed", prompt_modes_by_sort_order: ["english_qa", "grammar_cue"] },
                speaking_questions: [
                    { id: 554, sort_order: 0, interaction_type: "text_qa", question_text: "What day is tomorrow?", model_answer: "It is Saturday.", progress_status: "completed" },
                    { id: 555, sort_order: 1, interaction_type: "text_qa", question_text: "is, am ______", model_answer: "It was Thursday.", progress_status: "opened" }
                ]
            }
        });
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/123?mode=challenge"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "is, am ______" })).toBeInTheDocument();
        expect(screen.getByText("依照題目提供的文法提示，說出完整英文句子。")).toBeInTheDocument();
        expect(screen.queryByText("It was Thursday.")).not.toBeInTheDocument();
    });

    it("uses the current question's translation mode inside a mixed page", async () => {
        getSpeakingChallengeSet.mockResolvedValue({ challenge: {
            id: 123, book_id: 4, title: "P26 混合口說", topic: "運動", difficulty: "國小中年級",
            books: { id: 4, name: "Workbook 4" }, generation_metadata: { interaction_type: "mixed" },
            speaking_questions: [{ id: 554, interaction_type: "text_qa", prompt_mode: "zh_to_en",
                question_text: "你每天做運動嗎？", hint_zh: "請翻譯成英文。", model_answer: "Do you exercise every day?", progress_status: "opened" }]
        } });
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/123?mode=challenge"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "你每天做運動嗎？" })).toBeInTheDocument();
        expect(screen.getByText("看中文句子，按下麥克風說出完整英文翻譯。")).toBeInTheDocument();
        expect(screen.queryByText("Do you exercise every day?")).not.toBeInTheDocument();
    });

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

        await waitFor(() => expect(completeSpeakingChallengeQuestion).toHaveBeenCalledWith(mockFirebaseUser, 7, 9, "easy", expect.any(String)));
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

        await waitFor(() => expect(completeSpeakingChallengeQuestion).toHaveBeenCalledWith(mockFirebaseUser, questionSetId, questionId, "easy", expect.any(String)));
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

        await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/student/speaking-challenges/book/book-Workbook%201"));
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
        expect(document.body).toHaveClass("speaking-game-world-active");
        unmount();
        expect(document.body).not.toHaveClass("speaking-challenge-active");
    });

    it("keeps the mobile Navbar available on the challenge catalog", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            challenges: [],
            challenge_policy: { daily_limit: 5, daily_used: 2, daily_remaining: 3, recording_limit_seconds: 12 }
        });

        const { unmount } = render(<MemoryRouter initialEntries={["/student/speaking-challenges"]}><Routes><Route path="/student/speaking-challenges" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        await screen.findByText("還沒有可挑戰的教材");
        expect(document.body).not.toHaveClass("speaking-challenge-active");
        unmount();
    });

    it("進入 Workbook 地圖後才進入手機專注模式，返回教材總覽會恢復", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            challenges: [{ id: 21, title: "P21 看圖問答", book: { name: "Workbook 1" }, source_pages: [21], question_count: 1, completed_count: 0, is_unlocked: true }]
        });
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-Workbook%201"]}><Routes><Route path="/student/speaking-challenges" element={<TextbookSpeakingChallenge />} /><Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByRole("button", { name: /看圖問答/ })).toBeInTheDocument();
        expect(document.body).toHaveClass("speaking-challenge-active");
        fireEvent.click(screen.getByRole("button", { name: /全部教材/ }));
        await waitFor(() => expect(document.body).not.toHaveClass("speaking-challenge-active"));
    });

    it("同一本教材的入門、課本與主題關卡共用一張完整地圖", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            challenges: [
                { id: 1, title: "A–Z", book: { name: "Workbook 1" }, catalog_section: "preparation", question_count: 1, completed_count: 1, is_unlocked: true, is_completed: true },
                { id: 2, title: "P21 看圖問答", book: { name: "Workbook 1" }, catalog_section: "textbook", source_pages: [21], question_count: 1, completed_count: 0, is_unlocked: true },
                { id: 3, title: "顏色練習", book: { name: "Workbook 1" }, catalog_section: "topic", question_count: 1, completed_count: 0, is_unlocked: true }
            ]
        });
        const { container } = render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-Workbook%201"]}><Routes><Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByRole("button", { name: /看圖問答/ })).toBeInTheDocument();
        expect(container.querySelectorAll(".speaking-map-canvas")).toHaveLength(1);
        const nodes = [...container.querySelectorAll(".speaking-map-canvas .speaking-challenge-lesson")];
        expect(nodes).toHaveLength(3);
        const positions = nodes.map(node => Number.parseFloat(node.style.getPropertyValue("--map-y")));
        expect(positions[0]).toBeGreaterThan(positions[1]);
        expect(positions[1]).toBeGreaterThan(positions[2]);
        expect(container.querySelectorAll(".speaking-continuous-road")).toHaveLength(1);
        expect(container.querySelector(".speaking-map-chapter")).toHaveClass("is-segmented");
        expect(container.querySelectorAll(".speaking-map-biomes")).toHaveLength(0);
        expect(screen.getByRole("heading", { name: "Workbook 1" })).toBeInTheDocument();
        expect(container.querySelectorAll(".speaking-map-book-sign")).toHaveLength(0);
        expect(container.querySelectorAll(".speaking-map-landscape")).toHaveLength(0);
        expect(container.querySelectorAll(".speaking-map-route__line")).toHaveLength(0);
    });

    it("hides the stored private model audio from student challenges", async () => {
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
        expect(await screen.findByLabelText("簡單模式參考答案")).toHaveTextContent("My name is Alan.");
        expect(screen.queryByRole("button", { name: "聽回答範例" })).not.toBeInTheDocument();
        expect(global.Audio).not.toHaveBeenCalled();
        expect(play).not.toHaveBeenCalled();
    });

    it("keeps the existing model audio audition for staff preview", async () => {
        mockRole = "admin";
        const play = jest.fn().mockResolvedValue(undefined);
        global.Audio = jest.fn().mockImplementation(() => ({ play, pause: jest.fn(), addEventListener: jest.fn() }));
        getSpeakingChallengeSet.mockResolvedValue({ challenge: {
            id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
            speaking_questions: [{ id: 9, sort_order: 0, question_text: "What's your name?", model_answer: "My name is Alan.", model_audio_url: "https://r2.example/signed.mp3", progress_status: "opened" }]
        } });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        const audition = await screen.findByRole("button", { name: "聽回答範例" });
        await waitFor(() => expect(audition).toBeEnabled());
        fireEvent.click(audition);
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

        expect(await screen.findByLabelText("簡單模式參考答案")).toHaveTextContent("My name is Alan.");
        expect(screen.queryByRole("button", { name: "語音準備中" })).not.toBeInTheDocument();
    });

    it("學生回到關卡時接續第一道未完成題，並可先看下一題", async () => {
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

        expect(await screen.findByText("How old are you?")).toBeInTheDocument();
        expect(screen.queryByText("What's your name?")).not.toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "大挑戰完成進度" })).toHaveAttribute("aria-valuenow", "50");
        expect(screen.getByRole("heading", { name: "How old are you?" })).toHaveFocus();
        expect(screen.getByRole("button", { name: /先看下一題/ })).toBeInTheDocument();
    });

    it("教材第一層顯示精簡的冊別卡、完成進度並可進入指定 Workbook", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            reward_policy: { xp: 30, ae_points: 3, basis: "first_completion_per_challenge", ae_points_eligible_students_only: true },
            challenges: [
                { id: 1, title: "01 自我介紹", topic: "Names", difficulty: "E1", book: { id: 1, name: "Workbook 1" }, question_count: 4, completed_count: 4, sequence_order: 1, is_completed: true },
                { id: 2, title: "02 顏色", topic: "Colors", difficulty: "E1", book: { id: 1, name: "Workbook 1" }, question_count: 6, completed_count: 0, sequence_order: 2, is_completed: false },
                { id: 3, title: "01 打招呼", topic: "Greetings", difficulty: "E3", book: { id: 2, name: "Workbook 2" }, question_count: 5, completed_count: 0, sequence_order: 1, is_completed: false },
                { id: 4, title: "P4 石榴的眼睛", topic: "Body parts", difficulty: "E5", book: { id: 3, name: "Workbook 3" }, source_pages: [4], question_count: 3, completed_count: 0, sequence_order: 10004, is_completed: false }
            ]
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges"]}><LocationProbe /><Routes><Route path="/student/speaking-challenges" element={<TextbookSpeakingChallenge />} /><Route path="/student/speaking-challenges/book/:bookKey" element={<div>Workbook 關卡列表</div>} /></Routes></MemoryRouter>);

        const workbookOne = await screen.findByRole("button", { name: "開啟 Workbook 1，共 2 關，已完成 1 關，每關首次通關 30 XP、最多 3 AE Points" });
        const workbookTwo = screen.getByRole("button", { name: "開啟 Workbook 2，共 1 關，已完成 0 關，每關首次通關 30 XP、最多 3 AE Points" });
        const workbookThree = screen.getByRole("button", { name: "開啟 Workbook 3，共 1 關，已完成 0 關，每關首次通關 30 XP、最多 3 AE Points" });
        expect(workbookOne).toHaveTextContent("森林池塘");
        expect(workbookTwo).toHaveTextContent("海島沙灘");
        expect(workbookThree).toHaveTextContent("糖果花園");
        expect(screen.getByRole("progressbar", { name: "Workbook 1 完成進度" })).toHaveAttribute("aria-valuenow", "50");
        expect(screen.getByRole("progressbar", { name: "Workbook 2 完成進度" })).toHaveAttribute("aria-valuenow", "0");
        expect(workbookOne).toHaveTextContent("繼續冒險");
        expect(workbookTwo).toHaveTextContent("開始冒險");
        expect(workbookThree).toHaveTextContent("開始冒險");
        expect(workbookOne).toHaveTextContent("共 2 關 · 已完成 1 關");
        expect(workbookOne.querySelector(".speaking-book-card__chapter")).toHaveTextContent("01");
        expect(workbookOne.querySelector(".speaking-book-card__scene img")).toHaveAttribute("src", expect.stringContaining("unified-forest-a"));
        expect(workbookTwo.querySelector(".speaking-book-card__scene img")).toHaveAttribute("src", expect.stringContaining("unified-island-a"));
        expect(workbookThree.querySelector(".speaking-book-card__scene img")).toHaveAttribute("src", expect.stringContaining("unified-candy-a"));
        expect(workbookOne.querySelector(".speaking-book-card__art")).toBeNull();
        expect(workbookOne.querySelector(".speaking-book-card__reward")).toBeNull();

        fireEvent.click(workbookTwo);
        expect(screen.getByTestId("location-path")).toHaveTextContent("/student/speaking-challenges/book/book-2");
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
        expect(document.querySelector(".speaking-map-book-sign")).not.toBeInTheDocument();
        expect(compactToolbar).toHaveTextContent("0/2");
        expect(firstLesson).toBeEnabled();
        expect(secondLesson).toHaveAccessibleName(/尚未解鎖/);
        fireEvent.click(secondLesson);
        expect(screen.getByRole("dialog").querySelector("button.primary")).toBeDisabled();
        expect(screen.queryByText("通關星星")).not.toBeInTheDocument();
        expect(screen.getByText("先完成前一關，就能解鎖這個挑戰。")).toBeInTheDocument();
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

        expect(await screen.findByRole("heading", { name: "Workbook 1" })).toBeInTheDocument();
        const lesson = await screen.findByRole("button", { name: /顏色與生活物品/ });
        expect(lesson).toBeEnabled();
        fireEvent.click(lesson);
        expect(screen.getByRole("button", { name: "自由練習" })).toBeEnabled();
        expect(screen.getByRole("button", { name: /挑戰 · 看題目回答/ })).toBeEnabled();
    });

    it("地圖圓點只顯示頁碼或關卡序號，主題留在摘要", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            challenges: [
                { id: 7, title: "00 A–Z 大小寫挑戰", topic: "字母", difficulty: "E1", book: { name: "Workbook 1" }, generation_metadata: { interaction_type: "alphabet_round" }, source_pages: [], question_count: 26, completed_count: 26, sequence_order: 0, is_unlocked: true, is_completed: true },
                { id: 10, title: "P14 看字拼讀", topic: "拼讀", difficulty: "E1", book: { name: "Workbook 1" }, catalog_section: "textbook", source_pages: [14], question_count: 10, completed_count: 0, sequence_order: 10014, is_unlocked: true },
                { id: 1, title: "01 我的名字與自我介紹", topic: "名字", difficulty: "E1", book: { name: "Workbook 1" }, catalog_section: "textbook", source_pages: [18, 19, 20], question_count: 4, completed_count: 4, sequence_order: 10018, is_unlocked: false, is_completed: true },
                { id: 21, title: "P21 看圖問答", topic: "看圖問答", difficulty: "E1", book: { name: "Workbook 1" }, catalog_section: "textbook", source_pages: [21], question_count: 9, completed_count: 0, sequence_order: 10021, is_unlocked: true },
                { id: 3, title: "02 打招呼與禮貌對話", topic: "問候", difficulty: "E1", book: { name: "Workbook 1" }, generation_metadata: { template_key: "workbook_1_greetings_polite_v1" }, source_pages: [35, 36, 60, 99, 100], question_count: 8, completed_count: 0, sequence_order: 20035, is_unlocked: false },
                { id: 4, title: "P100 顏色與生活物品", topic: "顏色", difficulty: "E1", book: { name: "Workbook 1" }, generation_metadata: { template_key: "workbook_1_colors_objects_v1" }, source_pages: [100], question_count: 6, completed_count: 0, sequence_order: 20100, is_unlocked: true }
            ]
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-Workbook%201"]}><Routes><Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByRole("heading", { name: "Workbook 1" })).toBeInTheDocument();
        expect(document.querySelectorAll(".speaking-map-canvas")).toHaveLength(1);
        expect(screen.getByRole("button", { name: /看字拼讀/ })).toHaveTextContent("P.14");
        expect(screen.getByRole("button", { name: /我的名字與自我介紹/ })).toHaveAccessibleName(/P.18～20/);
        expect(screen.getByRole("button", { name: /我的名字與自我介紹/ })).toHaveTextContent(/P\.18\s*～20/);
        expect(screen.getByRole("button", { name: /我的名字與自我介紹/ })).toHaveClass("is-multiline-label");
        expect(screen.getByRole("button", { name: /看圖問答/ })).toHaveAccessibleName(/尚未解鎖/);
        expect(screen.getByRole("button", { name: /打招呼與禮貌對話/ })).toHaveTextContent("主題1");
        expect(screen.getByRole("button", { name: /打招呼與禮貌對話/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /顏色與生活物品/ })).toHaveAccessibleName(/主題2/);
        expect(screen.getByRole("button", { name: /打招呼與禮貌對話/ })).not.toHaveTextContent("打招呼與禮貌對話");
        expect(screen.queryByText("P14 看字拼讀")).not.toBeInTheDocument();
        expect(screen.queryByText("02 打招呼與禮貌對話")).not.toBeInTheDocument();
    });

    it("老師的一般口說預覽可以前後切題，且不顯示錄音操作", async () => {
        mockRole = "teacher";
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [
                    { id: 9, question_text: "What's your name?", progress_status: "opened" },
                    { id: 10, question_text: "How old are you?", progress_status: "opened" }
                ]
            }
        });
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByText("What's your name?")).toBeInTheDocument();
        expect(screen.getByText("老師唯讀預覽：可使用下方按鈕逐題查看，不啟用麥克風。")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "不知道怎麼說？" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "上一題" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "下一題" }));
        expect(screen.getByText("How old are you?")).toBeInTheDocument();
        expect(completeSpeakingChallengeQuestion).not.toHaveBeenCalled();
    });

    it("地圖節點先開摘要，再由開始挑戰前往題目", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            challenges: [{ id: 21, title: "P21 看圖問答", topic: "看圖問答", intro_zh: "用圖片練習完整問答", book: { name: "Workbook 1" }, catalog_section: "textbook", source_pages: [21], question_count: 9, completed_count: 0, sequence_order: 10021, is_unlocked: true, available_powerups: ["提示卡"] }]
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-Workbook%201"]}><LocationProbe /><Routes><Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} /><Route path="/student/speaking-challenges/:questionSetId" element={<div>正式挑戰頁</div>} /></Routes></MemoryRouter>);

        const node = await screen.findByRole("button", { name: /看圖問答/ });
        expect(node.closest(".speaking-adventure-route")).toBeInTheDocument();
        expect(node.querySelector(".speaking-challenge-lesson__number")).toHaveTextContent("P.21");
        fireEvent.click(node);
        expect(screen.getByRole("dialog", { name: "看圖問答" })).toHaveTextContent("P.21");
        expect(screen.getByRole("dialog")).toHaveTextContent("挑戰通過0 / 9");
        expect(screen.getByRole("dialog")).not.toHaveTextContent("簡單0 / 9");
        expect(screen.queryByText("本關道具")).not.toBeInTheDocument();
        expect(screen.queryByText("提示卡")).not.toBeInTheDocument();
        expect(screen.getByTestId("location-path")).toHaveTextContent("/student/speaking-challenges/book/");
        fireEvent.click(screen.getByRole("button", { name: "自由練習" }));
        expect(screen.getByText("正式挑戰頁")).toBeInTheDocument();
        expect(screen.getByTestId("location-path")).toHaveAttribute("data-loading-return", "/student/speaking-challenges/book/book-Workbook%201");
    });

    it("學生只看到完成後的繼續挑戰，老師預覽才有上一題與下一題", async () => {
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 7, title: "自我介紹", topic: "Names", difficulty: "E1", books: { name: "Workbook 1" },
                speaking_questions: [
                    { id: 71, question_text: "What's your name?", progress_status: "completed" },
                    { id: 72, question_text: "How are you?", progress_status: "completed" }
                ]
            }
        });
        const student = render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByText("What's your name?")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "上一題" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "下一題" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /繼續挑戰/ }));
        expect(screen.getByText("How are you?")).toBeInTheDocument();
        student.unmount();

        mockRole = "teacher";
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole("button", { name: /下一題/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /上一題/ })).toBeDisabled();
    });

    it("學生列表預設收合遊戲規則，點擊後可展開及再次收起，老師預覽不重複顯示", async () => {
        getSpeakingChallengeCatalog.mockResolvedValue({
            challenges: [],
            challenge_policy: { daily_limit: 5, daily_used: 2, daily_remaining: 3, recording_limit_seconds: 12 }
        });

        const { unmount } = render(<MemoryRouter initialEntries={["/student/speaking-challenges"]}><Routes><Route path="/student/speaking-challenges" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        const rulesToggle = await screen.findByRole("button", { name: /家長小提醒.*查看說明/ });
        expect(rulesToggle).toHaveAttribute("aria-expanded", "false");
        expect(await screen.findByText("3 輪")).toBeInTheDocument();
        expect(screen.getByLabelText("口說挑戰三步驟")).toBeInTheDocument();
        expect(screen.queryByText("輪數怎麼算？")).not.toBeInTheDocument();
        fireEvent.click(rulesToggle);
        expect(rulesToggle).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("輪數怎麼算？")).toBeInTheDocument();
        expect(screen.getByText("送評有上限嗎？")).toBeInTheDocument();
        expect(screen.getByText(/每個字母每天最多評分 3 次/)).toBeInTheDocument();
        expect(screen.getByText(/第一次送評才扣一輪.*同輪重試不多扣/)).toBeInTheDocument();
        expect(screen.getByText(/字母／拼讀最多 12 秒/)).toBeInTheDocument();
        expect(screen.getByText(/完成整關挑戰才算正式通關並解鎖下一頁/)).toBeInTheDocument();
        fireEvent.click(rulesToggle);
        expect(rulesToggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByText("輪數怎麼算？")).not.toBeInTheDocument();
        unmount();

        mockRole = "teacher";
        render(<MemoryRouter initialEntries={["/student/speaking-challenges"]}><Routes><Route path="/student/speaking-challenges" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByText("選擇 Workbook 預覽已發布關卡。")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /家長小提醒.*查看說明/ })).not.toBeInTheDocument();
    });

    it("管理員在學生版型中可逐題預覽，但不會寫入學生進度", async () => {
        mockRole = "admin";
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 14, title: "P14 看字拼讀", topic: "Spelling", difficulty: "E1", books: { id: 1, name: "Workbook 1" },
                speaking_questions: [
                    { id: 141, question_text: "apple", progress_status: "opened" },
                    { id: 142, question_text: "ball", progress_status: "opened" }
                ]
            }
        });

        render(<MemoryRouter initialEntries={["/student/speaking-challenges/14"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(await screen.findByText("管理員評分示範")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /下一題/ })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: /下一題/ }));
        expect(screen.getByText("ball")).toBeInTheDocument();
        expect(completeSpeakingChallengeQuestion).not.toHaveBeenCalled();
    });

    it("管理員簡單模式示範會顯示參考答案", async () => {
        mockRole = "admin";
        getSpeakingChallengeSet.mockResolvedValue({ challenge: {
            id: 15, title: "P15 對話", topic: "問答", books: { id: 1, name: "Workbook 1" },
            speaking_questions: [{ id: 151, question_text: "What is this?", model_answer: "It is a cat.", progress_status: "opened" }]
        } });
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/15?mode=easy"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByLabelText("簡單模式參考答案")).toHaveTextContent("It is a cat.");
        expect(completeSpeakingChallengeQuestion).not.toHaveBeenCalled();
    });

    it("只把 A–Z 管理員預覽標記為可送評，教師維持唯讀", async () => {
        mockRole = "admin";
        getSpeakingChallengeSet.mockResolvedValue({
            challenge: {
                id: 26,
                title: "A–Z",
                generation_metadata: { interaction_type: "alphabet_round" },
                speaking_questions: [{ id: 261, question_text: "A", progress_status: "opened" }]
            }
        });
        const { unmount } = render(<MemoryRouter initialEntries={["/student/speaking-challenges/26"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByTestId("foundation-challenge")).toHaveAttribute("data-admin-scoring-preview", "true");
        unmount();

        mockRole = "teacher";
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/26"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByTestId("foundation-challenge")).toHaveAttribute("data-admin-scoring-preview", "false");
    });

    it("以真正的台灣國旗呈現台灣視覺提示", () => {
        const { container } = render(<SpeakingVisualAid aid={{ kind: "flag", value: "taiwan", alt_zh: "台灣國旗" }} />);
        expect(screen.getByRole("figure", { name: "台灣國旗" })).toBeInTheDocument();
        expect(container.querySelector('svg[viewBox="0 0 900 600"]')).toBeInTheDocument();
        expect(container).not.toHaveTextContent("TW");
    });

    it.each([1, 2, 3, 4, 5, 6])("Workbook %s 直接進入時顯示讀取頁，資料到齊即進入地圖", async bookId => {
        let resolveCatalog;
        getSpeakingChallengeCatalog.mockImplementation(() => new Promise(resolve => { resolveCatalog = resolve; }));
        render(<MemoryRouter initialEntries={[`/student/speaking-challenges/book/book-${bookId}`]}><Routes>
            <Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} />
        </Routes></MemoryRouter>);
        expect(screen.getByRole("heading", { name: `正在進入 Workbook ${bookId} 口說大挑戰…` })).toHaveFocus();
        expect(screen.getByRole("progressbar", { name: "關卡地圖載入中" })).not.toHaveAttribute("aria-valuenow");
        expect(screen.queryByText("正在準備口說大挑戰…")).not.toBeInTheDocument();
        await act(async () => resolveCatalog({ challenges: [{ id: 71, title: "P4 問候", source_pages: [4], book: { id: bookId, name: `Workbook ${bookId}` }, question_count: 1 }] }));
        expect(screen.getByRole("heading", { name: `Workbook ${bookId}` })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /P.4，問候/ })).toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("從教材列表進入同一份目錄中的另一冊，直接復用已讀取地圖", async () => {
        const challenges = [{ id: 71, title: "P4 問候", source_pages: [4], book: { id: 3, name: "Workbook 3" }, question_count: 1 }];
        getSpeakingChallengeCatalog.mockResolvedValue({ challenges });
        render(<MemoryRouter initialEntries={["/student/speaking-challenges"]}><Routes>
            <Route path="/student/speaking-challenges" element={<TextbookSpeakingChallenge />} />
            <Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} />
        </Routes></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: /開啟 Workbook 3/ }));
        expect(screen.queryByRole("button", { name: /開啟 Workbook 3/ })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /P.4，問候/ })).toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(getSpeakingChallengeCatalog).toHaveBeenCalledTimes(1);
    });

    it("Workbook 讀取中返回教材列表，忽略晚到的關卡", async () => {
        let resolveCatalog;
        getSpeakingChallengeCatalog.mockImplementation(() => new Promise(resolve => { resolveCatalog = resolve; }));
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-3"]}><Routes>
            <Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} />
            <Route path="/student/speaking-challenges" element={<h1>選擇教材</h1>} />
        </Routes></MemoryRouter>);
        fireEvent.click(screen.getByRole("button", { name: "返回全部教材" }));
        await screen.findByRole("heading", { name: "選擇教材" });
        await act(async () => resolveCatalog({ challenges: [{ id: 71, title: "晚到的關卡", book: { id: 3, name: "Workbook 3" } }] }));
        expect(screen.queryByText("晚到的關卡")).not.toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("Workbook 載入失敗停止讀取動畫並保留錯誤訊息", async () => {
        getSpeakingChallengeCatalog.mockRejectedValue(new Error("地圖暫時無法讀取"));
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/book/book-3"]}><Routes>
            <Route path="/student/speaking-challenges/book/:bookKey" element={<TextbookSpeakingChallenge />} />
        </Routes></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "口說大挑戰暫時無法開啟" })).toBeInTheDocument();
        expect(screen.getByText("地圖暫時無法讀取")).toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it.each(["easy", "challenge"])("讀取畫面依 %s 模式顯示並在題目準備完成後進入", async mode => {
        let resolveChallenge;
        getSpeakingChallengeSet.mockImplementation(() => new Promise(resolve => { resolveChallenge = resolve; }));
        render(<MemoryRouter initialEntries={[{ pathname: "/student/speaking-challenges/7", search: `?mode=${mode}`, state: { speakingEntry: {
            questionSetId: 7, bookLabel: "Workbook 1", levelLabel: "P.18～20", bookCatalogPath: "/student/speaking-challenges/book/book-1"
        } } }]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);

        expect(screen.getByRole("heading", { name: `正在進入${mode === "challenge" ? "挑戰" : "簡單"}模式…` })).toBeInTheDocument();
        expect(screen.getByText("Workbook 1 · P.18～20")).toBeInTheDocument();
        expect(screen.getByRole("progressbar", { name: "題目載入中" })).not.toHaveAttribute("aria-valuenow");
        expect(getSpeakingChallengeSet).toHaveBeenCalledWith(mockFirebaseUser, 7, mode);
        await act(async () => resolveChallenge({ challenge: { id: 7, title: "自我介紹", topic: "Names", books: { id: 1, name: "Workbook 1" }, speaking_questions: [{ id: 9, question_text: "What's your name?", model_answer: "My name is Alan.", progress_status: "opened" }] } }));
        expect(screen.getByRole("heading", { name: "What's your name?" })).toBeInTheDocument();
        expect(screen.queryByRole("progressbar", { name: "題目載入中" })).not.toBeInTheDocument();
    });

    it("讀取畫面可返回原 Workbook，忽略稍後才回來的題目", async () => {
        let resolveChallenge;
        getSpeakingChallengeSet.mockImplementation(() => new Promise(resolve => { resolveChallenge = resolve; }));
        render(<MemoryRouter initialEntries={[{ pathname: "/student/speaking-challenges/7", state: { speakingEntry: {
            questionSetId: 7, bookLabel: "Workbook 1", levelLabel: "P.18～20", bookCatalogPath: "/student/speaking-challenges/book/book-1"
        } } }]}><Routes>
            <Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} />
            <Route path="/student/speaking-challenges/book/:bookKey" element={<h1>Workbook 1 地圖</h1>} />
        </Routes><LocationProbe /></MemoryRouter>);
        fireEvent.click(screen.getByRole("button", { name: "返回地圖" }));
        await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/student/speaking-challenges/book/book-1"));
        await act(async () => resolveChallenge({ challenge: { id: 7, speaking_questions: [{ id: 9, question_text: "Late question" }] } }));
        expect(screen.getByRole("heading", { name: "Workbook 1 地圖" })).toBeInTheDocument();
        expect(screen.queryByText("Late question")).not.toBeInTheDocument();
    });

    it("讀取畫面遇到失敗會停止動畫並顯示錯誤", async () => {
        getSpeakingChallengeSet.mockRejectedValue(new Error("伺服器暫時忙碌"));
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7?mode=challenge"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<TextbookSpeakingChallenge />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "口說大挑戰暫時無法開啟" })).toBeInTheDocument();
        expect(screen.getByText("伺服器暫時忙碌")).toBeInTheDocument();
        expect(screen.queryByRole("progressbar", { name: "題目載入中" })).not.toBeInTheDocument();
    });

    it("讀取畫面切換同一關模式時不顯示舊模式內容", async () => {
        let resolveChallenge;
        const firstChallenge = { id: 7, topic: "Names", speaking_questions: [{ id: 9, question_text: "What's your name?", model_answer: "My name is Alan.", progress_status: "opened" }] };
        getSpeakingChallengeSet.mockImplementation((_, id, mode) => mode === "easy"
            ? Promise.resolve({ challenge: firstChallenge })
            : new Promise(resolve => { resolveChallenge = resolve; }));
        render(<MemoryRouter initialEntries={["/student/speaking-challenges/7?mode=easy"]}><Routes><Route path="/student/speaking-challenges/:questionSetId" element={<><Link to="/student/speaking-challenges/7?mode=challenge">切換挑戰</Link><TextbookSpeakingChallenge /></>} /></Routes></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "What's your name?" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("link", { name: "切換挑戰" }));
        expect(screen.getByRole("heading", { name: "正在進入挑戰模式…" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "What's your name?" })).not.toBeInTheDocument();
        await act(async () => resolveChallenge({ challenge: firstChallenge }));
        expect(screen.getByRole("heading", { name: "What's your name?" })).toBeInTheDocument();
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
        expect(screen.getByRole("heading", { name: "正在進入簡單模式…" })).toBeInTheDocument();

        await act(async () => resolveSecondChallenge({ challenge: { id: 8, title: "02 打招呼", topic: "Greetings", difficulty: "E1", books: { name: "Workbook 1" }, speaking_questions: [{ id: 10, question_text: "Good morning!", progress_status: "opened" }] } }));
        expect(screen.getByText("Good morning!")).toBeInTheDocument();
    });
});
