import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { authentication } from "../components/Pages/firebase-config";
import { clearStudentSession, loadStudentProfile } from "./authService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [studentProfile, setStudentProfile] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(authentication, async (user) => {
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
            } finally {
                setAuthLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    const value = useMemo(() => ({
        firebaseUser,
        studentProfile,
        role: studentProfile?.role || null,
        authLoading,
        isAuthenticated: Boolean(firebaseUser && studentProfile),
        setStudentProfile
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