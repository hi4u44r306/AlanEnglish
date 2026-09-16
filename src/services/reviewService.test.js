import {
    getReviewDashboard,
    invalidateReviewDashboard,
    submitReviewAnswer
} from "./reviewService";

const response = body => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body)
});

describe("reviewService dashboard warming", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        global.fetch = jest.fn();
    });

    it("reuses a prefetched dashboard instead of requesting it again on navigation", async () => {
        const user = { uid: "review-cache-user", getIdToken: jest.fn().mockResolvedValue("token") };
        const dashboard = { stats: { due: 2 }, items: [] };
        fetch.mockImplementation(() => response(dashboard));

        await getReviewDashboard(user);
        await getReviewDashboard(user);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(user.getIdToken).toHaveBeenCalledTimes(1);
        invalidateReviewDashboard(user);
    });

    it("invalidates the dashboard after an answer changes review progress", async () => {
        const user = { uid: "review-submit-user", getIdToken: jest.fn().mockResolvedValue("token") };
        fetch
            .mockImplementationOnce(() => response({ stats: { due: 1 }, items: [] }))
            .mockImplementationOnce(() => response({ result: { is_correct: true } }))
            .mockImplementationOnce(() => response({ stats: { due: 0 }, items: [] }));

        await getReviewDashboard(user);
        await submitReviewAnswer(user, "item-1", "A");
        await getReviewDashboard(user);

        expect(fetch).toHaveBeenCalledTimes(3);
        invalidateReviewDashboard(user);
    });
});
