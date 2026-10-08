import React from "react";
import "../assets/scss/MusicCard.scss";
import { AiFillPlayCircle } from "react-icons/ai";
import { FiHeadphones, FiCheck } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import {
    setCurrentMargin,
    setCurrentPlaying,
    setNoInteractionCount,
    setPlayPauseStatus
} from "../../actions/actions";
import { hasReachedListeningMastery, LISTENING_MASTERY_REQUIRED_PLAYS } from "../../constants/listeningProgress";

function MusicCard({
    music,
    playbackQueue = [],
    progress = {},
    index = 0,
    progressStatus = "ready",
    onStart
}) {
    const dispatch = useDispatch();

    const {
        bookname,
        page,
        audioURL
    } = music || {};

    const playCount =
        Number(
            progress?.playCount ??
            progress?.play_count ??
            0
        ) || 0;

    const completed = progressStatus === "ready" && hasReachedListeningMastery(progress);
    const title = music?.title || music?.music_name || music?.musicName || page || "教材音檔";

    const currentPlaying =
        useSelector(
            state =>
                state.musicReducer.playing
        );

    const playingStatus =
        useSelector(
            state =>
                state.musicReducer.playingStatus
        );

    const isCurrentTrack =
        Boolean(
            currentPlaying &&
            currentPlaying.id === music?.id
        );

    const isPlaying =
        isCurrentTrack &&
        playingStatus;

    const handlePlay = () => {
        if (!audioURL) {
            console.error(
                "找不到音檔網址:",
                music
            );
            return;
        }

        if (!isPlaying) onStart?.(music);

        dispatch(
            setCurrentMargin(
                "100px"
            )
        );

        dispatch(
            setNoInteractionCount(
                0
            )
        );

        localStorage.setItem(
            "ae-no-interaction",
            "0"
        );

        if (isCurrentTrack) {
            dispatch(
                setPlayPauseStatus(
                    !playingStatus
                )
            );
            return;
        }

        dispatch(
            setCurrentPlaying({
                ...music,
                audioURL,
                playbackQueue
            })
        );

        dispatch(
            setPlayPauseStatus(
                true
            )
        );
    };

    return (
        <div
            className={[
                "music-card",
                isCurrentTrack
                    ? "music-card--active"
                    : "",
                completed
                    ? "music-card--completed"
                    : "",
                `music-card--theme-${index % 5}`
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <button
                type="button"
                className="music-card__play"
                onClick={handlePlay}
                disabled={!audioURL}
                aria-label={`${audioURL ? isPlaying ? "暫停" : "播放" : "音檔暫時無法播放"} ${title}`}
            >
                <span className="music-card__play-ring" aria-hidden="true" />
                {isPlaying ? (
                    <span className="music-card__equalizer" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                    </span>
                ) : (
                    <AiFillPlayCircle aria-hidden="true" />
                )}
                <span className="music-card__play-label">{isPlaying ? "暫停" : "播放"}</span>
            </button>

            <div className="music-card__info">
                <span className="music-card__eyebrow">音檔 {index + 1}</span>
                <div className="music-card__title">
                    {title}
                </div>

                <div className="music-card__book">
                    {page && page !== title && <span className="music-card__page">{page}</span>}
                    <span>{bookname || "Alan English"}</span>
                </div>
                {isCurrentTrack && <span className="music-card__current">{isPlaying ? "正在聆聽" : "已暫停，可繼續聽"}</span>}
                {!audioURL && <span className="music-card__unavailable">音檔暫時無法播放</span>}
            </div>

            <div className="music-card__status">
                <div className="music-card__plays">
                    <FiHeadphones aria-hidden="true" />
                    <span><small>熟練進度</small><strong>{progressStatus === "ready" ? `${Math.min(playCount, LISTENING_MASTERY_REQUIRED_PLAYS)} / ${LISTENING_MASTERY_REQUIRED_PLAYS}` : progressStatus === "loading" ? "讀取中" : "紀錄未載入"}</strong></span>
                </div>

                {completed && (
                    <div
                        className="music-card__check"
                        title="已通過"
                    >
                        <FiCheck aria-hidden="true" />
                        <span>通過</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MusicCard;
