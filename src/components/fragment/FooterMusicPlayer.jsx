import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
import React, { useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentPlaying } from "../../actions/actions";
import { toast, ToastContainer } from "react-toastify"
import Name from "./Name";
import '../assets/scss/FooterPlayer.scss';
import 'react-h5-audio-player/lib/styles.css';
import { rtdb } from '../Pages/firebase-config';
import { get, ref, set, update } from 'firebase/database';
import { setPlayPauseStatus } from "../../actions/actions";


function FooterMusicPlayer({ music }) {
    const [{ bookname, page, musicName }, setCurrTrack] = useState(music);
    const { playlists } = useSelector(state => state.musicReducer);
    const userId = localStorage.getItem('ae-useruid')
    const dispatch = useDispatch();
    const audioElement = useRef();

    const [noInteractionCount, setNoInteractionCount] = useState(0);
    const interactionTimer = useRef(null);

    const resetInteractionTimer = () => {
        clearTimeout(interactionTimer.current);
        interactionTimer.current = setTimeout(() => {
            // Reset count if no interaction happens for a certain time (e.g., 5 minutes)
            setNoInteractionCount(0);
            localStorage.setItem('ae-no-interaction', 0)
        }, 300000); // 5 minutes in milliseconds
    };

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

    const warning = () => {
        toast.warning(
            <div className="noInteractionCountWarning">
                偵測到持續播放但未操作，即將停止播放
                <div>
                    <button
                        onClick={() => {
                            toast.dismiss(); // Dismiss the warning toast when the button is clicked
                            setNoInteractionCount(0)
                            localStorage.setItem('ae-no-interaction', 0);
                            console.log(localStorage.getItem('ae-no-interaction'));
                        }}
                        style={{
                            padding: '5px 10px',
                            backgroundColor: '#ff3c00',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                        }}
                    >
                        解除警告
                    </button>
                </div>
            </div>,
            {
                className: "noInteractionCountWarning",
                closeButton: true,
                position: "top-center",
                autoClose: false,
                // autoClose: 10000,
                hideProgressBar: false,
                closeOnClick: false,
                pauseOnHover: false,
                draggable: false,
                progress: undefined,
                theme: "colored",
            });
    };

    useEffect(() => {
        setCurrTrack(music);
    }, [music, noInteractionCount]);

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

    const currentTrack = playlists.findIndex(obj => obj.musicName === musicName)
    const handleClickNext = () => {
        // setCounting(localStorage.setItem('counting', 0))
        console.log('Next Track')
        setNoInteractionCount(0); // Reset on user interaction
        localStorage.setItem('ae-no-interaction', 0)
        resetInteractionTimer();
        let abc = currentTrack + 1;
        if ((currentTrack + 1) >= playlists.length) {
            abc = 0;
        }
        dispatch(setCurrentPlaying(playlists[abc]));
    };

    const handleClickPrev = () => {
        // setCounting(localStorage.setItem('counting', 0))
        console.log('Previous Track')
        setNoInteractionCount(0); // Reset on user interaction
        localStorage.setItem('ae-no-interaction', 0)
        resetInteractionTimer();
        let abc = currentTrack - 1;
        if ((currentTrack - 1) <= -1) {
            abc = playlists.length - 1;
        }
        dispatch(setCurrentPlaying(playlists[abc]));
    };

    const handleEnd = () => {
        // setCounting(localStorage.setItem('counting', 0))
        console.log('Track End')
        console.log(noInteractionCount);
        let abc = currentTrack + 1;
        if ((currentTrack + 1) >= playlists.length) {
            abc = 0;
            success();
            updatetimeplayedtorealtimedatabase();
            dispatch(setCurrentPlaying(playlists[abc]));
        } else {
            success();
            updatetimeplayedtorealtimedatabase();
            dispatch(setCurrentPlaying(playlists[abc]));
        }


        let nextTrack = (currentTrack + 1) >= playlists.length ? 0 : currentTrack + 1;
        setNoInteractionCount(prev => prev + 1);
        localStorage.setItem('ae-no-interaction', noInteractionCount);


        // Check if the user is continuously playing tracks without interaction
        if (noInteractionCount >= 9) { // Threshold of 10 consecutive tracks without interaction
            warning();

        } else {
            // Proceed to the next track if within threshold
            dispatch(setCurrentPlaying(playlists[nextTrack]));
            updatetimeplayedtorealtimedatabase();
        }


        resetInteractionTimer();
    }

    return (
        <div className={"footer-player"}>

            <AudioPlayer
                autoPlay={true}
                loop={null}
                progressUpdateInterval={50}
                ref={audioElement}
                src={require("../assets/music/" + musicName)}
                showSkipControls={true}
                showJumpControls={false}
                onClickNext={handleClickNext}
                onClickPrevious={handleClickPrev}
                onEnded={handleEnd}
                onPlay={() => { dispatch(setPlayPauseStatus(true)); }} // Dispatch when playing
                onPause={() => { dispatch(setPlayPauseStatus(false)); }} // Dispatch when paused
                customProgressBarSection={
                    [
                        RHAP_UI.CURRENT_TIME,
                        // <Marquee
                        //     pauseOnHover={false}
                        //     gradient={true}
                        //     gradientWidth={30}
                        //     direction='right'
                        //     speed={60}
                        // >

                        // </Marquee>,
                        <div style={{
                            display: 'flex',
                            gap: '5px',
                        }}>
                            <div>
                                <Name name={bookname} className={"marqueename"} length={bookname.length} />
                            </div>
                            <div>
                                <Name name={page} className={"marqueename"} length={page.length} />
                            </div>
                        </div>,
                        RHAP_UI.DURATION,
                    ]
                }
                customControlsSection={[
                    RHAP_UI.MAIN_CONTROLS,
                    RHAP_UI.VOLUME_CONTROLS,
                ]}
            />
            {/* {counting} */}
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