import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { authentication } from "../components/Pages/firebase-config";
import {
    clearStudentSession,
    getCachedStudentProfile,
    loadStudentProfile,
    logoutCurrentUser
} from "./authService";
import { recordHeartbeat } from "../services/learningActivityService";
import { disconnectWebPushOnLogout, unsubscribeBrowserPush } from "../services/webPushService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [studentProfile, setStudentProfile] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [profileRefreshing, setProfileRefreshing] = useState(false);
    const lastFirebaseUid = useRef(null);

    useEffect(() => {
        let disposed = false;

        const unsubscribe = onAuthStateChanged(authentication, async user => {
            if (disposed) return;

            if (!user) {
                lastFirebaseUid.current = null;
                await unsubscribeBrowserPush().catch(() => {});
                clearStudentSession();
                setFirebaseUser(null);
                setStudentProfile(null);
                setProfileRefreshing(false);
                setAuthLoading(false);
                return;
            }

            if (lastFirebaseUid.current && lastFirebaseUid.current !== user.uid) {
                await unsubscribeBrowserPush().catch(() => {});
            }
            lastFirebaseUid.current = user.uid;

            setFirebaseUser(user);
            const cachedProfile = getCachedStudentProfile(user.uid);

            if (cachedProfile) {
                setStudentProfile(cachedProfile);
                setAuthLoading(false);
                setProfileRefreshing(true);

                try {
                    const freshProfile = await loadStudentProfile(user);
                    if (!disposed) setStudentProfile(freshProfile);
                } catch (error) {
                    if (error?.code === "ACCOUNT_ARCHIVED") {
                        clearStudentSession();
                        setStudentProfile(null);
                        setFirebaseUser(null);
                        try {
                            await signOut(authentication);
                        } catch (signOutError) {
                            console.error("清除已停用帳號 Session 失敗:", signOutError);
                        }
                        return;
                    }
                    console.warn("背景更新帳號資料失敗，暫時保留已驗證 Session 的快取資料:", error);
                } finally {
                    if (!disposed) setProfileRefreshing(false);
                }

                return;
            }

            setAuthLoading(true);
            setProfileRefreshing(true);

            try {
                const profile = await loadStudentProfile(user);
                if (!disposed) setStudentProfile(profile);
            } catch (error) {
                console.error("恢復登入狀態失敗:", error);

                const recoveredProfile = getCachedStudentProfile(user.uid);

                if (recoveredProfile) {
                    setFirebaseUser(user);
                    setStudentProfile(recoveredProfile);
                    return;
                }

                clearStudentSession();
                setStudentProfile(null);

                const isOnboardingRoute = [
                    "/academy/invite",
                    "/freetrial"
                ].some(path => window.location.pathname.startsWith(path));

                if (isOnboardingRoute) {
                    setFirebaseUser(user);
                    return;
                }

                setFirebaseUser(null);

                try {
                    await signOut(authentication);
                } catch (signOutError) {
                    console.error("清除無效 Firebase Session 失敗:", signOutError);
                }
            } finally {
                if (!disposed) {
                    setProfileRefreshing(false);
                    setAuthLoading(false);
                }
            }
        });

        return () => {
            disposed = true;
            unsubscribe();
        };
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

    const refreshStudentProfile = useCallback(async () => {
        if (!firebaseUser) return null;
        setProfileRefreshing(true);
        try {
            const profile = await loadStudentProfile(firebaseUser);
            setStudentProfile(profile);
            return profile;
        } finally {
            setProfileRefreshing(false);
        }
    }, [firebaseUser]);

    const logout = useCallback(async () => {
        setAuthLoading(true);

        try {
            if (firebaseUser) await disconnectWebPushOnLogout(firebaseUser);
            await logoutCurrentUser();
        } finally {
            setFirebaseUser(null);
            setStudentProfile(null);
            setProfileRefreshing(false);
            setAuthLoading(false);
        }
    }, [firebaseUser]);

    const value = useMemo(() => ({
        firebaseUser,
        studentProfile,
        role: studentProfile?.role || null,
        authLoading,
        profileRefreshing,
        isAuthenticated: Boolean(firebaseUser && studentProfile),
        setStudentProfile,
        refreshStudentProfile,
        logout
    }), [firebaseUser, studentProfile, authLoading, profileRefreshing, refreshStudentProfile, logout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth 必須在 AuthProvider 裡使用");
    }

    return context;
};
