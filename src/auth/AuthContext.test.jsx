import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
    clearStudentSession,
    getCachedStudentProfile,
    loadStudentProfile
} from "./authService";
import { AuthProvider, useAuth } from "./AuthContext";

jest.mock("firebase/auth", () => ({
    onAuthStateChanged: jest.fn(),
    signOut: jest.fn()
}));
jest.mock("../components/Pages/firebase-config", () => ({ authentication: {} }));
jest.mock("./authService", () => ({
    clearStudentSession: jest.fn(),
    getCachedStudentProfile: jest.fn(),
    loadStudentProfile: jest.fn(),
    logoutCurrentUser: jest.fn()
}));
jest.mock("../services/learningActivityService", () => ({ recordHeartbeat: jest.fn() }));

const SessionState = () => {
    const { isAuthenticated, studentProfile } = useAuth();
    return <div>{isAuthenticated ? studentProfile.email : "signed-out"}</div>;
};

describe("AuthProvider", () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => consoleErrorSpy.mockRestore());

    it("keeps the Firebase session when a concurrent login has already cached the profile", async () => {
        const firebaseUser = { uid: "student-1", email: "student@gmail.com" };
        const recoveredProfile = { id: 67, role: "student", email: firebaseUser.email };

        getCachedStudentProfile
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(recoveredProfile);
        loadStudentProfile.mockRejectedValueOnce(new Error("temporary profile request failure"));
        onAuthStateChanged.mockImplementation((_authentication, callback) => {
            callback(firebaseUser);
            return jest.fn();
        });

        render(<AuthProvider><SessionState /></AuthProvider>);

        expect(await screen.findByText(firebaseUser.email)).toBeInTheDocument();
        await waitFor(() => expect(loadStudentProfile).toHaveBeenCalledTimes(1));
        expect(clearStudentSession).not.toHaveBeenCalled();
        expect(signOut).not.toHaveBeenCalled();
    });
});
