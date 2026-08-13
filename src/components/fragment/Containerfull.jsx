import React, { useEffect, useState } from 'react';
import '../assets/scss/Containerfull.scss';
import MainNavbar from './MainNavbar';
import '../assets/scss/BrowserCompatibility.scss';
import MusicPlayer from './MusicPlayer';
import GuidedTour from './GuidedTour';
import ConversationUXGuard from './ConversationUXGuard';
import ConversationHintCoach from './ConversationHintCoach';
import MobileOffcanvasScrollGuard from './MobileOffcanvasScrollGuard';
import AssignmentShortcut from './AssignmentShortcut';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

const MINI_PLAYER_PATHS = [
    '/student/conversation',
    '/student/ai-generator',
    '/student/assignments',
    '/teacher/assignments'
];

const Containerfull = ({ children }) => {
    const { playing, curr_margin } = useSelector(state => state.musicReducer);
    const location = useLocation();
    const [currMusic, setCurrMusic] = useState(null);
    const [playerExpanded, setPlayerExpanded] = useState(false);

    const miniPlayerPage = MINI_PLAYER_PATHS.some(path =>
        location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
    const showMiniPlayer = Boolean(currMusic && miniPlayerPage && !playerExpanded);

    useEffect(() => {
        const noInteractionCount = Number(localStorage.getItem('ae-no-interaction')) || 0;
        if (noInteractionCount >= 10) {
            setCurrMusic(null);
        } else {
            setCurrMusic(playing);
        }
    }, [playing]);

    useEffect(() => {
        setPlayerExpanded(false);
    }, [location.pathname]);

    return (
        <div className="app-shell">
            <MobileOffcanvasScrollGuard />
            <header className="app-header">
                <MainNavbar />
            </header>
            <main
                className={`app-content ${currMusic ? 'has-player' : ''} ${showMiniPlayer ? 'has-mini-player' : ''}`}
                style={{
                    paddingBottom: currMusic && !showMiniPlayer
                        ? curr_margin || '110px'
                        : undefined
                }}
            >
                {children}
            </main>
            <AssignmentShortcut />
            <ConversationUXGuard />
            <ConversationHintCoach />
            <GuidedTour />
            {currMusic && (
                <footer className={`app-player ${showMiniPlayer ? 'mini' : ''}`}>
                    {miniPlayerPage && (
                        <button
                            type="button"
                            className="app-player-toggle"
                            onClick={() => setPlayerExpanded(prev => !prev)}
                            aria-label={playerExpanded ? '縮小播放器' : '展開播放器'}
                        >
                            🎧 {playerExpanded ? '縮小' : '播放器'}
                        </button>
                    )}
                    <MusicPlayer music={currMusic} />
                </footer>
            )}
        </div>
    );
};

export default Containerfull;
