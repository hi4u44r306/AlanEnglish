import { browserLocalPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { authentication } from "../components/Pages/firebase-config";
import { supabase } from "../components/Pages/supabase-config";
import { recordLoginActivity } from "../services/learningActivityService";

const STORAGE_KEYS = [
    "ae-useruid",
    "ae-studentid",
    "ae-username",
    "ae-class",
    "ae-userimage",
    "ae-plan",
    "ae-role",
    "ae-teacherschool"
];

export const saveStudentSession = (firebaseUser, student) => {
    localStorage.setItem("ae-useruid", firebaseUser.uid);
    localStorage.setItem("ae-studentid", String(student.id || ""));
    localStorage.setItem("ae-username", student.name || firebaseUser.email?.split("@")[0] || "");
    localStorage.setItem("ae-class", student.class || "");
    localStorage.setItem("ae-userimage", student.user_image || student.userimage || "");
    localStorage.setItem("ae-plan", student.plan || "");
    localStorage.setItem("ae-role", student.role || "student");
};

export const clearStudentSession = () => {
    STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
};

const findStudentByUid = async uid => {
    return await supabase
        .from("students")
        .select("*")
        .eq("firebase_uid", uid)
        .maybeSingle();
};

const findStudentByEmail = async email => {
    if (!email) return { data: null, error: null };

    return await supabase
        .from("students")
        .select("*")
        .ilike("email", email.trim().toLowerCase())
        .maybeSingle();
};

export const loadStudentProfile = async firebaseUser => {
    if (!firebaseUser?.uid) throw new Error("找不到 Firebase 使用者資料");

    const { data: studentByUid, error: uidError } = await findStudentByUid(firebaseUser.uid);
    if (uidError) throw uidError;

    if (studentByUid) {
        saveStudentSession(firebaseUser, studentByUid);
        return studentByUid;
    }

    const { data: studentByEmail, error: emailError } = await findStudentByEmail(firebaseUser.email);
    if (emailError) throw emailError;
    if (!studentByEmail) throw new Error("Firebase 登入成功，但 Supabase 找不到這位使用者");

    if (studentByEmail.firebase_uid && studentByEmail.firebase_uid !== firebaseUser.uid) {
        throw new Error("這個 Email 已綁定其他 Firebase 帳號");
    }

    let student = studentByEmail;

    if (!studentByEmail.firebase_uid) {
        const { data: updatedStudent, error: bindError } = await supabase
            .from("students")
            .update({
                firebase_uid: firebaseUser.uid,
                updated_at: new Date().toISOString()
            })
            .eq("id", studentByEmail.id)
            .select("*")
            .single();

        if (bindError) throw bindError;
        student = updatedStudent;
    }

    saveStudentSession(firebaseUser, student);
    return student;
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
