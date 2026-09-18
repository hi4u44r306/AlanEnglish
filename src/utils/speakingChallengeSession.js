export const createSpeakingChallengeSessionId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();

    const bytes = new Uint8Array(16);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};
