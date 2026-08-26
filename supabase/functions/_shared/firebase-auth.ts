import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const FIREBASE_PROJECT_ID = "alan-english-listening";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export const cleanText = (value: unknown, maxLength = 300) => String(value || "")
    .trim()
    .slice(0, maxLength);

export type VerifiedAlanUser = {
    id: number;
    firebase_uid: string;
    name: string;
    chinese_name: string | null;
    english_name: string | null;
    email: string | null;
    class: string | null;
    role: string;
    learner_type: string | null;
    account_status: string;
};

export async function verifyFirebaseRequest(req: Request, admin: any): Promise<VerifiedAlanUser> {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) throw Object.assign(new Error("請先登入 Alan English"), { status: 401 });

    let uid = "";
    try {
        const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
            issuer: FIREBASE_ISSUER,
            audience: FIREBASE_PROJECT_ID
        });
        uid = cleanText(payload.sub, 200);
    } catch {
        throw Object.assign(new Error("登入驗證失敗，請重新登入"), { status: 401 });
    }
    if (!uid) throw Object.assign(new Error("登入驗證失敗，請重新登入"), { status: 401 });

    const { data, error } = await admin
        .from("students")
        .select("id,firebase_uid,name,chinese_name,english_name,email,class,role,learner_type,account_status")
        .eq("firebase_uid", uid)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("找不到 Alan English 帳號"), { status: 404 });
    if (data.account_status && data.account_status !== "active") {
        throw Object.assign(new Error("這個帳號目前已停用"), { status: 403 });
    }
    return data as VerifiedAlanUser;
}
