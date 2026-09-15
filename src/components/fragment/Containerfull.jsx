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

    const speakingChallengePage =
        location.pathname === '/student/speaking-challenges' ||
        location.pathname.startsWith(
            '/student/speaking-challenges/'
        );

    const showMiniPlayer = Boolean(
        currMusic &&
        miniPlayerPage &&
        !playerExpanded
    );

    // 口說挑戰需要保留孩子可閱讀題目的空間，也不能讓教材音檔在
    // 麥克風練習時持續播放。保留曲目與時間，僅把播放器收成圖示。
    const showSpeakingPlayerFocus = Boolean(
        currMusic &&
        speakingChallengePage &&
        !playerExpanded
    );

    const playerSpace =
        typeof curr_margin === 'number'
            ? `${curr_margin}px`
            : curr_margin || '110px';

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
        <div
            className="app-shell"
            style={{
                '--app-player-space':
                    playerSpace
            }}
        >
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
                 } ${
                     showSpeakingPlayerFocus
                         ? 'has-focus-player'
                         : ''
                 }`}
                style={{
                    paddingBottom:
                        currMusic &&
                        !showMiniPlayer &&
                        !showSpeakingPlayerFocus
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
                    } ${
                        showSpeakingPlayerFocus
                            ? 'focus'
                            : ''
                    }`}
                    aria-label="音樂播放器"
                >
                    {miniPlayerPage && !showSpeakingPlayerFocus && (
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
                        pausePlayback={showSpeakingPlayerFocus}
                        focusMode={showSpeakingPlayerFocus}
                        onFocusPlayerExpand={() =>
                            setPlayerExpanded(true)
                        }
                    />
                </footer>
            )}
        </div>
    );
};

export default Containerfull;
