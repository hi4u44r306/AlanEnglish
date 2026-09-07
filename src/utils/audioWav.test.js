import { encodePcm16Wav } from "./audioWav";

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
