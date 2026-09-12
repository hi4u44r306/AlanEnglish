import fs from "fs";
import path from "path";

const read = file => fs.readFileSync(path.join(__dirname, file), "utf8");
const securitySource = read("AccountSecurity.jsx");
const supportSource = read("Support.jsx");

describe("student account support UI contract", () => {
    test("uses direct instructions for student password changes", () => {
        expect(securitySource).toContain('role === "student" ? "更改密碼"');
        expect(securitySource).toContain("輸入目前密碼，再設定一組新密碼。");
        expect(securitySource).toContain('role === "student" ? "student-account-security"');
    });

    test("keeps the teacher and admin security heading", () => {
        expect(securitySource).toContain('"帳號與密碼"');
    });

    test("uses a friendly support heading and preserves the secret warning", () => {
        expect(supportSource).toContain("需要幫忙嗎？");
        expect(supportSource).toContain("請不要填寫密碼或信用卡完整號碼");
    });
});
