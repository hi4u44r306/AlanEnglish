import React, { useEffect, useState } from 'react';
import '../assets/scss/MusicCard.scss';
import ScaleLoader from "react-spinners/ScaleLoader";
import { AiFillPlayCircle } from "react-icons/ai";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentMargin, setCurrentPlaying, setNoInteractionCount } from "../../actions/actions";
import Name from "./Name";
import { child, onValue, ref } from 'firebase/database';
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';
import { rtdb } from '../Pages/firebase-config';
import { FcApproval } from "react-icons/fc";
import { setPlayPauseStatus } from "../../actions/actions";

function MusicCard(props) {
    const dispatch = useDispatch();
    const { bookname, page, musicName } = props.music;
    const useruid = localStorage.getItem('ae-useruid');
    const [complete, setComplete] = useState();
    const [musicplay, setMusicPlay] = useState();
    const [audioURL, setAudioURL] = useState('');
    const convertmusicName = bookname + ' ' + page;

    const currentPlaying = useSelector(state => state.musicReducer.playing);
    const isPlaying = currentPlaying && currentPlaying.bookname === bookname && currentPlaying.page === page;

    useEffect(() => {
        // Fetch play count and completion status
        const dbRef = ref(rtdb);
        const completeRef = child(dbRef, `student/${useruid}/MusicLogfile/${convertmusicName}/complete`);
        const musicplayRef = child(dbRef, `student/${useruid}/MusicLogfile/${convertmusicName}/musicplay`);

        onValue(musicplayRef, (snapshot) => {
            setMusicPlay(snapshot.exists() ? snapshot.val() : 0);
        }, (error) => {
            console.error("Error fetching musicplay value:", error);
        });

        onValue(completeRef, (snapshot) => {
            setComplete(snapshot.exists() ? snapshot.val() : null);
        }, (error) => {
            console.error("Error fetching complete value:", error);
        });
    }, [convertmusicName, useruid]);

    async function fetchAudioURL() {
        const storage = getStorage();
        try {
            const audioPath = storageRef(storage, `Music/${musicName}`);
            const audioDownloadURL = await getDownloadURL(audioPath);
            setAudioURL(audioDownloadURL);
            return audioDownloadURL;
        } catch (error) {
            console.error("Error fetching audio URL:", error);
        }
    }


    function handlePlay() {
        fetchAudioURL();
        if (!musicName) {
            console.error("Music name is undefined.");
            return;
        }

        dispatch(setCurrentMargin('100px'));
        dispatch(setNoInteractionCount(0));
        if (isPlaying) {
            dispatch(setPlayPauseStatus(false)); // Pause music
        } else {
            dispatch(setCurrentPlaying({ ...JSON.parse(JSON.stringify(props.music)), audioURL }, true));
            dispatch(setPlayPauseStatus(true)); // Play music
        }
    }

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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img src={require("../assets/img/headphone.png")} alt={bookname} className='musiccardimage' />
                </div>
                <div className='labelcontainer'>
                    <Name name={page} className={"page-name"} length={page.length} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                        <Name name={bookname} className={"book-name"} length={bookname.length} />
                        <Name name={`播放次數 : ${musicplay || 0} 次`} className={"book-name"} length={bookname.length} />
                    </div>
                </div>
                <div className='passicon'>
                    {complete === '通過' ? <FcApproval size={50} /> : ' '}
                </div>
            </div>
        </div>
    );
}

export default MusicCard;
