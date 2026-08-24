const TAIPEI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

const getTaipeiDate = timestamp => new Date(timestamp + TAIPEI_UTC_OFFSET_MS);

export const getNextTaipeiDailyResetAt = timestamp => {
    const taipeiDate = getTaipeiDate(timestamp);

    return Date.UTC(
        taipeiDate.getUTCFullYear(),
        taipeiDate.getUTCMonth(),
        taipeiDate.getUTCDate() + 1
    ) - TAIPEI_UTC_OFFSET_MS;
};

export const getNextTaipeiMonthlyResetAt = timestamp => {
    const taipeiDate = getTaipeiDate(timestamp);

    return Date.UTC(
        taipeiDate.getUTCFullYear(),
        taipeiDate.getUTCMonth() + 1,
        1
    ) - TAIPEI_UTC_OFFSET_MS;
};

export const formatResetCountdown = milliseconds => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const time = [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");

    return days > 0 ? `${days} 天 ${time}` : time;
};
