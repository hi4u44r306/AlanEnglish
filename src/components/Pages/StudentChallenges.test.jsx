import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getSpeakingChallengeCatalog } from "../../services/speakingChallengeService";
import { clearStudentPageCache } from "../../services/studentPageCache";
import { WORD_BANK_VERSION, WORD_CHALLENGE_LEVELS } from "../../services/wordChallengeBank";
import wordBank from "../../data/wordChallenge/wordBank.v1.json";
import StudentChallenges from "./StudentChallenges";

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/speakingChallengeService", () => ({ getSpeakingChallengeCatalog: jest.fn() }));

const WORD_TOTAL = WORD_CHALLENGE_LEVELS.reduce((total, level) => total + level.meaningReady, 0);

const student = features => ({
    firebaseUser: { uid: "challenge-test" },
    role: "student",
    studentProfile: { membership: { is_active: true, effective_access: { features } } }
});

const renderPage = () => render(<MemoryRouter><StudentChallenges /></MemoryRouter>);

beforeEach(() => {
    clearStudentPageCache();
    window.localStorage.clear();
    getSpeakingChallengeCatalog.mockReset();
});

test("a student with the speaking plan sees both challenges and the current book's progress", async () => {
    useAuth.mockReturnValue(student({ pronunciation: true }));
    getSpeakingChallengeCatalog.mockResolvedValue({
        challenges: [
            { id: 1, is_completed: true, book: { id: 7, name: "Workbook 1" } },
            { id: 2, is_completed: false, book: { id: 7, name: "Workbook 1" } },
            { id: 3, is_completed: false, book: { id: 8, name: "Workbook 2" } }
        ]
    });
    renderPage();
    expect(screen.getByRole("heading", { name: "大挑戰" })).toBeInTheDocument();
    const speaking = screen.getByRole("link", { name: /口說大挑戰/ });
    expect(speaking).toHaveAttribute("href", "/student/speaking-challenges");
    await waitFor(() => expect(within(speaking).getByText("Workbook 1 · 已過 1 / 2 關")).toBeInTheDocument());
    const word = screen.getByRole("link", { name: /單字大挑戰/ });
    expect(word).toHaveAttribute("href", "/student/word-challenge");
    expect(within(word).getByText(`${WORD_TOTAL} 字 · 還沒挑戰`)).toBeInTheDocument();
});

test("without the speaking plan, speaking is locked but the word challenge stays open", () => {
    useAuth.mockReturnValue(student({ listening: true }));
    renderPage();
    expect(screen.queryByRole("link", { name: /口說大挑戰/ })).not.toBeInTheDocument();
    expect(screen.getByText("需要「口說方案」。請問老師或家長。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "看會員與功能" })).toHaveAttribute("href", "/student/membership");
    expect(getSpeakingChallengeCatalog).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /單字大挑戰/ })).toHaveAttribute("href", "/student/word-challenge");
});

test("the word card counts words already spelled correctly on this device", () => {
    useAuth.mockReturnValue(student({}));
    const known = wordBank.words.filter(word => word.gloss).slice(0, 3).map(word => word.key);
    window.localStorage.setItem(`ae-word-challenge:${WORD_BANK_VERSION}:meaning`, JSON.stringify({ best: {}, mastered: known, missed: [] }));
    renderPage();
    expect(within(screen.getByRole("link", { name: /單字大挑戰/ })).getByText(`已會 3 / ${WORD_TOTAL} 字`)).toBeInTheDocument();
});

test("teachers preview both challenges without loading a student's progress", () => {
    useAuth.mockReturnValue({ firebaseUser: { uid: "teacher" }, role: "teacher", studentProfile: {} });
    renderPage();
    expect(within(screen.getByRole("link", { name: /口說大挑戰/ })).getByText("老師預覽")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /單字大挑戰/ })).toBeInTheDocument();
    expect(getSpeakingChallengeCatalog).not.toHaveBeenCalled();
});
