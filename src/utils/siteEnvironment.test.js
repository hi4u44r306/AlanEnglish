import { isStudentStagingSite, STUDENT_STAGING_ORIGIN } from "./siteEnvironment";

describe("student staging environment", () => {
    test("只辨識固定的 Alan English staging 網域", () => {
        expect(STUDENT_STAGING_ORIGIN).toBe("https://alanenglish-student-test.netlify.app");
        expect(isStudentStagingSite("alanenglish-student-test.netlify.app")).toBe(true);
        expect(isStudentStagingSite("ALANENGLISH-STUDENT-TEST.NETLIFY.APP")).toBe(true);
        expect(isStudentStagingSite("deploy-preview-44--alanenglish.netlify.app")).toBe(false);
        expect(isStudentStagingSite("alanenglish.com.tw")).toBe(false);
    });
});
