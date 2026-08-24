import { isReceivableEmail } from "./emailValidation";

describe("isReceivableEmail", () => {
    it("accepts a normal mailbox", () => {
        expect(isReceivableEmail("student@gmail.com")).toBe(true);
    });

    it.each([
        "student@example.com",
        "student@example.invalid",
        "student@localhost",
        "not-an-email"
    ])("rejects placeholder or invalid address %s", email => {
        expect(isReceivableEmail(email)).toBe(false);
    });
});
