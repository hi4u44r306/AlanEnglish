import {
    supabaseKey,
    supabaseUrl
} from "../components/Pages/supabase-config";

export class AcademyStudentServiceError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = "AcademyStudentServiceError";
        this.code = options.code || "ACADEMY_STUDENT_SERVICE_ERROR";
        this.status = options.status || 0;
        this.details = options.details || null;
    }
}

const requireFirebaseUser = firebaseUser => {
    if (!firebaseUser || typeof firebaseUser.getIdToken !== "function") {
        throw new AcademyStudentServiceError("請先登入後再操作", {
            code: "AUTH_REQUIRED",
            status: 401
        });
    }
};

const callAcademyStudentManager = async (
    firebaseUser,
    body,
    { allowAnonymous = false } = {}
) => {
    if (!allowAnonymous) requireFirebaseUser(firebaseUser);

    const firebaseToken = firebaseUser && typeof firebaseUser.getIdToken === "function"
        ? await firebaseUser.getIdToken(true)
        : null;

    let response;

    try {
        response = await fetch(
            `${supabaseUrl}/functions/v1/academy-student-manager`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(firebaseToken ? { Authorization: `Bearer ${firebaseToken}` } : {}),
                    apikey: supabaseKey
                },
                body: JSON.stringify(body)
            }
        );
    } catch (error) {
        throw new AcademyStudentServiceError(
            "無法連線至學生帳號服務，請檢查網路後重試",
            {
                code: "NETWORK_ERROR",
                details: error
            }
        );
    }

    const result = await response
        .json()
        .catch(() => ({}));

    if (!response.ok || result?.success === false) {
        throw new AcademyStudentServiceError(
            result?.error || "學生帳號服務暫時無法使用",
            {
                code: result?.code || "REQUEST_FAILED",
                status: response.status,
                details: result
            }
        );
    }

    return result;
};

const normalizeOptionalText = value => {
    if (typeof value !== "string") return null;

    const normalized = value.trim();
    return normalized || null;
};

const normalizeStudentPayload = student => ({
    login_username: String(
        student?.login_username ??
        student?.loginUsername ??
        student?.username ??
        ""
    ).trim().toLowerCase().replace(/[^a-z0-9]/g, ""),

    chinese_name: String(
        student?.chinese_name ??
        student?.chineseName ??
        ""
    ).trim(),

    english_name: normalizeOptionalText(
        student?.english_name ??
        student?.englishName
    ),

    class_code: String(
        student?.class_code ??
        student?.classCode ??
        student?.class ??
        ""
    ).trim().toUpperCase(),

    guardian_name: normalizeOptionalText(
        student?.guardian_name ??
        student?.guardianName
    ),

    guardian_email: normalizeOptionalText(
        student?.guardian_email ??
        student?.guardianEmail
    )?.toLowerCase() || null,

    guardian_phone: normalizeOptionalText(
        student?.guardian_phone ??
        student?.guardianPhone
    ),

    enrolled_at: String(
        student?.enrolled_at ??
        student?.enrolledAt ??
        ""
    ).trim(),

    access_ends_at: normalizeOptionalText(
        student?.access_ends_at ??
        student?.accessEndsAt
    ),

    notes: normalizeOptionalText(student?.notes)
});

export const listAcademyClasses = async firebaseUser => {
    const result = await callAcademyStudentManager(
        firebaseUser,
        {
            action: "list_classes"
        }
    );

    return Array.isArray(result?.classes)
        ? result.classes
        : [];
};

export const createAcademyStudent = async (
    firebaseUser,
    student
) => {
    return callAcademyStudentManager(
        firebaseUser,
        {
            action: "create_student",
            ...normalizeStudentPayload(student)
        }
    );
};

export const reissueAcademyStudentLoginCard = async (firebaseUser, studentId) => (
    callAcademyStudentManager(
        firebaseUser,
        {
            action: "reissue_student_login_card",
            student_id: Number(studentId)
        }
    )
);

export const createAcademyInvitation = async (
    firebaseUser,
    student
) => callAcademyStudentManager(
    firebaseUser,
    {
        action: "create_invitation",
        ...normalizeStudentPayload(student),
        login_email: String(
            student?.login_email ?? student?.loginEmail ?? student?.email ?? ""
        ).trim().toLowerCase()
    }
);

export const previewAcademyInvitation = async (token, accountEmail = "") => callAcademyStudentManager(
    null,
    {
        action: "preview_invitation",
        token,
        account_email: String(accountEmail || "").trim().toLowerCase()
    },
    { allowAnonymous: true }
);

export const claimAcademyInvitation = async (
    firebaseUser,
    token,
    dateOfBirth = null
) => callAcademyStudentManager(
    firebaseUser,
    { action: "claim_invitation", token, date_of_birth: dateOfBirth }
);

export const activateAcademyInvitation = async (
    firebaseUser,
    token
) => callAcademyStudentManager(
    firebaseUser,
    { action: "activate_invitation", token }
);

export const previewAcademyStudents = async (
    firebaseUser,
    students
) => {
    if (!Array.isArray(students) || students.length === 0) {
        throw new AcademyStudentServiceError(
            "沒有可以預覽的學生資料",
            {
                code: "STUDENT_ROWS_REQUIRED",
                status: 400
            }
        );
    }

    return callAcademyStudentManager(
        firebaseUser,
        {
            action: "preview_students",
            rows: students.map(normalizeStudentPayload)
        }
    );
};

export const createAcademyStudentsBatch = async (
    firebaseUser,
    students,
    requestId
) => {
    if (!Array.isArray(students) || students.length === 0) {
        throw new AcademyStudentServiceError(
            "沒有可以批次建立的學生資料",
            {
                code: "STUDENT_ROWS_REQUIRED",
                status: 400
            }
        );
    }

    return callAcademyStudentManager(
        firebaseUser,
        {
            action: "batch_create_students",
            request_id: String(requestId || "").trim(),
            rows: students.map(normalizeStudentPayload)
        }
    );
};

export const listAcademyInvitations = async firebaseUser => {
    const result = await callAcademyStudentManager(
        firebaseUser,
        { action: "list_invitations" }
    );

    return Array.isArray(result?.invitations)
        ? result.invitations
        : [];
};

export const deleteAcademyStudentAccount = async (
    firebaseUser,
    studentId,
    confirmationEmail
) => callAcademyStudentManager(
    firebaseUser,
    {
        action: "delete_student_account",
        student_id: Number(studentId),
        confirmation_email: String(confirmationEmail || "").trim().toLowerCase()
    }
);

export const previewStudentActivation = async token => callAcademyStudentManager(
    null,
    { action: "preview_student_activation", token: String(token || "").trim() },
    { allowAnonymous: true }
);

export const activateStudentLogin = async (token, password) => callAcademyStudentManager(
    null,
    {
        action: "activate_student_login",
        token: String(token || "").trim(),
        password: String(password || "")
    },
    { allowAnonymous: true }
);

export const recoverStudentLogin = async (username, recoveryCode, password) => callAcademyStudentManager(
    null,
    {
        action: "recover_student_login",
        username: String(username || "").trim().toLowerCase(),
        recovery_code: String(recoveryCode || "").trim(),
        password: String(password || "")
    },
    { allowAnonymous: true }
);

export const deleteAcademyInvitation = async (
    firebaseUser,
    invitationId,
    confirmationEmail
) => callAcademyStudentManager(
    firebaseUser,
    {
        action: "delete_invitation",
        invitation_id: Number(invitationId),
        confirmation_email: String(confirmationEmail || "").trim().toLowerCase()
    }
);

export const sendAcademyPasswordReset = async (firebaseUser, email) => (
    callAcademyStudentManager(
        firebaseUser,
        {
            action: "send_password_reset",
            email: String(email || "").trim().toLowerCase()
        }
    )
);

export const markAcademyPasswordChanged = async firebaseUser => {
    return callAcademyStudentManager(
        firebaseUser,
        {
            action: "mark_password_changed"
        }
    );
};

const academyStudentService = {
    listAcademyClasses,
    createAcademyStudent,
    createAcademyInvitation,
    previewAcademyInvitation,
    claimAcademyInvitation,
    activateAcademyInvitation,
    previewStudentActivation,
    activateStudentLogin,
    recoverStudentLogin,
    previewAcademyStudents,
    createAcademyStudentsBatch,
    listAcademyInvitations,
    deleteAcademyStudentAccount,
    deleteAcademyInvitation,
    sendAcademyPasswordReset,
    markAcademyPasswordChanged
};

export default academyStudentService;
