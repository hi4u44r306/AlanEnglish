import React from 'react';
import 'react-h5-audio-player/lib/styles.css';
import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
import Name from "./Name";
import '../assets/scss/FooterEmpty.scss';
import Marquee from "react-fast-marquee";


function FooterEmpty() {

    return (
        <div className={"footer-player"}>
        <AudioPlayer
            autoPlay
            progressUpdateInterval={50}
            showSkipControls={true}
            showJumpControls={false}
            customProgressBarSection={
                [
                <Marquee 
                pauseOnHover={false}
                gradient={false}
                direction='right'
                speed={70}
                >
                    <Name name={"No Music"} className={"emptysong-name"}/>
                </Marquee>,
            ]
            }
            customControlsSection={[
                RHAP_UI.MAIN_CONTROLS,
                RHAP_UI.VOLUME_CONTROLS,
            ]}
        />          
    </div>
    );
}

export default FooterEmpty;