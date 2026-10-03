import { convertAudioBlobToWav, encodePcm16Wav } from "./audioWav";

const readAscii = (view, offset, length) => Array.from(
    { length },
    (_, index) => String.fromCharCode(view.getUint8(offset + index))
).join("");

const readBlob = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
});

describe("convertAudioBlobToWav waiting buffer", () => {
    const originalContext = window.AudioContext;
    const originalOfflineContext = window.OfflineAudioContext;
    let start;
    let close;
    let offlineArguments;

    beforeEach(() => {
        start = jest.fn();
        close = jest.fn().mockResolvedValue();
        window.AudioContext = class {
            decodeAudioData = jest.fn().mockResolvedValue({ duration: 2 });
            close = close;
        };
        window.OfflineAudioContext = class {
            constructor(channels, frames, rate) { offlineArguments = [channels, frames, rate]; }
            createBufferSource = () => ({ connect: jest.fn(), start });
            startRendering = async () => ({ sampleRate: 16000, getChannelData: () => new Float32Array(offlineArguments[1]) });
        };
    });
    afterEach(() => {
        window.AudioContext = originalContext;
        window.OfflineAudioContext = originalOfflineContext;
    });

    it("僅裁掉指定的等待開頭，完整保留後段與尾音", async () => {
        const wav = await convertAudioBlobToWav({ arrayBuffer: async () => new ArrayBuffer(10) }, 16000, { startSeconds: 0.5 });
        expect(start).toHaveBeenCalledWith(0, 0.5);
        expect(offlineArguments).toEqual([1, 24000, 16000]);
        const view = new DataView(await readBlob(wav));
        expect(view.getUint32(40, true) / view.getUint32(28, true)).toBe(1.5);
        expect(close).toHaveBeenCalled();
    });

    it("一般錄音呼叫不裁切，非法空片段不送出 WAV", async () => {
        const blob = { arrayBuffer: async () => new ArrayBuffer(10) };
        await convertAudioBlobToWav(blob);
        expect(start).toHaveBeenCalledWith(0, 0);
        expect(offlineArguments[1]).toBe(32000);
        await expect(convertAudioBlobToWav(blob, 16000, { startSeconds: 3 })).rejects.toThrow("沒有取得完整錄音");
        expect(close).toHaveBeenCalledTimes(2);
    });
});

describe("encodePcm16Wav", () => {
    it("輸出 Azure 接受的 16 kHz 單聲道 PCM WAV 標頭", async () => {
        const blob = encodePcm16Wav({
            sampleRate: 16000,
            getChannelData: () => new Float32Array([0, 0.5, -0.5, 1, -1])
        });
        const view = new DataView(await readBlob(blob));

        expect(blob.type).toBe("audio/wav");
        expect(readAscii(view, 0, 4)).toBe("RIFF");
        expect(readAscii(view, 8, 4)).toBe("WAVE");
        expect(readAscii(view, 12, 4)).toBe("fmt ");
        expect(view.getUint16(20, true)).toBe(1);
        expect(view.getUint16(22, true)).toBe(1);
        expect(view.getUint32(24, true)).toBe(16000);
        expect(view.getUint16(34, true)).toBe(16);
        expect(readAscii(view, 36, 4)).toBe("data");
        expect(view.getUint32(40, true)).toBe(10);
    });

    it("等比例放大偏小的麥克風訊號，避免送評 WAV 幾乎無聲", async () => {
        const blob = encodePcm16Wav({
            sampleRate: 16000,
            getChannelData: () => new Float32Array([0.05, -0.05])
        });
        const view = new DataView(await readBlob(blob));

        expect(view.getInt16(44, true)).toBeGreaterThan(6000);
        expect(view.getInt16(46, true)).toBeLessThan(-6000);
    });
});
