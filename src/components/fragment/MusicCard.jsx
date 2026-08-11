import React, { useEffect, useState } from 'react';
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
import { child, onValue, ref } from 'firebase/database';
import { rtdb } from '../Pages/firebase-config';
import { FcApproval } from "react-icons/fc";


function MusicCard(props) {

    const dispatch = useDispatch();

    const {
        bookname,
        page,
        musicName,
        audioURL
    } = props.music;

    const useruid = localStorage.getItem('ae-useruid');

    const [complete, setComplete] = useState();
    const [musicplay, setMusicPlay] = useState(0);

    const convertmusicName = `${bookname} ${page}`;

    const currentPlaying = useSelector(
        state => state.musicReducer.playing
    );

    const isPlaying =
        currentPlaying &&
        currentPlaying.bookname === bookname &&
        currentPlaying.page === page;


    // ================================
    // 舊 Firebase 學生播放紀錄
    // 暫時保留
    // ================================

    useEffect(() => {

        if (!useruid) {
            setMusicPlay(0);
            setComplete(null);
            return;
        }

        const dbRef = ref(rtdb);

        const completeRef = child(
            dbRef,
            `student/${useruid}/MusicLogfile/${convertmusicName}/complete`
        );

        const musicplayRef = child(
            dbRef,
            `student/${useruid}/MusicLogfile/${convertmusicName}/musicplay`
        );


        const unsubscribeMusicPlay = onValue(
            musicplayRef,
            (snapshot) => {

                setMusicPlay(
                    snapshot.exists()
                        ? snapshot.val()
                        : 0
                );

            },
            (error) => {
                console.error(
                    "Error fetching musicplay value:",
                    error
                );
            }
        );


        const unsubscribeComplete = onValue(
            completeRef,
            (snapshot) => {

                setComplete(
                    snapshot.exists()
                        ? snapshot.val()
                        : null
                );

            },
            (error) => {
                console.error(
                    "Error fetching complete value:",
                    error
                );
            }
        );


        return () => {
            unsubscribeMusicPlay();
            unsubscribeComplete();
        };

    }, [convertmusicName, useruid]);


    // ================================
    // 播放
    // ================================

    const handlePlay = () => {

        console.log(
            "準備播放:",
            props.music
        );

        console.log(
            "Supabase Audio URL:",
            audioURL
        );


        // Supabase URL 不存在
        if (!audioURL) {

            console.error(
                "找不到 Supabase 音檔網址:",
                props.music
            );

            return;
        }


        dispatch(
            setCurrentMargin('100px')
        );

        dispatch(
            setNoInteractionCount(0)
        );


        // ============================
        // 如果目前就是這一首
        // → 暫停
        // ============================

        if (isPlaying) {

            dispatch(
                setPlayPauseStatus(false)
            );

            return;
        }


        // ============================
        // 播放新的歌曲
        // ============================

        dispatch(
            setCurrentPlaying(
                {
                    ...props.music,

                    // 確保 MusicPlayer
                    // 拿到 Supabase URL
                    audioURL: audioURL
                },
                true
            )
        );


        dispatch(
            setPlayPauseStatus(true)
        );

    };


    return (

        <div
            className={
                `music-card ${isPlaying ? 'playing' : ''}`
            }
        >

            <div className='musicbanner'>


                {/* 播放按鈕 */}

                <div
                    onClick={handlePlay}
                    className='playbutton'
                >

                    {
                        isPlaying ? (

                            <ScaleLoader
                                height={20}
                            />

                        ) : (

                            <AiFillPlayCircle
                                className="playicon"
                            />

                        )
                    }

                </div>


                {/* 耳機圖片 */}

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}
                >

                    <img
                        src={
                            require(
                                "../assets/img/headphone.png"
                            )
                        }
                        alt={bookname}
                        className='musiccardimage'
                    />

                </div>


                {/* 書籍 / 頁碼 */}

                <div className='labelcontainer'>

                    <Name
                        name={page}
                        className={"page-name"}
                        length={
                            page
                                ? page.length
                                : 0
                        }
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
                            className={"book-name"}
                            length={
                                bookname
                                    ? bookname.length
                                    : 0
                            }
                        />

                        <Name
                            name={
                                `播放次數 : ${musicplay || 0} 次`
                            }
                            className={"book-name"}
                            length={
                                bookname
                                    ? bookname.length
                                    : 0
                            }
                        />

                    </div>

                </div>


                {/* 通過 Icon */}

                <div className='passicon'>

                    {
                        complete === '通過'
                            ? (
                                <FcApproval
                                    size={50}
                                />
                            )
                            : ''
                    }

                </div>

            </div>

        </div>

    );

}


export default MusicCard;