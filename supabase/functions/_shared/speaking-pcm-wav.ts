const readAscii = (view: DataView, offset: number, length: number) => Array.from(
    { length },
    (_, index) => String.fromCharCode(view.getUint8(offset + index))
).join("");

export const inspectPcm16Wav = (buffer: ArrayBuffer) => {
    if (buffer.byteLength < 44) return null;
    const view = new DataView(buffer);
    if (
        readAscii(view, 0, 4) !== "RIFF"
        || readAscii(view, 8, 4) !== "WAVE"
        || readAscii(view, 12, 4) !== "fmt "
        || readAscii(view, 36, 4) !== "data"
    ) return null;

    const audioFormat = view.getUint16(20, true);
    const channels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    const dataBytes = view.getUint32(40, true);
    const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
    if (
        audioFormat !== 1
        || channels !== 1
        || sampleRate !== 16000
        || bitsPerSample !== 16
        || dataBytes <= 0
        || dataBytes % 2 !== 0
        || 44 + dataBytes !== buffer.byteLength
        || view.getUint32(4, true) !== buffer.byteLength - 8
        || view.getUint32(16, true) !== 16
        || view.getUint32(28, true) !== 32000
        || view.getUint16(32, true) !== 2
        || !Number.isFinite(bytesPerSecond)
        || bytesPerSecond <= 0
    ) return null;

    const sampleCount = Math.floor(dataBytes / 2);
    let peak = 0;
    let sumSquares = 0;
    let activeSamples = 0;
    for (let index = 0; index < sampleCount; index += 1) {
        const amplitude = Math.abs(view.getInt16(44 + index * 2, true)) / 0x8000;
        peak = Math.max(peak, amplitude);
        sumSquares += amplitude * amplitude;
        if (amplitude >= 0.01) activeSamples += 1;
    }

    return {
        durationSeconds: dataBytes / bytesPerSecond,
        peak,
        rms: sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0,
        activeRatio: sampleCount > 0 ? activeSamples / sampleCount : 0
    };
};
