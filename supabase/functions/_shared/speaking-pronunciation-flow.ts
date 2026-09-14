export type SpeakingProviderClaim = {
    status: "claimed" | "busy" | "invalid";
    claimToken?: string;
    retryAfterSeconds?: number;
};

export type SpeakingProviderAssessment<TValue, TFailure> =
    | { ok: true; value: TValue }
    | {
        ok: false;
        failure: TFailure;
        ledgerStatus: "provider_failed" | "unassessable";
        errorCode: string;
    };

type SpeakingProviderFlowOptions<TValue, TAttempt, TRound, TFailure> = {
    foundationRound: boolean;
    claim?: () => Promise<SpeakingProviderClaim>;
    reserve: () => Promise<string>;
    assess: () => Promise<SpeakingProviderAssessment<TValue, TFailure>>;
    saveAttempt?: (value: TValue) => Promise<TAttempt>;
    saveAndRecordRound?: (value: TValue, claimToken: string) => Promise<{ attempt: TAttempt; round: TRound }>;
    finishRequest: (requestId: string, status: string, errorCode: string | null) => Promise<void>;
    releaseClaim?: (claimToken: string) => Promise<boolean>;
    warn?: (message: string) => void;
};

export type SpeakingProviderFlowResult<TValue, TAttempt, TRound, TFailure> =
    | { status: "busy"; retryAfterSeconds: number }
    | { status: "invalid" }
    | { status: "provider_failure"; failure: TFailure }
    | { status: "completed"; value: TValue; attempt: TAttempt; round: TRound | null };

export const runSpeakingPronunciationFlow = async <TValue, TAttempt, TRound, TFailure>({
    foundationRound,
    claim,
    reserve,
    assess,
    saveAttempt,
    saveAndRecordRound,
    finishRequest,
    releaseClaim,
    warn = () => undefined
}: SpeakingProviderFlowOptions<TValue, TAttempt, TRound, TFailure>): Promise<SpeakingProviderFlowResult<TValue, TAttempt, TRound, TFailure>> => {
    let claimToken: string | null = null;
    let requestId: string | null = null;
    let roundPersisted = false;

    try {
        if (foundationRound) {
            if (!claim || !releaseClaim || !saveAndRecordRound) throw new Error("FOUNDATION_FLOW_CALLBACK_MISSING");
            const claimResult = await claim();
            if (claimResult.status === "busy") {
                return { status: "busy", retryAfterSeconds: Math.max(1, Number(claimResult.retryAfterSeconds || 1)) };
            }
            if (claimResult.status !== "claimed" || !claimResult.claimToken) {
                return { status: "invalid" };
            }
            claimToken = claimResult.claimToken;
        }

        requestId = await reserve();
        const assessment = await assess();
        if (!assessment.ok) {
            await finishRequest(requestId, assessment.ledgerStatus, assessment.errorCode);
            requestId = null;
            if (claimToken && releaseClaim) {
                const released = await releaseClaim(claimToken);
                if (!released) warn("Foundation round claim was already unavailable after provider failure");
                claimToken = null;
            }
            return { status: "provider_failure", failure: assessment.failure };
        }

        let attempt: TAttempt;
        let round: TRound | null = null;
        if (foundationRound) {
            const persisted = await saveAndRecordRound!(assessment.value, claimToken!);
            attempt = persisted.attempt;
            round = persisted.round;
            roundPersisted = true;
            claimToken = null;
        } else {
            if (!saveAttempt) throw new Error("STANDARD_FLOW_CALLBACK_MISSING");
            attempt = await saveAttempt(assessment.value);
        }

        try {
            await finishRequest(requestId, "completed", null);
        } catch (ledgerError) {
            if (!roundPersisted) throw ledgerError;
            warn("Pronunciation request ledger completion failed after round persistence");
        }
        requestId = null;
        return { status: "completed", value: assessment.value, attempt, round };
    } catch (error) {
        if (claimToken && releaseClaim) {
            try {
                const released = await releaseClaim(claimToken);
                if (!released) warn("Foundation round claim release returned false");
            } catch {
                warn("Foundation round claim release failed");
            }
        }
        if (requestId) {
            try {
                await finishRequest(
                    requestId,
                    "internal_failed",
                    String((error as any)?.code || "internal_error").slice(0, 120)
                );
            } catch {
                warn("Pronunciation request ledger finalization failed");
            }
        }
        throw error;
    }
};
