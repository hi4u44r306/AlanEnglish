import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
import React, { useRef, useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { setCurrentPlaying } from "../../actions/actions";
import { toast, ToastContainer } from "react-toastify"
import Name from "./Name";
import '../assets/scss/FooterPlayer.scss';
import 'react-h5-audio-player/lib/styles.css';
import { rtdb, getstorage as storage } from '../Pages/firebase-config';
import { get, ref, set, update } from 'firebase/database';
import { setPlayPauseStatus } from "../../actions/actions";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { useParams } from 'react-router-dom';


function FooterMusicPlayer({ music }) {
    const playlists = JSON.parse(localStorage.getItem('ae-playlistData'));
    const [{ bookname, page, musicName }, setCurrTrack] = useState(music);
    const userId = localStorage.getItem('ae-useruid')
    const dispatch = useDispatch();
    const audioElement = useRef();
    const { playlistId } = useParams();
    const musicRoot = playlists[playlistId];



    const success = () => {
        toast.success(`聽力次數 + 1`, {
            className: "musicnotification",
            position: "top-center",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            theme: "colored",
        });
    };

    // const warning = () => {
    //     toast.warning(
    //         <div className="noInteractionCountWarning">
    //             偵測到持續播放但未操作，即將停止播放
    //             <div>
    //                 <button
    //                     onClick={() => {
    //                         toast.dismiss(); // Dismiss the warning toast when the button is clicked
    //                         // setNoInteractionCount(0)
    //                         localStorage.setItem('ae-no-interaction', 0);
    //                         console.log(localStorage.getItem('ae-no-interaction'));
    //                     }}
    //                     style={{
    //                         padding: '5px 10px',
    //                         backgroundColor: '#ff3c00',
    //                         color: '#fff',
    //                         border: 'none',
    //                         borderRadius: '5px',
    //                         cursor: 'pointer',
    //                     }}
    //                 >
    //                     解除警告
    //                 </button>
    //             </div>
    //         </div>,
    //         {
    //             className: "noInteractionCountWarning",
    //             closeButton: true,
    //             position: "top-center",
    //             autoClose: false,
    //             // autoClose: 10000,
    //             hideProgressBar: false,
    //             closeOnClick: false,
    //             pauseOnHover: false,
    //             draggable: false,
    //             progress: undefined,
    //             theme: "colored",
    //         });
    // };

    function updatetimeplayedtorealtimedatabase() {

        // 在RTDB新增次數、達到100次才能打勾
        const convertmusicName = bookname + ' ' + page;
        // const convertmusicName = musicName.replace(/^(.*?)\/(.*?)\.mp3$/, '$2');
        async function updateMusicPlay(userId, convertmusicName) {
            try {
                // Create a reference to the specific music entry
                const musicRef = ref(rtdb, '/student/' + userId + '/MusicLogfile/' + convertmusicName + '/');

                // Get the current `musicplay` value (if it exists)
                const snapshot = await get(musicRef);
                const currentMusicPlay = snapshot.exists() ? snapshot.val().musicplay : 0;

                // Update the `musicplay` value and check the condition
                const newMusicPlay = currentMusicPlay + 1; // Increment by 1
                if (newMusicPlay >= 100) {
                    await update(musicRef, { musicplay: newMusicPlay, complete: '通過' });
                } else {
                    await update(musicRef, { musicplay: newMusicPlay });
                }
            } catch (error) {
                console.error("Error updating music play:", error);
                // Handle errors appropriately, e.g., display an error message to the user
            }
        }
        updateMusicPlay(userId, convertmusicName);

        // 在RTDB新增每 日 播放次數
        async function updateRTDBDayMusicPlay(userId) {
            try {
                // Create a reference to the specific music entry
                const musicRef = ref(rtdb, '/student/' + userId + '/Daytotaltimeplayed'); // Access directly

                // Get the current `totaltimeplayed` value (if it exists) using `once`
                const snapshot = await get(musicRef, { once: true }); // Fetch once
                const currentMusicPlay = snapshot.exists() ? snapshot.val() : 0;

                // Update the `totaltimeplayed` value using `set`
                const newMusicPlay = currentMusicPlay + 1; // Increment by 1
                await set(musicRef, newMusicPlay);

            } catch (error) {
                console.error("Error updating music play:", error);
                // Handle errors appropriately, e.g., display an error message to the user
            }
        }
        updateRTDBDayMusicPlay(userId);


        // 在RTDB新增每 月 播放次數
        async function updateRTDBMonthMusicPlay(userId) {
            try {
                // Create a reference to the specific music entry
                const musicRef = ref(rtdb, '/student/' + userId + '/Monthtotaltimeplayed'); // Access directly

                // Get the current `totaltimeplayed` value (if it exists) using `once`
                const snapshot = await get(musicRef, { once: true }); // Fetch once
                const currentMusicPlay = snapshot.exists() ? parseInt(snapshot.val(), 10) : 0; // Ensure it's a number

                // Update the `totaltimeplayed` value using `set`
                const newMusicPlay = currentMusicPlay + 1; // Increment by 1
                await set(musicRef, newMusicPlay);

            } catch (error) {
                console.error("Error updating music play:", error);
                // Handle errors appropriately, e.g., display an error message to the user
            }
        }

        // Call the function with the userId
        updateRTDBMonthMusicPlay(userId);
    };

    useEffect(() => {
        setCurrTrack(music);
        if (music.musicName) {
            fetchAudioURL(music.musicName);
        }
    }, [music]);

    const [audioURL, setAudioURL] = useState(null);
    const fetchAudioURL = async (fileName) => {
        try {
            const fileRef = storageRef(storage, `Music/${fileName}`);
            console.log(fileRef);
            const url = await getDownloadURL(fileRef);
            setAudioURL(url);
        } catch (error) {
            console.error("Error fetching audio URL from Firebase Storage:", error);
        }
    };

    const handleClickNext = () => {
        const currentIndex = musicRoot.findIndex(obj => obj.musicName === musicName);
        const nextIndex = (currentIndex + 1) % musicRoot.length;
        dispatch(setCurrentPlaying(musicRoot[nextIndex]));
    };

    const handleClickPrev = () => {
        const currentIndex = musicRoot.findIndex(obj => obj.musicName === musicName);
        const prevIndex = (currentIndex - 1) % musicRoot.length;
        dispatch(setCurrentPlaying(musicRoot[prevIndex]));
    };

    const handleEnd = () => {
        console.log('Track End');
        const currentIndex = musicRoot.findIndex(obj => obj.musicName === musicName);
        const nextIndex = (currentIndex + 1) % musicRoot.length;

        // 用戶沒反應次數達到10次
        // setNoInteractionCount(prev => prev + 1);
        // localStorage.setItem('ae-no-interaction', noInteractionCount);

        // if (noInteractionCount >= 9) {
        //     warning(); // Show warning message when no interaction count reaches the threshold
        // } else {
        //     // Update current playing track
        //     dispatch(setCurrentPlaying(musicRoot[nextIndex]));
        //     updatetimeplayedtorealtimedatabase(); // Update time played to real-time database
        // }

        // Handle music playback and success
        if ((music + 1) >= playlists.length) {
            success(); // Call success if it's the last track
            updatetimeplayedtorealtimedatabase(); // Update time played to real-time database
            dispatch(setCurrentPlaying(playlists[0])); // Restart playlist from the beginning
        } else {
            success(); // Call success for each track
            updatetimeplayedtorealtimedatabase(); // Update time played to real-time database
            dispatch(setCurrentPlaying(musicRoot[nextIndex])); // Continue to the next track
        }
        // resetInteractionTimer(); // Reset the interaction timer
        dispatch(setCurrentPlaying(musicRoot[nextIndex]));
    };

    return (
        <div className={"footer-player"}>

            <AudioPlayer
                autoPlay={true}
                loop={null}
                progressUpdateInterval={50}
                ref={audioElement}
                src={audioURL}
                showSkipControls={true}
                showJumpControls={false}
                onClickNext={handleClickNext}
                onClickPrevious={handleClickPrev}
                onEnded={handleEnd}
                onPlay={() => dispatch(setPlayPauseStatus(true))}
                onPause={() => dispatch(setPlayPauseStatus(false))}
                customProgressBarSection={[
                    RHAP_UI.CURRENT_TIME,
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <Name name={bookname} className="marqueename" length={bookname.length} />
                        <Name name={page} className="marqueename" length={page.length} />
                    </div>,
                    RHAP_UI.DURATION,
                ]}
                customControlsSection={[
                    RHAP_UI.MAIN_CONTROLS,
                    RHAP_UI.VOLUME_CONTROLS,
                ]}
            />
            <div>
                <ToastContainer
                    position="top-center"
                    autoClose={2000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                />
            </div>
        </div>

    );
}


export default FooterMusicPlayer;