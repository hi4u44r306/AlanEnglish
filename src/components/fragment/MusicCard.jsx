import React, {useEffect, useState} from 'react';
import '../assets/scss/MusicCard.scss';
import PlayCircleFilledWhiteIcon from "@material-ui/icons/PlayCircleFilledWhite";
import {useDispatch} from "react-redux";
import {increaseTimesPlayed, setCurrentPlaying} from "../../actions/actions";
import Name from "./Name";
import {Skeleton} from "@material-ui/lab";
import Box from "@material-ui/core/Box";

import firebase from '../Pages/firebase'
import TodoList from './testMusicList';

function MusicCard(props) {
    const {bookname , page , img} = props.music;
    const [timesplayed, setTimesPlayed] = useState();
    const [count, setCount] = useState(0);

///////////////////////////////////////////////////////////
    // const db = firebase.firestore();


    // const getUserInfo = (user) =>{  //從firestore取得 student 集合中選取符合user.uid的資訊
    //     if(user){
    //         db.collection('student').doc(user.uid).get().then( doc => {
    //             setTimesPlayed(user.uid);
    //             // checkfirestoreandrealtimeid(user.uid);
    //         }, err =>{
    //             console.log(err.message);
    //         });
    //     }else{

    //     }
    // }    
    // const counter = () => {
    //     setCount(count+1);
    //     console.log(count);
    // };

    // const updateCount = (user) => {
    //     if(user){
    //         db.collection('student').doc(user.uid).update({
    //             timesplayed : count,
    //         })
    //     }else{

    //     }
    // }
    // firebase.auth().onAuthStateChanged(user => {
    //     if(user){
    //         db.collection('student').onSnapshot(snapshot =>{
    //             getUserInfo(user);
    //             updateCount(user);
    //         }, err =>{
    //             console.log(err.message);
    //         });
    //     }else{
    //         getUserInfo();
    //     }
    // })
    

////////////////////////////////////////////////////////////

    const [isHovered, setHovered] = useState(false);

    function handleResponse() {
        setHovered(!isHovered);
    }

    const dispatch = useDispatch();

    function handlePlay() {
        dispatch(setCurrentPlaying(props.music))
        // dispatch(increaseTimesPlayed(props.music.id));
    }

    const [loaded,setLoaded] = useState(false);

    useEffect(()=>{
        setLoaded(true)
    },[]);

    return (
        <div className={"music-card"}>
            {
                !loaded ?
                <div className={"Skeleton-top"}>
                    <Skeleton variant="rect" width={210} height={210} />
                    <Box pt={0.5}>
                        <Skeleton />
                        <Skeleton width="60%" />
                    </Box>
                </div>
                    :
                    <>
                        <div onClick={handlePlay}  className={"music-card-cover"} onMouseOver={handleResponse}>
                            <img src={require("../assets/img/" + img).default} alt={bookname}/>
                            <div className="play-circle">
                                <PlayCircleFilledWhiteIcon/>
                            </div>
                            {/* <div className="play-circle" onClick={counter}>
                                <PlayCircleFilledWhiteIcon/>
                            </div> */}
                        </div>
                        <React.Fragment>
                            <Name name={bookname} className={"song-name"} length={bookname.length}/>
                            <Name name={page} className={"song-name"} length={page.length}/>
                            {/* <div className='timesplayedcontainer'>
                                <h6 className={"timesplayedlabel"}>播放次數:</h6>
                                <h6 className={"timesplayednumber"}>{timesplayed}</h6>
                                <h6>{count}</h6>
                            </div> */}
                        </React.Fragment>
                    </>
            }


        </div>
    );
}

export default MusicCard;