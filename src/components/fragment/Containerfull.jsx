import React, { useEffect, useRef, useState } from 'react';
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
const MINI_PLAYER_POSITION_KEY = 'ae-mini-player-position-v1';

const getSavedMiniPlayerPosition = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(MINI_PLAYER_POSITION_KEY) || 'null');
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
    } catch (error) {
        console.warn('讀取 Mini Player 位置失敗:', error);
    }
    return null;
};

const Containerfull = ({ children }) => {
    const { playing, curr_margin } = useSelector(state => state.musicReducer);
    const location = useLocation();
    const playerRef = useRef(null);
    const dragStateRef = useRef(null);
    const [currMusic, setCurrMusic] = useState(null);
    const [playerExpanded, setPlayerExpanded] = useState(false);
    const [miniPosition, setMiniPosition] = useState(() => getSavedMiniPlayerPosition());
    const [dragging, setDragging] = useState(false);

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

    useEffect(() => {
        if (!showMiniPlayer || !miniPosition || !playerRef.current) return;
        const rect = playerRef.current.getBoundingClientRect();
        const maxX = Math.max(8, window.innerWidth - rect.width - 8);
        const maxY = Math.max(8, window.innerHeight - rect.height - 8);
        const clamped = {
            x: Math.min(Math.max(8, miniPosition.x), maxX),
            y: Math.min(Math.max(8, miniPosition.y), maxY)
        };
        if (clamped.x !== miniPosition.x || clamped.y !== miniPosition.y) {
            setMiniPosition(clamped);
            localStorage.setItem(MINI_PLAYER_POSITION_KEY, JSON.stringify(clamped));
        }
    }, [showMiniPlayer, miniPosition]);

    useEffect(() => {
        const handleResize = () => {
            if (!showMiniPlayer || !playerRef.current) return;
            const rect = playerRef.current.getBoundingClientRect();
            const maxX = Math.max(8, window.innerWidth - rect.width - 8);
            const maxY = Math.max(8, window.innerHeight - rect.height - 8);
            setMiniPosition(prev => {
                if (!prev) return prev;
                const next = {
                    x: Math.min(Math.max(8, prev.x), maxX),
                    y: Math.min(Math.max(8, prev.y), maxY)
                };
                localStorage.setItem(MINI_PLAYER_POSITION_KEY, JSON.stringify(next));
                return next;
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [showMiniPlayer]);

    const startMiniDrag = event => {
        if (!showMiniPlayer || !playerRef.current) return;
        event.preventDefault();
        const rect = playerRef.current.getBoundingClientRect();
        dragStateRef.current = {
            pointerId: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragging(true);
    };

    const moveMiniDrag = event => {
        const drag = dragStateRef.current;
        if (!drag || !playerRef.current || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        const rect = playerRef.current.getBoundingClientRect();
        const maxX = Math.max(8, window.innerWidth - rect.width - 8);
        const maxY = Math.max(8, window.innerHeight - rect.height - 8);
        setMiniPosition({
            x: Math.min(Math.max(8, event.clientX - drag.offsetX), maxX),
            y: Math.min(Math.max(8, event.clientY - drag.offsetY), maxY)
        });
    };

    const endMiniDrag = event => {
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        dragStateRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        setDragging(false);
        setMiniPosition(prev => {
            if (prev) localStorage.setItem(MINI_PLAYER_POSITION_KEY, JSON.stringify(prev));
            return prev;
        });
    };

    const miniPlayerStyle = showMiniPlayer && miniPosition
        ? { left: `${miniPosition.x}px`, top: `${miniPosition.y}px`, right: 'auto', bottom: 'auto' }
        : undefined;

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
                <footer
                    ref={playerRef}
                    className={`app-player ${showMiniPlayer ? 'mini' : ''} ${dragging ? 'dragging' : ''}`}
                    style={miniPlayerStyle}
                >
                    {showMiniPlayer && (
                        <button
                            type="button"
                            className="app-player-drag-handle"
                            onPointerDown={startMiniDrag}
                            onPointerMove={moveMiniDrag}
                            onPointerUp={endMiniDrag}
                            onPointerCancel={endMiniDrag}
                            aria-label="拖曳播放器"
                            title="拖曳播放器"
                        >
                            ⋮⋮ 拖曳
                        </button>
                    )}
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
