import { diffSpokenWords } from "./speakingWordDiff";

const off = list => list.filter(word => !word.ok).map(word => word.text);

describe("diffSpokenWords", () => {
    it("標出題目裡沒聽到的字，以及聽到但題目沒有的字", () => {
        const result = diffSpokenWords("I like red apples.", "I like bed apples");
        expect(off(result.expected)).toEqual(["red"]);
        expect(off(result.heard)).toEqual(["bed"]);
    });

    it("漏說的字在題目那一行標出來", () => {
        const result = diffSpokenWords("I like red apples.", "I like apples");
        expect(off(result.expected)).toEqual(["red"]);
        expect(off(result.heard)).toEqual([]);
    });

    it("縮寫與大小寫不算錯，th 被聽成 s 也不算錯（和評分一致）", () => {
        expect(off(diffSpokenWords("It's her mouth.", "it is her mouse").expected)).toEqual([]);
        expect(off(diffSpokenWords("It is her mouth.", "It's her mouse.").heard)).toEqual([]);
    });

    it("順序不對時只算對到的部分", () => {
        const result = diffSpokenWords("I like apples", "apples like I");
        expect(result.expected.filter(word => word.ok)).toHaveLength(1);
    });
});
