// 背景存檔用：網路斷線或伺服器暫時出錯（沒有狀態碼或 5xx）就等一下再試；規則上的拒絕（4xx）不重試。
export const SAVE_RETRY_DELAYS_MS = [1000, 3000];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export const isTransientError = error => !error?.status || Number(error.status) >= 500;

export const retryTransient = async (task, delays = SAVE_RETRY_DELAYS_MS, pause = wait) => {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await task();
        } catch (error) {
            if (!isTransientError(error) || attempt >= delays.length) throw error;
            await pause(delays[attempt]);
        }
    }
};
