import { browserLocalPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { authentication } from "../components/Pages/firebase-config";
import { recordLoginActivity } from "../services/learningActivityService";
import { getMembershipProfile } from "../services/membershipService";

const PROFILE_CACHE_KEY = "ae-profile-cache-v1";

const STORAGE_KEYS = [
    "ae-useruid",
    "ae-studentid",
    "ae-username",
    "ae-class",
    "ae-userimage",
    "ae-plan",
    "ae-role",
    "ae-teacherschool",
    PROFILE_CACHE_KEY
];

export const saveStudentSession = (firebaseUser, student) => {
    const normalizedProfile = {
        ...student,
        firebase_uid: student.firebase_uid || firebaseUser.uid,
        cached_at: Date.now()
    };

    localStorage.setItem("ae-useruid", firebaseUser.uid);
    localStorage.setItem("ae-studentid", String(student.id || ""));
    localStorage.setItem("ae-username", student.name || firebaseUser.email?.split("@")[0] || "");
    localStorage.setItem("ae-class", student.class || "");
    localStorage.setItem("ae-userimage", student.user_image || student.userimage || "");
    localStorage.setItem("ae-plan", student.plan || "");
    localStorage.setItem("ae-role", student.role || "student");
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(normalizedProfile));
};

export const getCachedStudentProfile = firebaseUid => {
    try {
        const raw = localStorage.getItem(PROFILE_CACHE_KEY);
        if (!raw) return null;

        const profile = JSON.parse(raw);
        if (!profile || typeof profile !== "object") return null;
        if (!profile.id || !profile.role) return null;

        const cachedUid = String(profile.firebase_uid || localStorage.getItem("ae-useruid") || "");
        if (firebaseUid && cachedUid && cachedUid !== String(firebaseUid)) return null;

        return profile;
    } catch (error) {
        console.warn("讀取登入快取失敗:", error);
        return null;
    }
};

export const clearStudentSession = () => {
    STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
};

export const loadStudentProfile = async firebaseUser => {
    if (!firebaseUser?.uid) throw new Error("找不到 Firebase 使用者資料");
    const result = await getMembershipProfile(firebaseUser);
    if (!result?.profile?.id) throw new Error("Firebase 登入成功，但找不到 Alan English 使用者資料");
    saveStudentSession(firebaseUser, result.profile);
    return result.profile;
};

export const loginWithEmail = async (email, password) => {
    await setPersistence(authentication, browserLocalPersistence);

    const credential = await signInWithEmailAndPassword(
        authentication,
        email.trim().toLowerCase(),
        password
    );

    try {
        const student = await loadStudentProfile(credential.user);

        try {
            await recordLoginActivity(credential.user);
        } catch (activityError) {
            console.warn("登入成功，但登入活動紀錄失敗:", activityError);
        }

        return { firebaseUser: credential.user, student };
    } catch (error) {
        await signOut(authentication);
        clearStudentSession();
        throw error;
    }
};

export const logoutCurrentUser = async () => {
    try {
        await signOut(authentication);
    } finally {
        clearStudentSession();
    }
};
