const writeAscii = (view, offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
    }
};

export const encodePcm16Wav = audioBuffer => {
    const samples = audioBuffer.getChannelData(0);
    const peak = samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0);
    // 只做等比例增益，不改變發音內容；避免部分筆電麥克風轉成 WAV 後音量過低而辨識失敗。
    const gain = peak >= 0.002 && peak < 0.25 ? Math.min(4, 0.5 / peak) : 1;
    const bytesPerSample = 2;
    const headerSize = 44;
    const buffer = new ArrayBuffer(headerSize + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, samples.length * bytesPerSample, true);

    let offset = headerSize;
    for (const sample of samples) {
        const clamped = Math.max(-1, Math.min(1, sample * gain));
        view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
        offset += bytesPerSample;
    }

    return new Blob([buffer], { type: "audio/wav" });
};

export const convertAudioBlobToWav = async (blob, sampleRate = 16000) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AudioContextClass || !OfflineAudioContextClass) {
        throw new Error("這個瀏覽器暫時無法處理錄音格式，請改用新版 Chrome 或 Safari");
    }

    const sourceContext = new AudioContextClass();
    try {
        const source = await sourceContext.decodeAudioData(await blob.arrayBuffer());
        const frameCount = Math.max(1, Math.ceil(source.duration * sampleRate));
        const offline = new OfflineAudioContextClass(1, frameCount, sampleRate);
        const node = offline.createBufferSource();
        node.buffer = source;
        node.connect(offline.destination);
        node.start(0);
        return encodePcm16Wav(await offline.startRendering());
    } finally {
        await sourceContext.close().catch(() => undefined);
    }
};
