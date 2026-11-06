import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getMembershipProfile } from "../services/membershipService";
import { saveStudentSession } from "./authService";
import { AuthProvider, useAuth } from "./AuthContext";

// Real authService (session storage and cache rules); only Firebase and the network are mocked.
jest.mock("firebase/auth", () => ({
    browserLocalPersistence: {},
    setPersistence: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    onAuthStateChanged: jest.fn(),
    signOut: jest.fn()
}));
jest.mock("../components/Pages/firebase-config", () => ({ authentication: {} }));
jest.mock("../services/membershipService", () => ({ getMembershipProfile: jest.fn() }));
jest.mock("../services/learningActivityService", () => ({ recordHeartbeat: jest.fn(), recordLoginActivity: jest.fn() }));
jest.mock("../services/webPushService", () => ({
    disconnectWebPushOnLogout: jest.fn(() => Promise.resolve()),
    unsubscribeBrowserPush: jest.fn(() => Promise.resolve())
}));

const firebaseUser = { uid: "uid-student", email: "student@gmail.com" };
const profile = { id: 67, role: "student", name: "Student", email: firebaseUser.email };

const SessionState = () => {
    const { authLoading, isAuthenticated, studentProfile, firebaseUser: user } = useAuth();
    if (authLoading) return <div>loading</div>;
    return <div>{isAuthenticated ? `in:${studentProfile.email}` : `out:${user ? "firebase" : "none"}`}</div>;
};

const startWith = user => {
    onAuthStateChanged.mockImplementation((_auth, callback) => {
        callback(user);
        return jest.fn();
    });
    return render(<AuthProvider><SessionState /></AuthProvider>);
};

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/student/settings");
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("AuthProvider without a cached profile", () => {
    it("a failed profile load signs out and clears the session", async () => {
        localStorage.setItem("ae-role", "admin");
        getMembershipProfile.mockRejectedValue(new Error("profile unavailable"));
        signOut.mockResolvedValue();
        startWith(firebaseUser);
        expect(await screen.findByText("out:none")).toBeInTheDocument();
        expect(signOut).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem("ae-role")).toBeNull();
    });

    it("a failed signOut still leaves the app signed out with the session cleared", async () => {
        localStorage.setItem("ae-useruid", firebaseUser.uid);
        getMembershipProfile.mockRejectedValue(new Error("profile unavailable"));
        signOut.mockRejectedValue(new Error("network down"));
        startWith(firebaseUser);
        expect(await screen.findByText("out:none")).toBeInTheDocument();
        expect(localStorage.getItem("ae-useruid")).toBeNull();
    });

    it("another user's cached profile is not used to recover the session", async () => {
        saveStudentSession({ uid: "uid-admin" }, { id: 1, role: "admin", name: "Admin", email: "admin@gmail.com" });
        getMembershipProfile.mockRejectedValue(new Error("profile unavailable"));
        signOut.mockResolvedValue();
        startWith(firebaseUser);
        expect(await screen.findByText("out:none")).toBeInTheDocument();
        expect(screen.queryByText(/admin@gmail.com/)).not.toBeInTheDocument();
        expect(signOut).toHaveBeenCalledTimes(1);
    });
});

describe("AuthProvider background refresh of a cached profile", () => {
    beforeEach(() => saveStudentSession(firebaseUser, profile));

    it("ACCOUNT_ARCHIVED signs out, clears the cache and shows signed-out", async () => {
        getMembershipProfile.mockRejectedValue(Object.assign(new Error("停用"), { status: 403, code: "ACCOUNT_ARCHIVED" }));
        signOut.mockResolvedValue();
        startWith(firebaseUser);
        await waitFor(() => expect(screen.getByText("out:none")).toBeInTheDocument());
        expect(signOut).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem("ae-profile-cache-v2")).toBeNull();
        expect(localStorage.getItem("ae-useruid")).toBeNull();
    });

    it("ACCOUNT_ARCHIVED with a failing signOut is still signed out locally", async () => {
        getMembershipProfile.mockRejectedValue(Object.assign(new Error("停用"), { code: "ACCOUNT_ARCHIVED" }));
        signOut.mockRejectedValue(new Error("network down"));
        startWith(firebaseUser);
        await waitFor(() => expect(screen.getByText("out:none")).toBeInTheDocument());
        expect(localStorage.getItem("ae-profile-cache-v2")).toBeNull();
    });

    it("a transient refresh failure keeps the verified session on the cached profile", async () => {
        getMembershipProfile.mockRejectedValue(Object.assign(new Error("timeout"), { status: 503 }));
        startWith(firebaseUser);
        expect(await screen.findByText(`in:${profile.email}`)).toBeInTheDocument();
        await waitFor(() => expect(getMembershipProfile).toHaveBeenCalledTimes(1));
        expect(signOut).not.toHaveBeenCalled();
        expect(localStorage.getItem("ae-useruid")).toBe(firebaseUser.uid);
    });
});
