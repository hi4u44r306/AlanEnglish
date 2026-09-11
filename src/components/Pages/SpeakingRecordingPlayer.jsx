import React, { useEffect, useRef, useState } from "react";
import { FiPause, FiPlay, FiVolume2 } from "react-icons/fi";
import "./css/SpeakingRecordingPlayer.scss";

const formatTime = value => {
    const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function SpeakingRecordingPlayer({ src, label = "我的錄音", ariaLabel = label, autoPlay = false }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        setPlaying(false);
        setCurrentTime(0);
        setDuration(0);
    }, [src]);

    const toggle = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) audio.play()?.catch?.(() => setPlaying(false));
        else audio.pause();
    };

    const seek = event => {
        const next = Number(event.target.value);
        if (!audioRef.current || !Number.isFinite(next)) return;
        audioRef.current.currentTime = next;
        setCurrentTime(next);
    };

    return <div className="speaking-recording-player">
        <audio
            ref={audioRef}
            src={src}
            aria-label={ariaLabel}
            autoPlay={autoPlay}
            preload="metadata"
            onLoadedMetadata={event => setDuration(Number(event.currentTarget.duration) || 0)}
            onDurationChange={event => setDuration(Number(event.currentTarget.duration) || 0)}
            onTimeUpdate={event => setCurrentTime(Number(event.currentTarget.currentTime) || 0)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        >你的瀏覽器不支援錄音播放。</audio>
        <button type="button" className="speaking-recording-player__toggle" onClick={toggle} aria-label={playing ? `暫停${label}` : `播放${label}`}>
            {playing ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
        </button>
        <div className="speaking-recording-player__body">
            <div><strong>{label}</strong><span>{playing ? "正在播放" : currentTime > 0 ? "已暫停" : "按下播放聽聽看"}</span></div>
            <input type="range" min="0" max={duration || 0} step="0.01" value={Math.min(currentTime, duration || 0)} onChange={seek} aria-label={`${label}播放進度`} />
        </div>
        <div className="speaking-recording-player__time"><FiVolume2 aria-hidden="true" /><span>{formatTime(currentTime)} / {formatTime(duration)}</span></div>
    </div>;
}
