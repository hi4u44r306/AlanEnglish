// 連續學習天數（純計算，不碰資料庫，方便測試）。
//
// 規則：
// - 一天只要有「聽力播放」或「口說題目完成」任一筆紀錄就算學習一天（日期以台北時間為準）。
// - 每個「週一到週日」的週有 1 次免死金牌：那週漏掉的第一天不會讓連續中斷，但那一天不算進天數。
// - 今天還沒練習不算漏掉（學生還有一整天），所以從昨天開始往回算。
// - 連續天數 = 這一串裡「真正有學習」的天數。

export type StreakDayStatus = "done" | "shield" | "missed" | "today" | "future";

export type LearningStreak = {
  current: number;
  // 資料範圍內（約 14 個月）最長的一次連續天數，用來決定「已經拿過哪些徽章」。
  longest: number;
  today_done: boolean;
  week: { date: string; status: StreakDayStatus }[];
};

const DAY_MS = 86_400_000;

const toUtcMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const toDateString = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date: string, days: number) => toDateString(toUtcMs(date) + days * DAY_MS);

// 該日期所在那週的星期一（週一為一週的開始）。
const weekStart = (date: string) => {
  const weekday = new Date(toUtcMs(date)).getUTCDay(); // 0 = 週日
  return addDays(date, -((weekday + 6) % 7));
};

const isDateString = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function computeLearningStreak(activeDates: Iterable<string>, today: string): LearningStreak {
  const active = new Set<string>();
  for (const value of activeDates) if (isDateString(value) && value <= today) active.add(value);

  const todayDone = active.has(today);
  const shieldDays = new Set<string>();
  const shieldWeeks = new Set<string>();
  let current = 0;

  // 從今天（沒做就從昨天）往回走，直到真正斷掉為止。
  let cursor = todayDone ? today : addDays(today, -1);
  let guard = 0;
  while (guard++ < 2000) {
    if (active.has(cursor)) {
      current += 1;
    } else {
      const week = weekStart(cursor);
      if (shieldWeeks.has(week)) break;
      // 還沒有任何學習紀錄的日子之前不能用金牌，否則新同學會被算成已經連續。
      let hasEarlier = false;
      for (const date of active) {
        if (date < cursor) { hasEarlier = true; break; }
      }
      if (!hasEarlier) break;
      shieldWeeks.add(week);
      shieldDays.add(cursor);
    }
    cursor = addDays(cursor, -1);
  }

  // 一串結束後，最尾端如果是金牌日（前面沒有學習），要把它拿掉。
  while (shieldDays.size && !active.has(addDays(cursor, 1)) && shieldDays.has(addDays(cursor, 1))) {
    const last = addDays(cursor, 1);
    shieldDays.delete(last);
    cursor = last;
  }

  // 本週（週一到週日）狀態。
  const monday = weekStart(today);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    let status: StreakDayStatus;
    if (date > today) status = "future";
    else if (active.has(date)) status = "done";
    else if (date === today) status = "today";
    else if (shieldDays.has(date)) status = "shield";
    else status = "missed";
    return { date, status };
  });

  return { current, longest: Math.max(current, computeLongest(active, today)), today_done: todayDone, week };
}

// 由最早的紀錄往後掃，用同樣的免死金牌規則找出最長的一次連續。
function computeLongest(active: Set<string>, today: string) {
  if (!active.size) return 0;
  let first = today;
  for (const date of active) if (date < first) first = date;
  const shieldWeeks = new Set<string>();
  let run = 0;
  let best = 0;
  let cursor = first;
  let guard = 0;
  while (cursor <= today && guard++ < 2000) {
    if (active.has(cursor)) {
      run += 1;
      if (run > best) best = run;
    } else if (cursor < today && run > 0 && !shieldWeeks.has(weekStart(cursor))) {
      shieldWeeks.add(weekStart(cursor));
    } else if (cursor < today) {
      run = 0;
    }
    cursor = addDays(cursor, 1);
  }
  return best;
}
