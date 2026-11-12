// 單字大挑戰：由前端字庫 wordBank.v1.json 產生「伺服器版字庫」。
// 伺服器（Edge Function）只放有中文題目的字，且只有判斷答案、出題用得到的欄位；不含辭典來源與同音字。
// 用法：node scripts/word-challenge/generate-server-bank.mjs   （同樣輸入一定產生同樣檔案）
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
export const BANK_PATH = path.join(repoRoot, "src/data/wordChallenge/wordBank.v1.json");
export const SERVER_BANK_PATH = path.join(repoRoot, "supabase/functions/_shared/word-challenge-bank.generated.ts");

export const SERVER_FIELDS = ["key", "display", "level", "letters", "gloss", "properNoun", "ukSpellings", "alternates"];

export function serverWords(bank) {
    return bank.words.filter(word => word.gloss).map(word => {
        const picked = {};
        for (const field of SERVER_FIELDS) if (word[field] !== undefined) picked[field] = word[field];
        return picked;
    });
}

export function buildServerBankSource(bank) {
    const words = serverWords(bank);
    return [
        "// 本檔由 scripts/word-challenge/generate-server-bank.mjs 自動產生，請勿手改。",
        `// 來源：src/data/wordChallenge/wordBank.v1.json（字庫版本 ${bank.meta.bankVersion}，共 ${words.length} 個有中文題目的字）`,
        "export type ServerWord = {",
        "    key: string;",
        "    display: string;",
        "    level: number;",
        "    letters: number;",
        "    gloss: string;",
        "    properNoun?: boolean;",
        "    ukSpellings?: string[];",
        "    alternates?: string[];",
        "};",
        "",
        `export const WORD_BANK_VERSION = ${JSON.stringify(bank.meta.bankVersion)};`,
        "",
        "export const WORD_BANK: readonly ServerWord[] = [",
        ...words.map(word => `    ${JSON.stringify(word)},`),
        "];",
        ""
    ].join("\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    const bank = JSON.parse(readFileSync(BANK_PATH, "utf8"));
    writeFileSync(SERVER_BANK_PATH, buildServerBankSource(bank), "utf8");
    console.log(`寫入 ${path.relative(repoRoot, SERVER_BANK_PATH)}：${serverWords(bank).length} 字`);
}
