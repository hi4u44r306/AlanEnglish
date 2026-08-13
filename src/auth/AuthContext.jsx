import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { authentication } from "../components/Pages/firebase-config";
import {
    clearStudentSession,
    loadStudentProfile,
    logoutCurrentUser
} from "./authService";
import { recordHeartbeat } from "../services/learningActivityService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [studentProfile, setStudentProfile] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(authentication, async user => {
            setAuthLoading(true);

            if (!user) {
                clearStudentSession();
                setFirebaseUser(null);
                setStudentProfile(null);
                setAuthLoading(false);
                return;
            }

            try {
                const profile = await loadStudentProfile(user);
                setFirebaseUser(user);
                setStudentProfile(profile);
            } catch (error) {
                console.error("恢復登入狀態失敗:", error);
                clearStudentSession();
                setFirebaseUser(null);
                setStudentProfile(null);

                try {
                    await signOut(authentication);
                } catch (signOutError) {
                    console.error("清除無效 Firebase Session 失敗:", signOutError);
                }
            } finally {
                setAuthLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!firebaseUser) return undefined;

        let disposed = false;

        const sendHeartbeat = async () => {
            if (disposed || document.visibilityState === "hidden") return;

            try {
                await recordHeartbeat(firebaseUser);
            } catch (error) {
                console.warn("更新最後活躍時間失敗:", error);
            }
        };

        sendHeartbeat();
        const intervalId = window.setInterval(sendHeartbeat, 5 * 60 * 1000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") sendHeartbeat();
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            disposed = true;
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [firebaseUser]);

    const logout = async () => {
        setAuthLoading(true);

        try {
            await logoutCurrentUser();
        } finally {
            setFirebaseUser(null);
            setStudentProfile(null);
            setAuthLoading(false);
        }
    };

    const value = useMemo(() => ({
        firebaseUser,
        studentProfile,
        role: studentProfile?.role || null,
        authLoading,
        isAuthenticated: Boolean(firebaseUser && studentProfile),
        setStudentProfile,
        logout
    }), [firebaseUser, studentProfile, authLoading]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth 必須在 AuthProvider 裡使用");
    }

    return context;
};
