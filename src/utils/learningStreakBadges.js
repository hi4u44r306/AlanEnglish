import badge3 from "../components/assets/streak-badges/streak-3.webp";
import badge7 from "../components/assets/streak-badges/streak-7.webp";
import badge14 from "../components/assets/streak-badges/streak-14.webp";
import badge30 from "../components/assets/streak-badges/streak-30.webp";
import badge60 from "../components/assets/streak-badges/streak-60.webp";
import badge100 from "../components/assets/streak-badges/streak-100.webp";
import badge180 from "../components/assets/streak-badges/streak-180.webp";
import badge365 from "../components/assets/streak-badges/streak-365.webp";

// 連續天數徽章：數字畫在圖裡，所以達成幾天就是那一枚。
export const STREAK_BADGES = [
    { days: 3, name: "小火苗", image: badge3 },
    { days: 7, name: "一週達人", image: badge7 },
    { days: 14, name: "兩週達人", image: badge14 },
    { days: 30, name: "一個月", image: badge30 },
    { days: 60, name: "兩個月", image: badge60 },
    { days: 100, name: "百日達人", image: badge100 },
    { days: 180, name: "半年英雄", image: badge180 },
    { days: 365, name: "一年傳奇", image: badge365 }
];

const toCount = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};

// 目前連續與歷史最長都會看：中斷後已經拿過的徽章不會不見。
export const getStreakBadgeState = streak => {
    const current = toCount(streak?.current);
    const longest = Math.max(current, toCount(streak?.longest));
    const earned = STREAK_BADGES.filter(badge => longest >= badge.days);
    const top = earned[earned.length - 1] || null;
    const next = STREAK_BADGES.find(badge => current < badge.days) || null;
    return { current, longest, earned, top, next, remaining: next ? next.days - current : 0 };
};
