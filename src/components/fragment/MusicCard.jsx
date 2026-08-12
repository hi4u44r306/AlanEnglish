import React from "react";
import "../assets/scss/MusicCard.scss";
import ScaleLoader from "react-spinners/ScaleLoader";
import { AiFillPlayCircle } from "react-icons/ai";
import { FiHeadphones, FiCheck } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import {
    setCurrentMargin,
    setCurrentPlaying,
    setNoInteractionCount,
    setPlayPauseStatus
} from "../../actions/actions";

function MusicCard({
    music,
    progress = {}
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

    const completed =
        Boolean(
            progress?.completed
        );

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
                audioURL
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
                    : ""
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <button
                type="button"
                className="music-card__play"
                onClick={handlePlay}
                aria-label={
                    isPlaying
                        ? "暫停"
                        : "播放"
                }
            >
                {isPlaying ? (
                    <ScaleLoader
                        height={18}
                        width={3}
                        radius={2}
                        margin={2}
                    />
                ) : (
                    <AiFillPlayCircle />
                )}
            </button>

            <div className="music-card__info">
                <div className="music-card__page">
                    {page || "Audio"}
                </div>

                <div className="music-card__book">
                    {bookname || "Alan English"}
                </div>
            </div>

            <div className="music-card__status">
                <div className="music-card__plays">
                    <FiHeadphones />
                    <span>
                        {playCount} 次
                    </span>
                </div>

                {completed && (
                    <div
                        className="music-card__check"
                        title="已完成"
                    >
                        <FiCheck />
                    </div>
                )}
            </div>
        </div>
    );
}

export default MusicCard;