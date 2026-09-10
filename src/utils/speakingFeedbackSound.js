let feedbackAudioContext = null;

const AUDIO_CONTEXT = () => window.AudioContext || window.webkitAudioContext;
const PATTERNS = {
    good: [[523.25, 0], [659.25, 0.11], [783.99, 0.22]],
    practice: [[440, 0], [523.25, 0.14]],
    retry: [[392, 0], [349.23, 0.16]]
};

export const prepareSpeakingFeedbackSound = () => {
    const AudioContextClass = AUDIO_CONTEXT();
    if (!AudioContextClass) return null;
    if (!feedbackAudioContext || feedbackAudioContext.state === "closed") {
        feedbackAudioContext = new AudioContextClass();
    }
    if (feedbackAudioContext.state === "suspended") feedbackAudioContext.resume().catch(() => {});
    return feedbackAudioContext;
};

export const playSpeakingFeedbackSound = tone => {
    const context = prepareSpeakingFeedbackSound();
    const pattern = PATTERNS[tone] || PATTERNS.practice;
    if (!context || context.state === "closed") return;

    const startAt = context.currentTime + 0.02;
    pattern.forEach(([frequency, offset], index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const noteStart = startAt + offset;
        const duration = tone === "good" ? 0.18 : 0.22;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.055 : 0.045, noteStart + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + duration + 0.02);
    });
};
