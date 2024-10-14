import React, { useEffect, useState } from 'react';
import '../assets/scss/MusicCard.scss';
import { AiFillPlayCircle } from "react-icons/ai";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentMargin, setCurrentPlaying } from "../../actions/actions";
import Name from "./Name";
import { child, onValue, ref } from 'firebase/database';
import { rtdb } from '../Pages/firebase-config';
import { FcApproval } from "react-icons/fc";
import { setPlayPauseStatus } from "../../actions/actions";



function MusicCard(props) {
    const dispatch = useDispatch();
    const { bookname, page, img } = props.music;
    const useruid = localStorage.getItem('ae-useruid');
    const [complete, setComplete] = useState();
    const [musicplay, setMusicPlay] = useState();
    const convertmusicName = bookname + ' ' + page;

    const currentPlaying = useSelector(state => state.musicReducer.playing);
    const isPlaying = currentPlaying && currentPlaying.bookname === bookname && currentPlaying.page === page;


    useEffect(() => {
        // 次數通過
        const dbRef = ref(rtdb);
        const completeRef = child(dbRef, `student/${useruid}/MusicLogfile/${convertmusicName}/complete`);
        const musicplayRef = child(dbRef, `student/${useruid}/MusicLogfile/${convertmusicName}/musicplay`);

        onValue(musicplayRef, (snapshot) => {
            if (snapshot.exists()) {
                setMusicPlay(snapshot.val());
            } else {
                setMusicPlay(); // If data doesn't exist, setComplete to its default value
            }
        }, (error) => {
            console.error("Error fetching complete value:", error);
        });
        onValue(completeRef, (snapshot) => {
            if (snapshot.exists()) {
                setComplete(snapshot.val());
            } else {
                setComplete(); // If data doesn't exist, setComplete to its default value
            }
        }, (error) => {
            console.error("Error fetching complete value:", error);
        });

    }, [convertmusicName, useruid]);


    function handlePlay() {
        dispatch(setCurrentMargin('100px'));

        if (isPlaying) {
            // If currently playing, dispatch pause action
            dispatch(setPlayPauseStatus(false)); // Pause music
        } else {
            // If not currently playing, dispatch play action
            dispatch(setCurrentPlaying(props.music, true)); // Set the current playing music and isPlaying to true
            dispatch(setPlayPauseStatus(true)); // Play music
        }
    }


    return (
        <div className={`music-card ${isPlaying ? 'playing' : ''}`}> {/* Add class based on isPlaying */}
            <React.Fragment>
                <div className='musicbanner'>
                    {/* <div onClick={handlePlay} className='playbutton'>
                        <AiFillPlayCircle className="playicon" />
                    </div> */}
                    <div onClick={handlePlay} className='playbutton'>
                        {isPlaying && currentPlaying.bookname === bookname && currentPlaying.page === page ? (
                            <img src={require("../assets/img/musicplaying.png")} alt="Playing" className="playicon" />
                        ) : (
                            <AiFillPlayCircle className="playicon" />
                        )}
                    </div>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}>
                        <img src={require("../assets/img/" + img)} alt={bookname} className='musiccardimage' />
                    </div>
                    <div className='labelcontainer'>
                        <Name name={page} className={"page-name"} length={page.length} />
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '5px',
                            alignItems: 'center',
                        }}>
                            <React.Fragment>

                                <Name name={bookname} className={"book-name"} length={bookname.length} />
                                <p> </p>
                                {/* 次數通過 */}
                                <Name name={`播放次數 : ${musicplay || 0} 次`} className={"book-name"} length={bookname.length} />
                                <p> </p>
                            </React.Fragment>
                        </div>
                    </div>

                    <div className='passicon'>
                        <Name name={complete === '通過' ? <FcApproval size={50} /> : ' '} className={complete === '通過' ? "timeplayed" : "timeplayednotcomplete"} />
                    </div>
                </div>
            </React.Fragment>
        </div>
    );
}

export default MusicCard;