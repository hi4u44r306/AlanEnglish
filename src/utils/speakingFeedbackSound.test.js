import { playSpeakingFeedbackSound, prepareSpeakingFeedbackSound } from "./speakingFeedbackSound";

describe("speakingFeedbackSound", () => {
    const originalAudioContext = window.AudioContext;

    afterEach(() => {
        Object.defineProperty(window, "AudioContext", { configurable: true, value: originalAudioContext });
        jest.clearAllMocks();
    });

    it("warms up audio on the user action and plays a gentle three-note success sound", () => {
        const oscillator = () => ({
            type: "", frequency: { setValueAtTime: jest.fn() }, connect: jest.fn(), start: jest.fn(), stop: jest.fn()
        });
        const gain = () => ({
            gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() }, connect: jest.fn()
        });
        const context = {
            state: "running", currentTime: 1, destination: {},
            createOscillator: jest.fn(oscillator), createGain: jest.fn(gain), resume: jest.fn().mockResolvedValue(undefined)
        };
        Object.defineProperty(window, "AudioContext", { configurable: true, value: jest.fn(() => context) });

        expect(prepareSpeakingFeedbackSound()).toBe(context);
        playSpeakingFeedbackSound("good");

        expect(context.createOscillator).toHaveBeenCalledTimes(3);
        expect(context.createGain).toHaveBeenCalledTimes(3);
    });
});
