// Reuse one engine for the open website, including transitions between questions.
let shared, users = 0, releaseTimer;
const failure = (code, message) => Object.assign(new Error(message), { code });
// The larger model hears more accurately but costs a bigger first download and more work per
// recording. A device falls back to the small one when it asks to save data, is short of memory,
// keeps failing to start the large one (a phone may kill the page instead of reporting an error),
// or has shown that one recording takes too long to score.
const MODEL_KEY = "ae-speaking-local-model", LARGE_MODEL_MAX_STARTS = 3, LARGE_MODEL_SLOW_MS = 8000;
const readModelState = () => { try { return JSON.parse(localStorage.getItem(MODEL_KEY)) || {}; } catch { return {}; } };
const writeModelState = state => { try { localStorage.setItem(MODEL_KEY, JSON.stringify(state)); } catch { /* Storage may be unavailable. */ } };
export function prefersLargeSpeakingModel() {
    const state = readModelState();
    if (state.small === true || state.starts >= LARGE_MODEL_MAX_STARTS) return false;
    if (typeof navigator === "undefined") return true;
    return navigator.connection?.saveData !== true && !(navigator.deviceMemory < 4);
}
export class LocalSpeakingRecognizer {
    constructor() { this.worker = null; this.pending = null; this.ready = false; this.id = 0; this.mode = ""; this.model = ""; this.preparation = null; this.progressListeners = new Set(); this.lastProgress = ""; }
    dispose() {
        this.ready = false;
        this.worker?.terminate(); this.worker = null;
        if (this.pending) {
            clearTimeout(this.pending.timer);
            this.pending.reject(failure("local_cancelled", "辨識已停止，請重新準備。"));
            this.pending = null;
        }
    }
    request(type, payload, onProgress, timeout) {
        if (this.pending) return Promise.reject(failure("local_busy", "上一段錄音仍在處理，請稍候。"));
        return new Promise((resolve, reject) => {
            const id = ++this.id;
            this.pending = { id, resolve, reject, onProgress, timer: setTimeout(() => this.dispose(), timeout) };
            this.worker.postMessage({ id, type, ...payload }, payload.audio ? [payload.audio.buffer] : []);
        });
    }
    prepare(onProgress = () => {}) {
        if (this.ready) { onProgress(this.mode); return Promise.resolve(); }
        this.progressListeners.add(onProgress);
        if (this.preparation) {
            if (this.lastProgress) onProgress(this.lastProgress);
            return this.preparation;
        }
        this.preparation = this.loadEngine(info => {
            this.lastProgress = info;
            this.progressListeners.forEach(listener => listener(info));
        }).finally(() => {
            this.preparation = null;
            this.progressListeners.clear();
        });
        return this.preparation;
    }
    async loadEngine(onProgress) {
        if (this.ready) { onProgress(this.mode); return; }
        if (this.pending) throw failure("local_busy", "語音辨識仍在準備，請稍候。" );
        try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch { /* Browser may decline persistence. */ }
        const attempts = [...(prefersLargeSpeakingModel() ? [["base", true]] : []), ["tiny", true], ["tiny", false]];
        for (const [model, preferSimd] of attempts) {
            this.dispose();
            try {
                this.worker = new Worker(`${process.env.PUBLIC_URL || ""}/speaking-local/worker.mjs?v=2`, { type: "module" });
                this.worker.onmessage = ({ data }) => {
                    const pending = this.pending;
                    if (!pending || pending.id !== data.id) return;
                    if (data.type === "mode") {
                        this.model = data.model || "tiny";
                        this.mode = `${data.accelerated ? "相容加速模式" : "一般相容模式"}${this.model === "base" ? "・高準確模型" : ""}`;
                        pending.onProgress?.(`${this.mode}：正在準備…`);
                    } else if (data.type === "progress") {
                        const p = data.progress;
                        pending.onProgress?.(`${this.mode}：${p.status === "done" ? "資源已載入…" : p.total > 0 ? `載入模型，目前檔案 ${Math.floor(p.loaded / p.total * 100)}%` : "正在載入辨識資源；首次使用需下載…"}`);
                    } else if (["ready", "result", "error"].includes(data.type)) {
                        clearTimeout(pending.timer); this.pending = null;
                        if (data.type === "error") { this.dispose(); pending.reject(failure(data.code, "本機辨識無法完成，請重試；不會改用付費評分。")); }
                        else { if (data.type === "ready") { this.ready = true; if (model === "base") writeModelState({}); this.mode += data.cached ? " · 模型已快取，下次直接載入" : " · 模型已就緒，瀏覽器可能需要重新下載"; } pending.resolve(data); }
                    }
                };
                this.worker.onerror = event => { event.preventDefault(); this.dispose(); };
                if (model === "base") writeModelState({ starts: (readModelState().starts || 0) + 1 });
                await this.request("load", { forceCompatibility: true, preferSimd, model }, onProgress, 300000);
                onProgress(this.mode); return;
            } catch (error) {
                this.dispose();
                if (!preferSimd || !["MEMORY", "ENGINE"].includes(error.code)) throw error;
                if (model === "base") writeModelState({ small: true });
                onProgress(model === "base" ? "這台裝置改用較小的辨識模型…" : "加速啟動失敗，改用一般相容模式…");
            }
        }
    }
    async transcribe(wav, maxSeconds) {
        if (!this.ready) throw failure("local_not_ready", "請先準備語音辨識。" );
        const started = typeof performance !== "undefined" ? performance.now() : Date.now();
        // Input is our own bounded mono 16 kHz PCM WAV; no second audio decode.
        const buffer = await wav.arrayBuffer();
        const view = new DataView(buffer);
        const length = (buffer.byteLength - 44) / 2;
        if (length < 3200 || length > 16000 * (maxSeconds + 0.1) || length % 1) throw failure("audio_duration_invalid", "錄音長度不正確，請重新錄音。" );
        const samples = new Float32Array(length);
        let energetic = 0;
        for (let i = 0; i < length; i++) samples[i] = view.getInt16(44 + i * 2, true) / 32768;
        for (let i = 0; i + 320 <= length; i += 320) {
            let sum = 0; for (let j = i; j < i + 320; j++) sum += samples[j] ** 2;
            if (Math.sqrt(sum / 320) > 0.006) energetic++;
        }
        if (energetic < 10) throw failure("audio_too_quiet", "沒有聽到清楚的聲音，請靠近麥克風重錄。" );
        const result = await this.request("transcribe", { audio: samples }, null, 90000);
        if (this.model === "base" && result.inferenceMs > LARGE_MODEL_SLOW_MS) {
            // Too slow for a child to wait on every question: switch this device to the small model now.
            writeModelState({ small: true }); this.dispose(); this.prepare().catch(() => {});
        }
        if (!/[a-z]/i.test(result.text || "")) throw failure("speech_no_match", "沒有辨識到英文，請重新錄音。" );
        const transcribeMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
        return { recognizedText: result.text, audioSeconds: length / 16000, inferenceMs: result.inferenceMs, transcribeMs, model: this.model };
    }
}
export function retainLocalSpeakingRecognizer() {
    clearTimeout(releaseTimer); users++;
    shared ||= new LocalSpeakingRecognizer();
    let released = false;
    return { recognizer: shared, release() {
        if (released) return; released = true; users--;
        if (!users) releaseTimer = setTimeout(() => { shared?.dispose(); shared = null; }, 0);
    } };
}
