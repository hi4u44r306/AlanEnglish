import 'react-h5-audio-player/lib/styles.css';
import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
import React, {useRef, useState, useEffect} from "react";
import '../assets/scss/FooterPlayer.scss';
import {Avatar} from "@material-ui/core";
import Name from "./Name";
import {useDispatch, useSelector} from "react-redux";
import {setBannerOpen, setCurrentPlaying} from "../../actions/actions";
import { toast, ToastContainer} from "react-toastify"
import Button from "@material-ui/core/Button";
import firebase from 'firebase/app';


function FooterMusicPlayer({music}) {

    const [{ id, bookname, page , img, musicName}, setCurrTrack] = useState(music);
    const [bannerToggle,setBannerToggle] = useState(false);
    const [currentuser,setCurrUser] = useState();
    const audioElement = useRef();
    const dispatch = useDispatch();
    const {playlists} = useSelector(state => state.musicReducer);
    const db = firebase.firestore();
    const currplayingmusicid = "'" + id + "'";


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

    const handleBannerToggle = ()=> {
        setBannerToggle(!bannerToggle);
    };

    useEffect(()=>{
        dispatch(setBannerOpen(bannerToggle));
    },[dispatch,bannerToggle]);

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
    })
    
    
    const updatetimeplayedtofirestore = () => {
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
    }

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
                progressUpdateInterval={50}
                ref={audioElement}
                src={require("../assets/music/" + musicName).default}
                showSkipControls={true}
                showJumpControls={false}
                onClickNext={handleClickNext}
                onClickPrevious={handleClickPrev}
                onEnded={handleEnd}
                customControlsSection=
                {
                    [
                        RHAP_UI.ADDITIONAL_CONTROLS,
                        RHAP_UI.MAIN_CONTROLS,
                        <Button
                            startIcon={<Avatar variant="square" src={require("../assets/img/" + img).default} alt={bookname}/>}
                            onClick={handleBannerToggle}
                            className="curr-music-container">
                            <div className="curr-music-details">
                                <Name name={bookname} className={"song-name"} length={bookname.length}/>
                                <Name name={page} className={"song-name"} length={page.length}/>
                            </div> 
                        </Button>,
                        
                        RHAP_UI.VOLUME_CONTROLS,
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