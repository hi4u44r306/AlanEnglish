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

const LEGACY_MINI_PLAYER_POSITION_KEY =
    'ae-mini-player-position-v1';

const Containerfull = ({ children }) => {
    const {
        playing,
        curr_margin
    } = useSelector(
        state => state.musicReducer
    );

    const location = useLocation();

    const [
        currMusic,
        setCurrMusic
    ] = useState(null);

    const [
        playerExpanded,
        setPlayerExpanded
    ] = useState(false);

    const miniPlayerPage =
        MINI_PLAYER_PATHS.some(
            pathname =>
                location.pathname === pathname ||
                location.pathname.startsWith(
                    `${pathname}/`
                )
        );

    const showMiniPlayer = Boolean(
        currMusic &&
        miniPlayerPage &&
        !playerExpanded
    );

    useEffect(() => {
        try {
            localStorage.removeItem(
                LEGACY_MINI_PLAYER_POSITION_KEY
            );
        } catch (error) {
            console.warn(
                '清除舊播放器位置失敗:',
                error
            );
        }
    }, []);

    useEffect(() => {
        const noInteractionCount =
            Number(
                localStorage.getItem(
                    'ae-no-interaction'
                )
            ) || 0;

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
                className={`app-content ${
                    currMusic
                        ? 'has-player'
                        : ''
                } ${
                    showMiniPlayer
                        ? 'has-mini-player'
                        : ''
                }`}
                style={{
                    paddingBottom:
                        currMusic &&
                        !showMiniPlayer
                            ? curr_margin ||
                              '110px'
                            : undefined
                }}
            >
                {children}
            </main>

            <AssignmentShortcut
                playerVisible={
                    Boolean(currMusic)
                }
                compactPlayer={
                    showMiniPlayer
                }
            />

            <ConversationUXGuard />
            <ConversationHintCoach />
            <GuidedTour />

            {currMusic && (
                <footer
                    className={`app-player ${
                        showMiniPlayer
                            ? 'mini'
                            : ''
                    }`}
                    aria-label="音樂播放器"
                >
                    {miniPlayerPage && (
                        <button
                            type="button"
                            className="app-player-toggle"
                            onClick={() =>
                                setPlayerExpanded(
                                    previous =>
                                        !previous
                                )
                            }
                            aria-expanded={
                                playerExpanded
                            }
                            aria-label={
                                playerExpanded
                                    ? '縮小播放器'
                                    : '展開播放器'
                            }
                        >
                            <span
                                aria-hidden="true"
                            >
                                🎧
                            </span>

                            {playerExpanded
                                ? '縮小'
                                : '展開播放器'}
                        </button>
                    )}

                    <MusicPlayer
                        music={currMusic}
                    />
                </footer>
            )}
        </div>
    );
};

export default Containerfull;
