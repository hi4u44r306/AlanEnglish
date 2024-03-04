import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
import React, { useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentPlaying } from "../../actions/actions";
import { toast, ToastContainer } from "react-toastify"
import Marquee from "react-fast-marquee";
import Name from "./Name";
import '../assets/scss/FooterPlayer.scss';
import 'react-h5-audio-player/lib/styles.css';
import { collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, rtdb } from '../Pages/firebase-config';
import { get, ref, set, update } from 'firebase/database';


function FooterMusicPlayer({ music }) {
    const [{ bookname, page, musicName }, setCurrTrack] = useState(music);
    const { playlists } = useSelector(state => state.musicReducer);
    const userId = localStorage.getItem('ae-useruid')
    const dispatch = useDispatch();
    const audioElement = useRef();
    const currentMonth = new Date().toJSON().slice(0, 7);
    const userRef = doc(db, 'student', userId);


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

    useEffect(() => {
        setCurrTrack(music);
    }, [music]);

    function updatetimeplayedtofirestore() {

        // 當日次數、總次數 +1
        getDoc(userRef)
            .then((docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    const daily = data.currdatetimeplayed + 1;
                    const total = data.totaltimeplayed + 1;

                    updateDoc(userRef, {
                        currdatetimeplayed: daily,
                        totaltimeplayed: total,
                    })
                        .catch((error) => {
                            console.error(error);
                        });
                }
            })
            .catch((error) => {
                console.error(error);
            });

        // 當月總次數 +1
        const usermonthlytimes = doc(collection(userRef, 'Logfile'), currentMonth);
        getDoc(usermonthlytimes)
            .then((docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    const monthlytotal = data.currentMonthTotalTimes + 1;
                    updateDoc(usermonthlytimes, {
                        currentMonthTotalTimes: monthlytotal,
                    })
                        .catch((error) => {
                            console.error(error);
                        });
                } else {
                    setDoc(usermonthlytimes, {
                        currentMonthTotalTimes: 1,
                    })
                        .catch((error) => {
                            console.error(error);
                        });
                }
            })
            .catch((error) => {
                console.error(error);
            });

        // 在RTDB新增次數、達到7次才能打勾
        const convertmusicName = musicName.replace(/^(.*?)\/(.*?)\.mp3$/, '$2');
        async function updateMusicPlay(userId, convertmusicName) {
            try {
                // Create a reference to the specific music entry
                const musicRef = ref(rtdb, '/student/' + userId + '/MusicLogfile/' + convertmusicName + '/');

                // Get the current `musicplay` value (if it exists)
                const snapshot = await get(musicRef);
                const currentMusicPlay = snapshot.exists() ? snapshot.val().musicplay : 0;

                // Update the `musicplay` value and check the condition
                const newMusicPlay = currentMusicPlay + 1; // Increment by 1
                if (newMusicPlay >= 7) {
                    await update(musicRef, { musicplay: newMusicPlay, complete: '通過' });
                    console.log("Music play updated and marked complete successfully!");
                } else {
                    await update(musicRef, { musicplay: newMusicPlay });
                    console.log("Music play updated successfully!");
                }
            } catch (error) {
                console.error("Error updating music play:", error);
                // Handle errors appropriately, e.g., display an error message to the user
            }
        }
        updateMusicPlay(userId, convertmusicName);


        // 在RTDB新增每 月 播放次數
        async function updateRTDBMonthMusicPlay(userId) {
            try {
                // Create a reference to the specific music entry
                const musicRef = ref(rtdb, '/student/' + userId + '/Monthtotaltimeplayed'); // Access directly

                // Get the current `totaltimeplayed` value (if it exists) using `once`
                const snapshot = await get(musicRef, { once: true }); // Fetch once
                const currentMusicPlay = snapshot.exists() ? snapshot.val() : 0;

                // Update the `totaltimeplayed` value using `set`
                const newMusicPlay = currentMusicPlay + 1; // Increment by 1
                await set(musicRef, newMusicPlay);

                console.log("Music play updated and marked complete successfully!");
            } catch (error) {
                console.error("Error updating music play:", error);
                // Handle errors appropriately, e.g., display an error message to the user
            }
        }
        updateRTDBMonthMusicPlay(userId);


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

                console.log("Music play updated and marked complete successfully!");
            } catch (error) {
                console.error("Error updating music play:", error);
                // Handle errors appropriately, e.g., display an error message to the user
            }
        }
        updateRTDBDayMusicPlay(userId);



    };

    const currentTrack = playlists.findIndex(obj => obj.musicName === musicName)
    const handleClickNext = () => {
        console.log('Next Track')
        let abc = currentTrack + 1;
        if ((currentTrack + 1) >= playlists.length) {
            abc = 0;
        }
        dispatch(setCurrentPlaying(playlists[abc]));
    };

    const handleClickPrev = () => {
        console.log('Previous Track')
        let abc = currentTrack - 1;
        if ((currentTrack - 1) <= -1) {
            abc = playlists.length - 1;
        }
        dispatch(setCurrentPlaying(playlists[abc]));
    };

    const handleEnd = () => {
        console.log('Track End')
        let abc = currentTrack + 1;
        if ((currentTrack + 1) >= playlists.length) {
            abc = 0;
            success();
            updatetimeplayedtofirestore();
            dispatch(setCurrentPlaying(playlists[abc]));
        } else {
            success();
            updatetimeplayedtofirestore();
            dispatch(setCurrentPlaying(playlists[abc]));
        }
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
                customProgressBarSection={
                    [
                        RHAP_UI.CURRENT_TIME,
                        <Marquee
                            pauseOnHover={false}
                            gradient={true}
                            gradientWidth={30}
                            direction='right'
                            speed={60}
                        >
                            <div style={{
                                display: 'flex',
                                gap: '5px',
                            }}>
                                <div>
                                    <Name name={"正在收聽的是 : "} className={"marqueenamelabel"} length={bookname.length} />
                                </div>
                                <div>
                                    <Name name={bookname} className={"marqueename"} length={bookname.length} />
                                </div>
                                <div>
                                    <Name name={page} className={"marqueename"} length={page.length} />
                                </div>
                                <div>
                                    <Name name={"請專心聆聽"} className={"marqueenamelabel"} length={page.length} />
                                </div>
                            </div>

                        </Marquee>,
                        RHAP_UI.DURATION,
                    ]
                }
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