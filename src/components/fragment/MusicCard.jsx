import React from 'react';
import '../assets/scss/MusicCard.scss';
import ScaleLoader from "react-spinners/ScaleLoader";
import { AiFillPlayCircle } from "react-icons/ai";
import { useDispatch, useSelector } from "react-redux";
import {
    setCurrentMargin,
    setCurrentPlaying,
    setNoInteractionCount,
    setPlayPauseStatus
} from "../../actions/actions";
import Name from "./Name";
import { FcApproval } from "react-icons/fc";

function MusicCard({ music, progress }) {
    const dispatch = useDispatch();
    const { bookname, page, audioURL } = music;
    const musicplay = Number(progress?.playCount) || 0;
    const complete = Boolean(progress?.completed);

    const currentPlaying = useSelector(state => state.musicReducer.playing);

    const isPlaying =
        currentPlaying &&
        currentPlaying.id === music.id;

    const handlePlay = () => {
        if (!audioURL) {
            console.error("找不到 Supabase 音檔網址:", music);
            return;
        }

        dispatch(setCurrentMargin('100px'));
        dispatch(setNoInteractionCount(0));

        if (isPlaying) {
            dispatch(setPlayPauseStatus(false));
            return;
        }

        dispatch(setCurrentPlaying({
            ...music,
            audioURL
        }, true));

        dispatch(setPlayPauseStatus(true));
    };

    return (
        <div className={`music-card ${isPlaying ? 'playing' : ''}`}>
            <div className='musicbanner'>
                <div onClick={handlePlay} className='playbutton'>
                    {isPlaying ? (
                        <ScaleLoader height={20} />
                    ) : (
                        <AiFillPlayCircle className="playicon" />
                    )}
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}
                >
                    <img
                        src={require("../assets/img/headphone.png")}
                        alt={bookname}
                        className='musiccardimage'
                    />
                </div>

                <div className='labelcontainer'>
                    <Name
                        name={page}
                        className="page-name"
                        length={page ? page.length : 0}
                    />

                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '5px',
                            alignItems: 'center'
                        }}
                    >
                        <Name
                            name={bookname}
                            className="book-name"
                            length={bookname ? bookname.length : 0}
                        />

                        <Name
                            name={`播放次數 : ${musicplay} 次`}
                            className="book-name"
                            length={bookname ? bookname.length : 0}
                        />
                    </div>
                </div>

                <div className='passicon'>
                    {complete ? <FcApproval size={50} /> : ''}
                </div>
            </div>
        </div>
    );
}

export default MusicCard;