import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
import React, { useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentPlaying } from "../../actions/actions";
import { toast, ToastContainer } from "react-toastify"
import Marquee from "react-fast-marquee";
import firebase from 'firebase/app';
import Name from "./Name";
import '../assets/scss/FooterPlayer.scss';
import 'react-h5-audio-player/lib/styles.css';


function FooterMusicPlayer({ music }) {

    const [{ bookname, page, musicName }, setCurrTrack] = useState(music);
    const { playlists } = useSelector(state => state.musicReducer);
    const userId = localStorage.getItem('ae-useruid')
    const db = firebase.firestore(); // firestore
    const dispatch = useDispatch();
    const audioElement = useRef();
    const currentMonth = new Date().toJSON().slice(0, 7);
    const userRef = db.collection('student').doc(userId);


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
        userRef.get().then((doc) => {
            const daily = doc.data().currdatetimeplayed + 1;
            const total = doc.data().totaltimeplayed + 1;

            userRef.update({
                currdatetimeplayed: daily,
                totaltimeplayed: total,
            });
        }).catch((error) => {
            console.log(error);
        });

        // 當月總次數 +1
        const usermonthlytimes = userRef.collection('Logfile').doc(currentMonth)
        usermonthlytimes.get().then((doc) => {
            const monthlytotal = doc.data().currentMonthTotalTimes + 1;
            usermonthlytimes.update({
                currentMonthTotalTimes: monthlytotal,
            })
        }).catch(() => {
            usermonthlytimes.set({
                currentMonthTotalTimes: 1,
            })
        })
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
                autoPlay
                loop={null}
                progressUpdateInterval={50}
                ref={audioElement}
                src={require("../assets/music/" + musicName).default}
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
                            gradientWidth={40}
                            direction='right'
                            speed={60}
                        >
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