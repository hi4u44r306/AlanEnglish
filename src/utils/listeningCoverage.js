const LISTENING_CLOCK_DRIFT_RATIO = 1.35;
const LISTENING_CLOCK_TOLERANCE_SECONDS = 1.25;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const mergeCoverageRange = (ranges, nextRange) => {
    const sortedRanges = [...ranges, nextRange]
        .map(([start, end]) => [Math.max(0, start), Math.max(0, end)])
        .filter(([start, end]) => end > start)
        .sort((first, second) => first[0] - second[0]);

    return sortedRanges.reduce((mergedRanges, [start, end]) => {
        const previousRange = mergedRanges[mergedRanges.length - 1];

        if (!previousRange || start > previousRange[1] + 0.15) {
            mergedRanges.push([start, end]);
            return mergedRanges;
        }

        previousRange[1] = Math.max(previousRange[1], end);
        return mergedRanges;
    }, []);
};

export const getCoveredSeconds = ranges => ranges.reduce(
    (total, [start, end]) => total + Math.max(0, end - start),
    0
);

export const isNaturalListeningInterval = ({
    start,
    end,
    elapsedSeconds,
    playbackRate,
    isSeeking,
    isVisible,
    attentionBlocked
}) => {
    const audioDelta = Number(end) - Number(start);
    const wallClockDelta = Number(elapsedSeconds);

    if (
        isSeeking ||
        !isVisible ||
        attentionBlocked ||
        Number(playbackRate) > 1 ||
        !Number.isFinite(audioDelta) ||
        !Number.isFinite(wallClockDelta) ||
        audioDelta <= 0 ||
        wallClockDelta < 0
    ) {
        return false;
    }

    const maximumNaturalAdvance =
        wallClockDelta * LISTENING_CLOCK_DRIFT_RATIO +
        LISTENING_CLOCK_TOLERANCE_SECONDS;

    return audioDelta <= maximumNaturalAdvance;
};

