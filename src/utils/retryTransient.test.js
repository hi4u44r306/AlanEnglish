import { retryTransient } from "./retryTransient";

const noWait = () => Promise.resolve();
const failure = status => Object.assign(new Error("failed"), status ? { status } : {});

describe("retryTransient", () => {
    it("網路或伺服器暫時出錯會重試，成功就回傳結果", async () => {
        const task = jest.fn()
            .mockRejectedValueOnce(failure())
            .mockRejectedValueOnce(failure(503))
            .mockResolvedValueOnce("saved");
        await expect(retryTransient(task, [1, 1], noWait)).resolves.toBe("saved");
        expect(task).toHaveBeenCalledTimes(3);
    });

    it("規則上的拒絕（4xx）不重試", async () => {
        const task = jest.fn().mockRejectedValue(failure(409));
        await expect(retryTransient(task, [1, 1], noWait)).rejects.toMatchObject({ status: 409 });
        expect(task).toHaveBeenCalledTimes(1);
    });

    it("重試次數用完就放棄", async () => {
        const task = jest.fn().mockRejectedValue(failure(500));
        await expect(retryTransient(task, [1, 1], noWait)).rejects.toMatchObject({ status: 500 });
        expect(task).toHaveBeenCalledTimes(3);
    });
});
