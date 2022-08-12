import 'react-h5-audio-player/lib/styles.css';
import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
// import React, {useContext, useEffect, useRef, useState} from "react";
import React, {useRef, useState, useEffect} from "react";
import '../assets/scss/FooterPlayer.scss';
import {Avatar} from "@material-ui/core";
// import ControlsToggleButton from "./ControlsToggleButton";
import Name from "./Name";
// import {ThemeContext} from "../../api/Theme";
import {useDispatch, useSelector} from "react-redux";
import {setBannerOpen, setCurrentPlaying} from "../../actions/actions";
import Button from "@material-ui/core/Button";


function FooterMusicPlayer({music}) {
    // const [{id, bookname, page , img, musicName}, setCurrTrack] = useState(music);
    // const [isRepeatClicked, setRepeatClick] = useState(false);
    // const [isPlaying, setPlayPauseClicked] = useState(false);
    // const [isVolumeClicked, setVolumeClicked] = useState(false);
    // const [volume, setVolume] = useState(100);
    // const [seekTime, setSeekTime] = useState(1);
    // const [duration, setDuration] = useState(0);
    // const [currTime, setCurrTime] = useState(0);
    // const useStyle = useContext(ThemeContext);
    // const pointer = { cursor: "pointer",  color: useStyle.theme };

    // const handleToggle = (type, val) => {
    //     switch (type) {
    //         case "repeat":
    //             setRepeatClick(val);
    //             break;
    //         case "prev":
    //             setPrevClicked(val);
    //             break;
    //         case "play-pause":
    //             setPlayPauseClicked(val);
    //             break;
    //         case "next":
    //             setNextClicked(val);
    //             break;
    //         case "volume":
    //             setVolumeClicked(val);
    //             break;
    //         default:
    //             break;
    //     }
    // };
    // const handleSeekChange = (event, newValue) => {
    //     audioElement.current.currentTime =(newValue*duration)/100;
    //     setSeekTime(newValue)
    // };
    // const handleVolumeChange = (event, newValue) => {
    //     setVolume(newValue);
    // };
    // useEffect(() => {
    //     isPlaying
    //         ? audioElement.current.play().then(()=>{}).catch((e)=>{audioElement.current.pause(); audioElement.current.currentTime=0;})
    //         : audioElement.current.pause();
    //     audioElement.current.loop = isRepeatClicked;
    //     audioElement.current.volume = volume / 100;
    //     audioElement.current.muted = isVolumeClicked;
    //     audioElement.current.onloadeddata = () => {
    //         if (audioElement.current != null)
    //             setDuration(audioElement.current.duration)
    //     };
    //     setInterval(() => {
    //         if (audioElement.current !== null)
    //             setCurrTime(audioElement.current.currentTime);
    //     })
    // });
      // useEffect(() => {
    //     setSeekTime((currTime) / (duration / 100))
    // }, [currTime, duration]);



    // useEffect(()=>{
    //     audioElement.current.onended = ()=> {
    //         setNextClicked(true);
    //     };
    // })

    // useEffect(()=>{
    //     if (isNextClicked){
    //         let currTrackId = (id+1) % playlists.length;
    //         dispatch(setCurrentPlaying(playlists[currTrackId]));
    //         setNextClicked(false);
    //     }
    //     if (isPrevClicked){
    //         let currTrackId = (id-1) % playlists.length;
    //         if ((id-1)<0){
    //             currTrackId = playlists.length - 1;
    //         }
    //         dispatch(setCurrentPlaying(playlists[currTrackId]));
    //         setPrevClicked(false);
    //     }
    // },[dispatch, id, isNextClicked, isPrevClicked, playlists]);


    // function formatTime(secs) {
    //     const t = new Date(1970, 0, 1);
    //     t.setSeconds(secs);
    //     let s = t.toTimeString().substr(0, 8);
    //     if (secs > 86399)
    //         s = Math.floor((t - Date.parse("1/1/70")) / 3600000) + s.substr(2);
    //     return s.substring(3);
    // }
  
    const [{ id, bookname, page , img, musicName}, setCurrTrack] = useState(music);
    const [bannerToggle,setBannerToggle] = useState(false);
    const audioElement = useRef();
    const dispatch = useDispatch();
    const {playlists} = useSelector(state => state.musicReducer);

    const handleBannerToggle = ()=> {
        setBannerToggle(!bannerToggle);
    };

    useEffect(()=>{
        dispatch(setBannerOpen(bannerToggle));
    },[dispatch,bannerToggle]);

    useEffect(() => {
        setCurrTrack(music);
    }, [music]);

    // useEffect(()=>{
    //     if (NextClicked){
    //         let currTrackId = (id+1) % playlists.length;
    //         dispatch(setCurrentPlaying(playlists[currTrackId]));
    //         setNextClicked(false);
    //     }
    //     if (PrevClicked){
    //         let currTrackId = (id-1) % playlists.length;
    //         if ((id-1)<0){
    //             currTrackId = playlists.length - 1;
    //         }
    //         dispatch(setCurrentPlaying(playlists[currTrackId]));
    //         setPrevClicked(false);
    //     }
    // },[dispatch, id, NextClicked, PrevClicked, playlists]);
    // const [currTrackId, setTrackIndex] = React.useState(0)
    const handleClickNext = () => {
        console.log('click next')
        let currTrackId = (id+1) % playlists.length;
        dispatch(setCurrentPlaying(playlists[currTrackId]));
      };
    const handleEnd = () => {
        console.log('end')
        let currTrackId = (id-1) % playlists.length;
        if ((id-1)<=-1){
            currTrackId = playlists.length - 1;
        }
        dispatch(setCurrentPlaying(playlists[currTrackId]));
    }


    return (
        <div className={"footer-player"}>
            <audio ref={audioElement} src={require("../assets/music/" + musicName).default} preload={"metadata"}/>
            <AudioPlayer
                autoPlay
                volume="0.5"
                progressUpdateInterval={50}
                ref={audioElement}
                src={require("../assets/music/" + musicName).default}
                showSkipControls={true}
                showJumpControls={false}
                onClickNext={handleClickNext}
                onEnded={handleEnd}
                customControlsSection={
                    [
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