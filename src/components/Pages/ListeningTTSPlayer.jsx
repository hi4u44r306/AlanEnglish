import React, { useEffect, useMemo, useState } from "react";
import { FiEye, FiEyeOff, FiPause, FiPlay, FiRotateCcw, FiVolume2 } from "react-icons/fi";
import "./css/ListeningTTSPlayer.scss";

const RATE_OPTIONS = [0.75, 0.9, 1];

const pickEnglishVoice = voices => {
    const englishVoices = voices.filter(voice => voice.lang?.toLowerCase().startsWith("en"));
    return englishVoices.find(voice => /natural/i.test(voice.name))
        || englishVoices.find(voice => /google/i.test(voice.name))
        || englishVoices.find(voice => /microsoft/i.test(voice.name))
        || englishVoices.find(voice => voice.lang?.toLowerCase() === "en-us")
        || englishVoices[0]
        || null;
};

function ListeningTTSPlayer({ script }) {
    const [voices, setVoices] = useState([]);
    const [rate, setRate] = useState(0.9);
    const [speaking, setSpeaking] = useState(false);
    const [paused, setPaused] = useState(false);
    const [showScript, setShowScript] = useState(false);
    const [playCount, setPlayCount] = useState(0);

    const supported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    const voice = useMemo(() => pickEnglishVoice(voices), [voices]);

    useEffect(() => {
        if (!supported) return undefined;

        const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
        loadVoices();
        window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);

        return () => {
            window.speechSynthesis.cancel();
            window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
        };
    }, [supported]);

    useEffect(() => {
        if (!supported) return;
        window.speechSynthesis.cancel();
        setSpeaking(false);
        setPaused(false);
    }, [script, rate, supported]);

    const play = () => {
        if (!supported || !script?.trim()) return;

        if (paused) {
            window.speechSynthesis.resume();
            setPaused(false);
            setSpeaking(true);
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(script);
        utterance.lang = voice?.lang || "en-US";
        utterance.voice = voice;
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.onstart = () => {
            setSpeaking(true);
            setPaused(false);
            setPlayCount(current => current + 1);
        };
        utterance.onend = () => {
            setSpeaking(false);
            setPaused(false);
        };
        utterance.onerror = () => {
            setSpeaking(false);
            setPaused(false);
        };
        window.speechSynthesis.speak(utterance);
    };

    const pause = () => {
        if (!supported || !speaking) return;
        window.speechSynthesis.pause();
        setPaused(true);
        setSpeaking(false);
    };

    const restart = () => {
        if (!supported) return;
        window.speechSynthesis.cancel();
        setSpeaking(false);
        setPaused(false);
        window.setTimeout(play, 80);
    };

    if (!script?.trim()) return null;

    return (
        <div className="ai-listening-player">
            <div className="ai-listening-player-head">
                <div className="ai-listening-icon"><FiVolume2 /></div>
                <div>
                    <span>LISTENING PRACTICE</span>
                    <h3>先聽，再作答</h3>
                    <p>建議先不要看原文，完整聽過 1～2 次後再開始回答問題。</p>
                </div>
            </div>

            {supported ? (
                <>
                    <div className="ai-listening-controls">
                        <button type="button" className="primary" onClick={speaking ? pause : play}>
                            {speaking ? <><FiPause /> 暫停</> : <><FiPlay /> {paused ? "繼續播放" : "播放聽力"}</>}
                        </button>
                        <button type="button" onClick={restart}><FiRotateCcw /> 重播</button>
                        <div className="ai-listening-rates">
                            {RATE_OPTIONS.map(option => (
                                <button
                                    type="button"
                                    key={option}
                                    className={rate === option ? "active" : ""}
                                    onClick={() => setRate(option)}
                                >
                                    {option}x
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ai-listening-meta">
                        <span>已播放 {playCount} 次</span>
                        <span>{voice ? `語音：${voice.name}` : "使用裝置英文語音"}</span>
                    </div>
                </>
            ) : (
                <div className="ai-listening-warning">這個瀏覽器目前不支援內建英文語音播放，請改用最新版 Chrome、Edge 或 Safari。</div>
            )}

            <button type="button" className="ai-listening-script-toggle" onClick={() => setShowScript(value => !value)}>
                {showScript ? <FiEyeOff /> : <FiEye />}
                {showScript ? "隱藏聽力原文" : "顯示聽力原文"}
            </button>

            {showScript && <div className="ai-listening-script">{script}</div>}
        </div>
    );
}

export default ListeningTTSPlayer;
