export type PublicErrorResponse = {
    status: number;
    payload: {
        error: string;
        code: string | null;
    };
};

export const toPublicErrorResponse = (
    error: unknown,
    fallbackMessage: string
): PublicErrorResponse => {
    const candidateStatus = Number((error as { status?: unknown } | null)?.status);
    const status = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599
        ? candidateStatus
        : 500;

    if (status >= 500) {
        return {
            status,
            payload: { error: fallbackMessage, code: null }
        };
    }

    const candidateMessage = (error as { message?: unknown } | null)?.message;
    const candidateCode = (error as { code?: unknown } | null)?.code;
    return {
        status,
        payload: {
            error: typeof candidateMessage === "string" && candidateMessage.trim()
                ? candidateMessage
                : fallbackMessage,
            code: typeof candidateCode === "string" && candidateCode.trim()
                ? candidateCode
                : null
        }
    };
};
