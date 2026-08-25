import {
    calculateListeningAssignmentWorkload,
    formatAssignmentEstimate
} from "./assignmentWorkload";

describe("assignment workload", () => {
    test("以音檔秒數、指定次數與固定緩衝計算時間及級距獎勵", () => {
        const workload = calculateListeningAssignmentWorkload([
            { duration_seconds: 120 },
            { duration_seconds: 180 }
        ], 3);

        expect(workload).toEqual({
            estimatedSeconds: 1020,
            estimatedMinutes: 17,
            hasUnknownDuration: false,
            reward: { xp: 40, aePoints: 7 }
        });
        expect(formatAssignmentEstimate(workload.estimatedSeconds)).toBe("約需 17 分鐘");
    });

    test("音檔時間不存在時不編造分鐘數，仍顯示基本完成獎勵", () => {
        const workload = calculateListeningAssignmentWorkload([
            { duration_seconds: 120 },
            { duration_seconds: null }
        ], 3);

        expect(workload.estimatedSeconds).toBeNull();
        expect(workload.hasUnknownDuration).toBe(true);
        expect(workload.reward).toEqual({ xp: 30, aePoints: 5 });
        expect(formatAssignmentEstimate(workload.estimatedSeconds)).toBe("暫無法估算時間");
    });
});
