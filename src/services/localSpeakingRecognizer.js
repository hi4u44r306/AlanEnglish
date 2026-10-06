// Reuse one engine between questions; release it when the speaking page leaves.
let shared, users = 0, releaseTimer;
const failure = (code, message) => Object.assign(new Error(message), { code });
export class LocalSpeakingRecognizer {
    constructor() { this.worker = null; this.pending = null; this.ready = false; this.id = 0; this.mode = ""; }
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
    async prepare(onProgress = () => {}) {
        if (this.ready) { onProgress(this.mode); return; }
        if (this.pending) throw failure("local_busy", "語音辨識仍在準備，請稍候。" );
        for (const preferSimd of [true, false]) {
            this.dispose();
            try {
                this.worker = new Worker(`${process.env.PUBLIC_URL || ""}/speaking-local/worker.mjs?v=1`, { type: "module" });
                this.worker.onmessage = ({ data }) => {
                    const pending = this.pending;
                    if (!pending || pending.id !== data.id) return;
                    if (data.type === "mode") {
                        this.mode = data.accelerated ? "相容加速模式" : "一般相容模式";
                        pending.onProgress?.(`${this.mode}：正在準備…`);
                    } else if (data.type === "progress") {
                        const p = data.progress;
                        pending.onProgress?.(`${this.mode}：${p.total > 0 ? `正在下載，目前檔案 ${Math.floor(p.loaded / p.total * 100)}%` : "正在準備辨識資源…"}`);
                    } else if (["ready", "result", "error"].includes(data.type)) {
                        clearTimeout(pending.timer); this.pending = null;
                        if (data.type === "error") { this.dispose(); pending.reject(failure(data.code, "本機辨識無法完成，請重試；不會改用付費評分。")); }
                        else { if (data.type === "ready") this.ready = true; pending.resolve(data); }
                    }
                };
                this.worker.onerror = event => { event.preventDefault(); this.dispose(); };
                await this.request("load", { forceCompatibility: true, preferSimd }, onProgress, 300000);
                onProgress(this.mode); return;
            } catch (error) {
                this.dispose();
                if (!preferSimd || !["MEMORY", "ENGINE"].includes(error.code)) throw error;
                onProgress("加速啟動失敗，改用一般相容模式…");
            }
        }
    }
    async transcribe(wav, maxSeconds) {
        if (!this.ready) throw failure("local_not_ready", "請先準備語音辨識。" );
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
        if (!/[a-z]/i.test(result.text || "")) throw failure("speech_no_match", "沒有辨識到英文，請重新錄音。" );
        return { recognizedText: result.text, audioSeconds: length / 16000 };
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
