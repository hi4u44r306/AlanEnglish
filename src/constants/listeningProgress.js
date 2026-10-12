export const LISTENING_MASTERY_REQUIRED_PLAYS = 30;

export const hasReachedListeningMastery = progress => (
    Number(progress?.playCount ?? progress?.play_count ?? 0) >= LISTENING_MASTERY_REQUIRED_PLAYS
);

// A small daily target shown on 我的進度: valid listens today. Display only — no reward is tied to it.
export const DAILY_LISTENING_GOAL = 3;
