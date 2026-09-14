import { alphabetRetryTip } from "./alphabetRetryTip";

describe("alphabetRetryTip", () => {
    it("為容易混淆的字母提供專屬、兒童可理解的提示", () => {
        expect(alphabetRetryTip("b")).toContain("嘴唇");
        expect(alphabetRetryTip("O")).toContain("圓圓");
        expect(alphabetRetryTip("w")).toContain("double u");
        expect(alphabetRetryTip("z")).toContain("see");
    });

    it("其他字母保留簡短通用提示", () => {
        expect(alphabetRetryTip("A")).toContain("慢慢說");
        expect(alphabetRetryTip("")).toContain("慢慢說");
    });
});
