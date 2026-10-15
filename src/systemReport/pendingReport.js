// 回報送出前先存在本機；萬一網路不通，下次開啟網站時再補送一次（後端用 report_id 去重，不會重複建立案件）。
const KEY = "ae-pending-reports";
const MAX_ITEMS = 5;

const read = () => {
    try { const list = JSON.parse(window.localStorage.getItem(KEY) || "[]"); return Array.isArray(list) ? list : []; } catch (error) { return []; }
};
const write = list => {
    try { window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ITEMS))); } catch (error) { /* 存不了就算了 */ }
};

export const addPendingReport = payload => write([...read().filter(item => item.report_id !== payload.report_id), payload]);
export const removePendingReport = reportId => write(read().filter(item => item.report_id !== reportId));
export const getPendingReports = () => read();

export const flushPendingReports = async send => {
    for (const payload of read()) {
        try {
            if (await send(payload)) removePendingReport(payload.report_id);
        } catch (error) { /* 下次再試 */ }
    }
};
