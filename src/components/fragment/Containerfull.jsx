import React, { useEffect, useState } from 'react';
import '../assets/scss/Containerfull.scss';
import MainNavbar from './MainNavbar';
import MusicPlayer from './MusicPlayer';
import { useSelector } from 'react-redux';

const Containerfull = ({ children }) => {
    const { playing, curr_margin } = useSelector(state => state.musicReducer);
    const [currMusic, setCurrMusic] = useState(null);

    useEffect(() => {
        const noInteractionCount = Number(
            localStorage.getItem('ae-no-interaction')
        ) || 0;

        if (noInteractionCount >= 10) {
            setCurrMusic(null);
        } else {
            setCurrMusic(playing);
        }
    }, [playing]);

    return (
        <div className="app-shell">
            <header className="app-header">
                <MainNavbar />
            </header>

            <main
                className={`app-content ${currMusic ? 'has-player' : ''}`}
                style={{
                    paddingBottom: currMusic
                        ? curr_margin || '110px'
                        : undefined
                }}
            >
                {children}
            </main>

            {currMusic && (
                <footer className="app-player">
                    <MusicPlayer music={currMusic} />
                </footer>
            )}
        </div>
    );
};

export default Containerfull;