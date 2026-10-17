import { gapAnswersFromPattern, initialGuidedStep, letterTiles, nextGuidedStep, spellingTargetFor, spellingPlan } from "./speakingGuidedSteps";

describe("gapAnswersFromPattern", () => {
    it("finds the missing words of one or more blanks", () => {
        expect(gapAnswersFromPattern("It is an ____.", "It is an eye.")).toEqual(["eye"]);
        expect(gapAnswersFromPattern("They are ____ ____.", "They are her eyes.")).toEqual(["her eyes"]);
        expect(gapAnswersFromPattern("____ is my ____.", "It is my nose.")).toEqual(["It", "nose"]);
        expect(gapAnswersFromPattern("They are my father's ____.", "They are my father’s shoulders.")).toEqual(["shoulders"]);
        expect(gapAnswersFromPattern("It is a ＿＿＿.", "It is a tooth.")).toEqual(["tooth"]);
    });

    it("gives no spelling when the pattern and answer do not line up", () => {
        expect(gapAnswersFromPattern("It is a ____.", "They are teeth.")).toBeNull();
        expect(gapAnswersFromPattern("No blank here.", "No blank here.")).toBeNull();
        expect(gapAnswersFromPattern("It is ____.", "It is 5.")).toBeNull();
    });
});

describe("guided step order", () => {
    const gap = { model_answer: "It is an eye.", picture_interaction: { sentence_pattern: "It is an ____." } };
    const clip = { type: "audio", url: "u", start_ms: 0, end_ms: 1000 };

    it("listens first when there is a clip, then spells, then speaks", () => {
        const question = { ...gap, clip };
        expect(initialGuidedStep(question, "easy")).toBe("listen");
        expect(nextGuidedStep("listen", question)).toBe("spell");
        expect(nextGuidedStep("spell", question)).toBe("speak");
    });

    it("skips steps that have nothing to do", () => {
        expect(initialGuidedStep(gap, "easy")).toBe("spell");
        expect(initialGuidedStep({ model_answer: "Hello." }, "easy")).toBe("speak");
        expect(nextGuidedStep("listen", { model_answer: "Hello.", clip })).toBe("speak");
        expect(spellingTargetFor({ model_answer: "Hello." })).toBeNull();
    });

    it("never changes 自己說", () => {
        expect(initialGuidedStep({ ...gap, clip }, "challenge")).toBe("speak");
    });
});

describe("letterTiles", () => {
    it("holds every answer letter plus decoys that are not in the answer", () => {
        const tiles = letterTiles(["her eyes"], 2, () => 0.3);
        const letters = tiles.map(tile => tile.letter);
        expect(letters).toHaveLength(9);
        expect(letters.filter(letter => letter === "e")).toHaveLength(3);
        const decoys = letters.filter(letter => !"hereyes".includes(letter));
        expect(decoys).toHaveLength(2);
        expect(new Set(tiles.map(tile => tile.id)).size).toBe(9);
    });
});

describe("真實題庫的空格", () => {
    it("句尾的中文提示不影響比對（Workbook P4）", () => {
        expect(gapAnswersFromPattern("It is ____.( 一隻 )", "It is an eye.")).toEqual(["an eye"]);
        expect(gapAnswersFromPattern("It is ____. ( 一顆 )", "It is a tooth.")).toEqual(["a tooth"]);
        expect(gapAnswersFromPattern("____ are ____.( 我爸的肩膀 )", "They are my father's shoulders.")).toEqual(["They", "my father's shoulders"]);
    });

    it("英文括號仍是句子的一部分", () => {
        expect(gapAnswersFromPattern("What is this? It is a ____. Is it yours? Yes, it's mine. (No, it's not.)", "What is this? It is a pencil case. Is it yours? Yes, it's mine. (No, it's not.)")).toEqual(["pencil case"]);
    });
});

describe("spellingPlan", () => {
    const spelled = plan => plan.filter(slot => slot.spell).map(slot => slot.char).join("");
    const shown = plan => plan.map(slot => slot.char).join("");

    it("10 個字母以內全部拼", () => {
        expect(spelled(spellingPlan(["pencil case"]))).toBe("pencilcase");
        expect(spelled(spellingPlan(["xylophone"]))).toBe("xylophone");
    });

    it("太長只拼最長的字，只顯示那一格", () => {
        const plan = spellingPlan(["They", "my father's shoulders"]);
        expect(shown(plan)).toBe("my father's shoulders");
        expect(spelled(plan)).toBe("shoulders");
        expect(spelled(spellingPlan(["They", "her eyes"]))).toBe("eyes");
    });
});
