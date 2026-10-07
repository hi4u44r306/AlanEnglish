import { LocalSpeakingRecognizer, retainLocalSpeakingRecognizer } from "./localSpeakingRecognizer";
describe("本機辨識引擎", () => {
    const originalWorker = global.Worker;
    let workers;
    beforeEach(() => {
        workers = [];
        global.Worker = class {
            constructor() { workers.push(this); this.terminate = jest.fn(); }
            postMessage(message) { this.message = message; }
            reply(data) { this.onmessage({ data: { id: this.message.id, ...data } }); }
        };
    });
    afterEach(() => { global.Worker = originalWorker; });
    it("背景及口說頁同時準備只建立一個 Worker，兩者都收到進度", async () => {
        const engine = new LocalSpeakingRecognizer(), firstProgress = jest.fn(), secondProgress = jest.fn();
        const first = engine.prepare(firstProgress);
        workers[0].reply({ type: "mode", accelerated: true });
        const second = engine.prepare(secondProgress);
        expect(second).toBe(first);
        expect(workers).toHaveLength(1);
        expect(secondProgress).toHaveBeenCalledWith("相容加速模式：正在準備…");
        workers[0].reply({ type: "ready", cached: true });
        await Promise.all([first, second]);
        expect(engine.ready).toBe(true);
        expect(firstProgress).toHaveBeenLastCalledWith(engine.mode);
        expect(secondProgress).toHaveBeenLastCalledWith(engine.mode);
        await engine.prepare();
        expect(workers).toHaveLength(1);
        engine.dispose();
    });
    it("全站租約維持引擎，換題離開 recorder 不重新載入", async () => {
        jest.useFakeTimers();
        const site = retainLocalSpeakingRecognizer(), preparation = site.recognizer.prepare();
        workers[0].reply({type:"ready",cached:true});
        await preparation;
        const question = retainLocalSpeakingRecognizer();
        question.release();
        jest.runOnlyPendingTimers();
        const next = retainLocalSpeakingRecognizer();
        expect(next.recognizer).toBe(site.recognizer);
        expect(next.recognizer.ready).toBe(true);
        expect(workers[0].terminate).not.toHaveBeenCalled();
        next.release(); site.release(); jest.runOnlyPendingTimers();
        expect(workers[0].terminate).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });
    it("加速準備失敗先釋放 Worker，再退回一般相容一次", async () => {
        const engine = new LocalSpeakingRecognizer(), prepare = engine.prepare();
        expect(workers[0].message.preferSimd).toBe(true);
        workers[0].reply({ type: "error", code: "MEMORY" });
        await Promise.resolve();
        expect(workers[0].terminate).toHaveBeenCalled();
        expect(workers[1].message.preferSimd).toBe(false);
        workers[1].reply({ type: "mode", accelerated: false }); workers[1].reply({ type: "ready" });
        await prepare; expect(engine.ready).toBe(true); engine.dispose();
    });
    it("離開頁面中止等待，舊回應不能使引擎變為可用", async () => {
        const engine = new LocalSpeakingRecognizer(), prepare = engine.prepare();
        const rejected = expect(prepare).rejects.toMatchObject({ code: "local_cancelled" });
        engine.dispose(); workers[0].reply({ type: "ready" }); await rejected;
        expect(engine.ready).toBe(false);
    });
    it("無聲錄音不送到模型，也不產生成績", async () => {
        const engine = new LocalSpeakingRecognizer(), prepare = engine.prepare();
        workers[0].reply({ type: "ready" }); await prepare;
        await expect(engine.transcribe({ arrayBuffer: async () => new ArrayBuffer(44 + 6400) }, 12)).rejects.toMatchObject({ code: "audio_too_quiet" });
        expect(workers[0].message.type).toBe("load"); engine.dispose();
    });
    it("辨識只傳聲音，不傳題目或答案；同時只能處理一段錄音", async () => {
        const engine = new LocalSpeakingRecognizer(), prepare = engine.prepare();
        workers[0].reply({ type: "ready" }); await prepare;
        const buffer = new ArrayBuffer(44 + 16000), view = new DataView(buffer);
        for (let i = 44; i < buffer.byteLength; i += 2) view.setInt16(i, 10000, true);
        const input = { arrayBuffer: async () => buffer.slice(0) };
        const transcript = engine.transcribe(input, 12); await Promise.resolve();
        expect(Object.keys(workers[0].message).sort()).toEqual(["audio", "id", "type"]);
        await expect(engine.transcribe(input, 12)).rejects.toMatchObject({ code: "local_busy" });
        workers[0].reply({ type: "result", text: "I like apples." });
        expect((await transcript).recognizedText).toBe("I like apples."); engine.dispose();
    });
});
