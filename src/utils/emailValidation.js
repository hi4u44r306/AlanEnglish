const RESERVED_EMAIL_DOMAINS = new Set([
    "example.com",
    "example.net",
    "example.org",
    "example.invalid",
    "localhost"
]);

export const RECEIVABLE_EMAIL_HELP =
    "請使用本人或家長可以正常收信的 Email；系統會寄送驗證與密碼重設信，請勿填寫虛構或臨時信箱。";

export const isReceivableEmail = value => {
    const email = String(value || "").trim().toLowerCase();
    const atIndex = email.lastIndexOf("@");

    if (atIndex <= 0 || atIndex === email.length - 1) {
        return false;
    }

    const domain = email.slice(atIndex + 1);
    return !domain.endsWith(".invalid") && !RESERVED_EMAIL_DOMAINS.has(domain);
};
