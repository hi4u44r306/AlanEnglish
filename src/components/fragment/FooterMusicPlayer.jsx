import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
import React, {useRef, useState, useEffect} from "react";
import {useDispatch, useSelector} from "react-redux";
import {setCurrentPlaying} from "../../actions/actions";
import { toast, ToastContainer} from "react-toastify"
import Marquee from "react-fast-marquee";
import firebase from 'firebase/app';
import Name from "./Name";
import '../assets/scss/FooterPlayer.scss';
import 'react-h5-audio-player/lib/styles.css';


function FooterMusicPlayer({music}) {

    const [{ id, bookname, page , musicName}, setCurrTrack] = useState(music);
    const {playlists} = useSelector(state => state.musicReducer);
    const [currentuser,setCurrUser] = useState();
    const currplayingmusicid = "'" + id + "'";
    const db = firebase.firestore();
    const dispatch = useDispatch();
    const audioElement = useRef();

    const success = () =>  {
        toast.success('太棒了 聽力次數+1',{
            className:"musicnotification",
            position: "top-center",
            autoClose: 2500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            });
        };

    const secondsuccess = () =>  {
        toast.info('再多聽幾次可以跟老師換禮物喔!!',{
            className:"musicnotification",
            position: "top-center",
            autoClose: 2500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            });
        };

    useEffect(() => {
        setCurrTrack(music);
    }, [music]);
        
    firebase.auth().onAuthStateChanged(user => { //從firestore取得student 集合中的登入中的useruid
        if(user){
            db.collection('student').onSnapshot(snapshot =>{
                setCurrUser(user.uid);
            });
        }else{
            updatetimeplayedtofirestore();
        }
    });
    
    const updatetimeplayedtofirestore = () => {
        console.log("normal timeplayed updated")
        if(currplayingmusicid){
            db.collection('student').doc(currentuser).collection('Musics').doc(currplayingmusicid).get().then((doc)=>{
                const aa = doc.data().timeplayed;
                const bb = parseInt(aa)+1;
                db.collection('student').doc(currentuser).collection('Musics').doc(currplayingmusicid).set({
                    timeplayed: bb,
                })
                .then(() => {
                    console.log("Document successfully written!");
                })
                .catch((error) => {
                    console.error("Error writing document: ", error);
                });
            }).catch((err)=>{
                console.log(err.message);
            })
        }else{
            console.log("update currplayingmusicid failed");
        }
    };

    const update_repeat_timeplayed = () => {
        console.log("repeat timeplayed updated")
        if(currplayingmusicid){
            db.collection('student').doc(currentuser).collection('Musics').doc(currplayingmusicid).get().then((doc)=>{
                const aa = doc.data().timeplayed;
                const bb = parseInt(aa)+1;
                db.collection('student').doc(currentuser).collection('Musics').doc(currplayingmusicid).set({
                    timeplayed: bb,
                })
                .then(() => {
                    console.log("Document successfully written!");
                })
                .catch((error) => {
                    console.error("Error writing document: ", error);
                });
            }).catch((err)=>{
                console.log(err.message);
            })
        }else{
            console.log("update currplayingmusicid failed");
        }
    };
    
    const handleClickNext = () => {
        console.log('click next')
        let currTrackId = (id+1) % playlists.length;
        dispatch(setCurrentPlaying(playlists[currTrackId]));
    };

    const handleClickPrev = () => {
        console.log('end')
        let currTrackId = (id-1) % playlists.length;
        if ((id-1)<=-1){
            currTrackId = playlists.length - 1;
        }
        dispatch(setCurrentPlaying(playlists[currTrackId]));
    };

    const handleEnd = () =>{
        console.log('end')
        const currplayingmusicid = "'" + id + "'";
        updatetimeplayedtofirestore(currplayingmusicid);
        success();
        secondsuccess();
        let currTrackId = (id+1) % playlists.length;
        dispatch(setCurrentPlaying(playlists[currTrackId]));
    }
    
    
    return (
        <div className={"footer-player"}>
            <AudioPlayer
                autoPlay
                onSeeked={update_repeat_timeplayed}
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
                        pauseOnHover={true}
                        gradient={true}
                        gradientWidth={40}
                        direction='right'
                    speed={60}
                    >
                        <div>
                            <Name name={"正在收聽的是 : "} className={"marqueenamelabel"} length={bookname.length}/>
                        </div>
                        <div>
                            <Name name={bookname} className={"marqueename"} length={bookname.length}/>
                        </div>
                        <div>
                            <Name name={page} className={"marqueename"} length={page.length}/>
                        </div>
                        <div>
                            <Name name={"請專心聆聽"} className={"marqueenamelabel"} length={page.length}/>
                        </div>
                        
                    </Marquee>,
                    RHAP_UI.DURATION,
                ]
                }
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