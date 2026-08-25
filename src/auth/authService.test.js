import { getMembershipProfile } from "../services/membershipService";
import { loadStudentProfile, normalizeLoginIdentifier } from "./authService";

jest.mock("firebase/auth", () => ({
    browserLocalPersistence: {},
    setPersistence: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    signOut: jest.fn()
}));
jest.mock("../components/Pages/firebase-config", () => ({ authentication: {} }));
jest.mock("../services/learningActivityService", () => ({ recordLoginActivity: jest.fn() }));
jest.mock("../services/membershipService", () => ({ getMembershipProfile: jest.fn() }));

describe("loadStudentProfile", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("shares one profile request between Login and AuthContext", async () => {
        const firebaseUser = { uid: "student-1", email: "student@gmail.com" };
        const profile = { id: 67, role: "student", email: firebaseUser.email };
        let resolveProfile;

        getMembershipProfile.mockReturnValueOnce(new Promise(resolve => {
            resolveProfile = resolve;
        }));

        const loginRequest = loadStudentProfile(firebaseUser);
        const authContextRequest = loadStudentProfile(firebaseUser);

        expect(getMembershipProfile).toHaveBeenCalledTimes(1);
        resolveProfile({ profile });

        await expect(Promise.all([loginRequest, authContextRequest])).resolves.toEqual([profile, profile]);
        expect(JSON.parse(localStorage.getItem("ae-profile-cache-v1"))).toMatchObject(profile);
    });
});

describe("normalizeLoginIdentifier", () => {
    it("keeps real email accounts and maps academy usernames to the internal Firebase identifier", () => {
        expect(normalizeLoginIdentifier(" Parent@Gmail.com ")).toBe("parent@gmail.com");
        expect(normalizeLoginIdentifier(" alanchen01 ")).toBe("alanchen01@login.alanenglish.com.tw");
    });

    it("rejects malformed academy usernames before calling Firebase", () => {
        expect(() => normalizeLoginIdentifier("12")).toThrow("登入帳號格式不正確");
    });
});
