import { supabaseKey, supabaseUrl } from "../components/Pages/supabase-config";

const callAuthEmail = async (body, firebaseUser = null) => {
    const firebaseToken = firebaseUser?.getIdToken
        ? await firebaseUser.getIdToken(true)
        : null;
    const response = await fetch(`${supabaseUrl}/functions/v1/auth-email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            ...(firebaseToken ? { Authorization: `Bearer ${firebaseToken}` } : {})
        },
        body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result?.error || "Email 服務暫時無法使用");
        error.status = response.status;
        throw error;
    }
    return result;
};

export const sendBrandedVerificationEmail = (firebaseUser, continuePath = "/student/membership") => callAuthEmail(
    { action: "send_verification", continue_path: continuePath },
    firebaseUser
);

export const sendBrandedPasswordResetEmail = email => callAuthEmail({
    action: "send_password_reset",
    email: String(email || "").trim().toLowerCase()
});
