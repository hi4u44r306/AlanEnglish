import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
    clearStudentSession,
    getCachedStudentProfile,
    loadStudentProfile,
    logoutCurrentUser
} from "./authService";
import { AuthProvider, useAuth } from "./AuthContext";
import { disconnectWebPushOnLogout, unsubscribeBrowserPush } from "../services/webPushService";

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
jest.mock("../services/webPushService", () => ({
    disconnectWebPushOnLogout: jest.fn(),
    unsubscribeBrowserPush: jest.fn()
}));

const SessionState = () => {
    const { isAuthenticated, studentProfile, logout } = useAuth();
    return <div>{isAuthenticated ? studentProfile.email : "signed-out"}<button onClick={logout}>登出</button></div>;
};

describe("AuthProvider", () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        disconnectWebPushOnLogout.mockResolvedValue();
        unsubscribeBrowserPush.mockResolvedValue();
        logoutCurrentUser.mockResolvedValue();
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

    it("disconnects this device's push before signing out", async () => {
        const firebaseUser = { uid: "student-1", email: "student@gmail.com" };
        const profile = { id: 67, role: "student", email: firebaseUser.email };
        getCachedStudentProfile.mockReturnValue(profile);
        loadStudentProfile.mockResolvedValue(profile);
        onAuthStateChanged.mockImplementation((_authentication, callback) => {
            callback(firebaseUser);
            return jest.fn();
        });
        render(<AuthProvider><SessionState /></AuthProvider>);
        await screen.findByText(firebaseUser.email);
        fireEvent.click(screen.getByRole("button", { name: "登出" }));
        await waitFor(() => expect(logoutCurrentUser).toHaveBeenCalledTimes(1));
        expect(disconnectWebPushOnLogout).toHaveBeenCalledWith(firebaseUser);
        expect(disconnectWebPushOnLogout.mock.invocationCallOrder[0])
            .toBeLessThan(logoutCurrentUser.mock.invocationCallOrder[0]);
    });
});
