import fs from "fs";
import path from "path";

// 深色色票必須是固定色碼；如果被批次工具改成 var(--ae-xxx, …)，會變成自己指向自己，整個深色就壞掉。
describe("dark theme tokens", () => {
    const css = fs.readFileSync(path.join(__dirname, "theme.scss"), "utf8");
    const darkStart = css.indexOf(":root[data-theme='dark'] {");
    const block = css.slice(darkStart, css.indexOf("}", darkStart));

    it("defines every token with a plain colour", () => {
        const names = ["page", "surface", "surface-muted", "surface-glass", "text", "text-muted", "accent", "success", "danger", "warning", "border", "solid", "icon"];
        for (const name of names) {
            const line = block.split("\n").find(row => row.trim().startsWith(`--ae-${name}:`));
            expect(line).toBeTruthy();
            expect(line).not.toContain("var(");
            expect(line).toMatch(/#[0-9a-fA-F]{3,8};|rgba\(/);
        }
    });

    it("never references another token inside its own definitions", () => {
        expect(block).not.toContain("var(--ae-");
    });

    it("keeps the light theme free of variables so original colours are used", () => {
        const lightStart = css.indexOf(":root {");
        const light = css.slice(lightStart, css.indexOf("}", lightStart));
        expect(light).not.toContain("--ae-");
    });
});
