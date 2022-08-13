import React, {useEffect, useState} from 'react';
import '../assets/scss/CurrentPlayingLarge.scss';
import {useSelector} from "react-redux";

function CurrentPlayingLarge() {

    const {playing} = useSelector(state => state.musicReducer);
    const [{img,bookname,page},setCurrPlaying] = useState(playing);
    useEffect(()=>{
        setCurrPlaying(playing);
    },[playing]);

    return (
        <div  className={"CurrentPlayingLarge"}>
            <img className={"banner"} alt=""/>
            <div className="music-left">
                <div className="wrapper">
                    <img className={"music-cover"} src={require("../assets/img/"+img).default} alt=""/>
                    <div className="detail">
                        <h5>{bookname}</h5>
                        <p>{page}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CurrentPlayingLarge;
