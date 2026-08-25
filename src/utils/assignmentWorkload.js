export const ASSIGNMENT_BASE_XP = 30;
export const ASSIGNMENT_BASE_AE_POINTS = 5;
export const ASSIGNMENT_OPENING_BUFFER_SECONDS = 90;
export const ASSIGNMENT_PER_TRACK_BUFFER_SECONDS = 15;

const asPositiveNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
};

const rewardForEstimatedMinutes = minutes => {
    if (!minutes || minutes <= 10) {
        return { xp: ASSIGNMENT_BASE_XP, aePoints: ASSIGNMENT_BASE_AE_POINTS };
    }
    if (minutes <= 20) return { xp: 40, aePoints: 7 };
    if (minutes <= 35) return { xp: 55, aePoints: 10 };
    return { xp: 70, aePoints: 14 };
};

export const calculateListeningAssignmentWorkload = (tracks, requiredListens) => {
    const selectedTracks = Array.isArray(tracks) ? tracks : [];
    const listens = Math.max(1, Math.min(20, Number(requiredListens) || 3));
    const durations = selectedTracks.map(track => asPositiveNumber(track?.duration_seconds));
    const hasUnknownDuration = durations.some(duration => !duration);

    if (!selectedTracks.length || hasUnknownDuration) {
        return {
            estimatedSeconds: null,
            estimatedMinutes: null,
            hasUnknownDuration,
            reward: rewardForEstimatedMinutes(null)
        };
    }

    const listeningSeconds = durations.reduce((total, duration) => total + duration * listens, 0);
    const estimatedSeconds = Math.ceil(
        listeningSeconds
        + ASSIGNMENT_OPENING_BUFFER_SECONDS
        + selectedTracks.length * ASSIGNMENT_PER_TRACK_BUFFER_SECONDS
    );
    const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

    return {
        estimatedSeconds,
        estimatedMinutes,
        hasUnknownDuration: false,
        reward: rewardForEstimatedMinutes(estimatedMinutes)
    };
};

export const formatAssignmentEstimate = estimatedSeconds => {
    const seconds = asPositiveNumber(estimatedSeconds);
    return seconds ? `約需 ${Math.ceil(seconds / 60)} 分鐘` : "暫無法估算時間";
};
