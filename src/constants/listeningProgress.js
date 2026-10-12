export const LISTENING_MASTERY_REQUIRED_PLAYS = 30;

export const hasReachedListeningMastery = progress => (
    Number(progress?.playCount ?? progress?.play_count ?? 0) >= LISTENING_MASTERY_REQUIRED_PLAYS
);
