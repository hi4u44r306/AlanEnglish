import { buildLetterSlots, checkWordAnswer, lettersOnly, noteMessage, WORD_CHALLENGE_MODES } from "./wordChallengeAnswer";

const { audio, meaning } = WORD_CHALLENGE_MODES;

describe("lettersOnly", () => {
    test("ignores case, spaces, hyphens, apostrophes and full-width letters", () => {
        expect(lettersOnly(" Ice  Cream ")).toBe("icecream");
        expect(lettersOnly("e-mail")).toBe("email");
        expect(lettersOnly("o’clock")).toBe("oclock");
        expect(lettersOnly("ＡＰＰＬＥ")).toBe("apple");
    });
});

describe("checkWordAnswer", () => {
    const apple = { key: "apple", display: "apple", letters: 5 };

    test("exact spelling is correct and wrong spelling is wrong", () => {
        expect(checkWordAnswer("apple", apple, audio)).toMatchObject({ correct: true, note: null });
        expect(checkWordAnswer("aple", apple, audio)).toMatchObject({ correct: false, note: "oneLetter" });
        expect(checkWordAnswer("orange", apple, audio)).toMatchObject({ correct: false, note: null });
        expect(checkWordAnswer("   ", apple, audio)).toMatchObject({ correct: false, note: "empty" });
    });

    test("a one-letter difference is still wrong", () => {
        expect(checkWordAnswer("appel", apple, audio).correct).toBe(false);
    });

    test("proper nouns typed in lowercase are correct with a capital-letter reminder", () => {
        const monday = { key: "monday", display: "Monday", properNoun: true, letters: 6 };
        const result = checkWordAnswer("monday", monday, audio);
        expect(result).toMatchObject({ correct: true, note: "capitalize" });
        expect(noteMessage(monday, result)).toContain("Monday");
        expect(checkWordAnswer("Monday", monday, audio).note).toBeNull();
    });

    test("British spelling is accepted with a reminder", () => {
        const color = { key: "color", display: "color", ukSpellings: ["colour"], letters: 5 };
        expect(checkWordAnswer("colour", color, meaning)).toMatchObject({ correct: true, note: "uk", matched: "colour" });
    });

    test("homophones count only when listening", () => {
        const two = { key: "two", display: "two", homophones: ["to", "too"], letters: 3 };
        expect(checkWordAnswer("too", two, audio)).toMatchObject({ correct: true, note: "homophone" });
        expect(checkWordAnswer("too", two, meaning).correct).toBe(false);
    });

    test("synonyms and same-meaning words count only when reading the Chinese", () => {
        const airplane = { key: "airplane", display: "airplane", alternates: ["plane"], letters: 8 };
        expect(checkWordAnswer("plane", airplane, meaning)).toMatchObject({ correct: true, note: "synonym" });
        expect(checkWordAnswer("plane", airplane, audio).correct).toBe(false);
        const big = { key: "big", display: "big", gloss: "大的", letters: 3 };
        expect(checkWordAnswer("large", big, meaning, ["large"])).toMatchObject({ correct: true, note: "synonym" });
    });

    test("multi-word and hyphenated words compare letters only", () => {
        const iceCream = { key: "ice-cream", display: "ice cream", letters: 8 };
        expect(checkWordAnswer("ice cream", iceCream, audio).correct).toBe(true);
        expect(checkWordAnswer("icecream", iceCream, audio).correct).toBe(true);
        const email = { key: "e-mail", display: "e-mail", letters: 5 };
        expect(checkWordAnswer("email", email, audio).correct).toBe(true);
    });
});

describe("buildLetterSlots", () => {
    test("one slot per letter, gaps for spaces, symbols kept", () => {
        const slots = buildLetterSlots("T-shirt", "ts", 0);
        expect(slots.map(slot => slot.kind)).toEqual(["letter", "symbol", "letter", "letter", "letter", "letter", "letter"]);
        expect(slots[0].value).toBe("t");
        expect(slots[2].value).toBe("s");
        expect(buildLetterSlots("hot dog").some(slot => slot.kind === "gap")).toBe(true);
    });

    test("revealed letters show as hints in empty slots", () => {
        const slots = buildLetterSlots("apple", "", 2);
        expect(slots[0].hint).toBe("a");
        expect(slots[1].hint).toBe("p");
        expect(slots[2].hint).toBe("");
    });
});
