import React, { useEffect, useState } from 'react';
import '../assets/scss/Containerfull.scss';
import MainNavbar from './MainNavbar';
import { useSelector } from 'react-redux';
import FooterMusicPlayer from './FooterMusicPlayer';

const Containerfull = ({ children }) => {

    const { playing, curr_margin } = useSelector(state => state.musicReducer);
    const [currMusic, setCurrMusic] = useState(null);
    const noInteractionCount = localStorage.getItem('ae-no-interaction');

    useEffect(() => {
        if (noInteractionCount >= 10) {
            setCurrMusic('');
        } else {
            setCurrMusic(playing);
        }
    }, [noInteractionCount, playing])
    return (
        <>
            <div style={{
                position: 'fixed',
                top: 0,
                width: '100%',
                zIndex: 100,
                height: '10vh',
                backgroundColor: 'white',
                userSelect: 'none',
            }}>
                <MainNavbar />
            </div>
            <div style={{
                marginTop: '10vh',
                marginBottom: curr_margin,
                userSelect: 'none',
            }}>
                {children}
            </div>
            <div style={{
                position: 'fixed',
                bottom: 0,
                width: '100%',
                zIndex: 100,
                userSelect: 'none',
            }}>
                {
                    currMusic &&
                    (
                        <>
                            <FooterMusicPlayer music={currMusic} />
                            {/* <BigScreen music={currMusic} /> */}
                        </>
                    )
                }
            </div>
        </>
    );
}

export default Containerfull;