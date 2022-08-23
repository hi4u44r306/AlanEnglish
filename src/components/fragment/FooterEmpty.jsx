import React from 'react';
import 'react-h5-audio-player/lib/styles.css';
import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
import Button from "@material-ui/core/Button";
import Name from "./Name";
import '../assets/scss/FooterEmpty.scss';


function FooterEmpty() {

    return (
        <div className={"footer-player"}>
        <AudioPlayer
            autoPlay
            progressUpdateInterval={50}
            volume={0.5}
            showSkipControls={true}
            showJumpControls={false}
            customControlsSection=
            {
                [
                    RHAP_UI.ADDITIONAL_CONTROLS,
                    RHAP_UI.MAIN_CONTROLS,
                            <Button
                            className="curr-music-container">
                            <div className="curr-music-details">
                                <Name name={"no music"} className={"emptysong-name"}/>
                            </div> 
                            </Button>,
                    RHAP_UI.VOLUME_CONTROLS,
                ]
            }
        />          
    </div>
    );
}

export default FooterEmpty;