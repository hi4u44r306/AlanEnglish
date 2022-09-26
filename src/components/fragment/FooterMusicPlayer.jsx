import 'react-h5-audio-player/lib/styles.css';
import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
import React, {useRef, useState, useEffect} from "react";
import '../assets/scss/FooterPlayer.scss';
import {Avatar} from "@material-ui/core";
import Name from "./Name";
import {useDispatch, useSelector} from "react-redux";
import {setBannerOpen, setCurrentPlaying, increaseTimesPlayed} from "../../actions/actions";
import Button from "@material-ui/core/Button";
// import firebase from 'firebase/app';


function FooterMusicPlayer({music}) {

    const [{ id, bookname, page , img, musicName}, setCurrTrack] = useState(music);
    const [bannerToggle,setBannerToggle] = useState(false);
    const audioElement = useRef();
    const dispatch = useDispatch();
    const {playlists} = useSelector(state => state.musicReducer);
    // const db = firebase.firestore();

    const handleBannerToggle = ()=> {
        setBannerToggle(!bannerToggle);
    };

    useEffect(()=>{
        dispatch(setBannerOpen(bannerToggle));
    },[dispatch,bannerToggle]);

    useEffect(() => {
        setCurrTrack(music);
    }, [music]);

    // firebase.auth().onAuthStateChanged(user => { //從firestore取得student 集合中的登入中的useruid
    //     if(user){
    //         db.collection('student').onSnapshot(snapshot =>{
    //             increaseTimesPlayedToFirestore(user);
    //         });
    //     }else{
    //         increaseTimesPlayedToFirestore();
    //     }
    // })


    // const increaseTimesPlayedToFirestore = (user) => {
    //     const test = "'" + id + "'";
    //     db.collection("student").doc(user.uid).collection('Musics').doc(test).set({
    //         timeplayed : "1",
    //     });
    // }

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
        // increaseTimesPlayedToFirestore();
        let currTrackId = (id+1) % playlists.length;
        dispatch(setCurrentPlaying(playlists[currTrackId]), increaseTimesPlayed(music.id));
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
        </div>

    );
}


export default FooterMusicPlayer;