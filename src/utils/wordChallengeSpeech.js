// 第一階段的發音：使用裝置內建的英文語音（試作）。
// 之後改成事先產生好的 Leda 音檔；這個檔案只剩音檔讀不到時的備援。

const synth = () => (typeof window !== "undefined" && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === "function" ? window.speechSynthesis : null);

export const isSpeechAvailable = () => Boolean(synth());

const pickEnglishVoice = () => {
    const voices = synth()?.getVoices?.() || [];
    return voices.find(voice => /^en[-_]US/i.test(voice.lang) && /Google|Samantha|Aria|Jenny|Microsoft/i.test(voice.name))
        || voices.find(voice => /^en[-_]US/i.test(voice.lang))
        || voices.find(voice => /^en/i.test(voice.lang))
        || null;
};

export function speakWord(text, { slow = false } = {}) {
    const engine = synth();
    if (!engine || !text) return false;
    try {
        engine.cancel();
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = slow ? 0.55 : 0.85;
        const voice = pickEnglishVoice();
        if (voice) utterance.voice = voice;
        engine.speak(utterance);
        return true;
    } catch {
        return false;
    }
}

export function stopSpeaking() {
    try {
        synth()?.cancel();
    } catch {
        // 忽略：有些瀏覽器在沒有播放時呼叫 cancel 會丟錯。
    }
}
