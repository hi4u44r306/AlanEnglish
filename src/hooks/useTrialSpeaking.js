import { useCallback, useEffect, useRef, useState } from "react";
import { retainLocalSpeakingRecognizer } from "../services/localSpeakingRecognizer";
import { convertAudioBlobToWav } from "../utils/audioWav";

const MAX_SECONDS = 6;
const words = text => String(text || "").toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).filter(Boolean);

// The child passes when the expected word is clearly in what was heard. Nothing else is judged:
// this is a taste of speaking aloud, not a pronunciation score.
export const heardExpectedWord = (recognizedText, expected) => words(recognizedText).includes(String(expected || "").toLowerCase());

// Record a few seconds and recognise them on this device. No account, no upload, no paid
// scoring: the audio never leaves the browser.
export default function useTrialSpeaking() {
    const [status, setStatus] = useState("idle");
    const [heard, setHeard] = useState("");
    const [message, setMessage] = useState("");
    const leaseRef = useRef(null);
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const timerRef = useRef(null);
    const runRef = useRef(0);

    const releaseMicrophone = () => {
        window.clearTimeout(timerRef.current);
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    };

    useEffect(() => () => {
        runRef.current += 1;
        if (recorderRef.current?.state === "recording") { recorderRef.current.onstop = null; recorderRef.current.stop(); }
        releaseMicrophone();
        leaseRef.current?.release();
    }, []);

    const reset = useCallback(() => {
        runRef.current += 1;
        if (recorderRef.current?.state === "recording") { recorderRef.current.onstop = null; recorderRef.current.stop(); }
        releaseMicrophone();
        setStatus("idle"); setHeard(""); setMessage("");
    }, []);

    const fail = useCallback(text => { releaseMicrophone(); setStatus("error"); setMessage(text); }, []);

    const start = useCallback(async expected => {
        if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder !== "function") {
            fail("這個瀏覽器不能錄音，可以直接看答案。");
            return;
        }
        const run = ++runRef.current;
        setHeard("");
        try {
            leaseRef.current ||= retainLocalSpeakingRecognizer();
            const recognizer = leaseRef.current.recognizer;
            if (!recognizer.ready) {
                setStatus("preparing");
                setMessage("第一次使用要準備一下，請稍等…");
                await recognizer.prepare();
                if (runRef.current !== run) return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (runRef.current !== run) { stream.getTracks().forEach(track => track.stop()); return; }
            streamRef.current = stream;
            const chunks = [];
            const recorder = new window.MediaRecorder(stream);
            recorderRef.current = recorder;
            recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
            recorder.onstop = async () => {
                releaseMicrophone();
                if (runRef.current !== run) return;
                setStatus("checking"); setMessage("");
                try {
                    const wav = await convertAudioBlobToWav(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }), 16000, { maxSeconds: MAX_SECONDS });
                    const { recognizedText } = await recognizer.transcribe(wav, MAX_SECONDS);
                    if (runRef.current !== run) return;
                    setHeard(recognizedText.trim());
                    setStatus(heardExpectedWord(recognizedText, expected) ? "correct" : "retry");
                } catch (error) {
                    if (runRef.current === run) fail(error?.message || "這次沒有聽清楚，再試一次。");
                }
            };
            recorder.start();
            setStatus("recording"); setMessage("");
            timerRef.current = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, MAX_SECONDS * 1000);
        } catch (error) {
            if (runRef.current !== run) return;
            fail(error?.name === "NotAllowedError" || error?.name === "SecurityError"
                ? "沒有麥克風權限。請允許使用麥克風，或直接看答案。"
                : error?.message || "現在不能錄音，可以直接看答案。");
        }
    }, [fail]);

    const stop = useCallback(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, []);

    return { status, heard, message, start, stop, reset };
}
