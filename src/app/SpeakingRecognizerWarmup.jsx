import { useEffect } from "react";
import { retainLocalSpeakingRecognizer } from "../services/localSpeakingRecognizer";

export default function SpeakingRecognizerWarmup() {
    useEffect(() => {
        const lease = retainLocalSpeakingRecognizer();
        const prepare = () => {
            if (!lease.recognizer.ready) lease.recognizer.prepare().catch(() => {
                // The speaking page provides a retry if background preparation fails.
            });
        };
        const idle = typeof window.requestIdleCallback === "function";
        const task = idle
            ? window.requestIdleCallback(prepare, { timeout: 1500 })
            : window.setTimeout(prepare, 1500);
        return () => {
            if (idle) window.cancelIdleCallback(task);
            else window.clearTimeout(task);
            lease.release();
        };
    }, []);
    return null;
}
