import { focusLevel, roundFocusRate } from "./focusRate";

test("專注度四捨五入到整十，並限制在 0～100", () => {
    expect([95, 94, 63, 65, 28, 4, 0, 100, 104].map(roundFocusRate)).toEqual([100, 90, 60, 70, 30, 0, 0, 100, 100]);
    expect(roundFocusRate(null)).toBeNull();
    expect(roundFocusRate(Number.NaN)).toBeNull();
});

test("等級依整十後的數字判斷", () => {
    expect([100, 80, 70, 60, 50, 30, null].map(focusLevel)).toEqual(["focused", "focused", "ok", "ok", "needs_reminder", "needs_reminder", null]);
});
