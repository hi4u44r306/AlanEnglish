import React from 'react';
import '../assets/scss/MusicCardSpan.scss';
import { AiFillPlayCircle } from "react-icons/ai";

function MusicCardSpan({ music }) {
    return (
        <div style={{ cursor: "pointer" }} className={"MusicCardSpan"}>
            <div className={"d1"}>
                <img src={require("../assets/img/" + music.img)} alt="" />
                <div className="detail">
                    <h4>{music.name}</h4>
                </div>
            </div>
            <div className="play">
                {/* <PlayArrow fontSize={"large"}/> */}
                <AiFillPlayCircle />
            </div>
        </div>
    );
}

export default MusicCardSpan;