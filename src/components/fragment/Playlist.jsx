import React, {
    useEffect,
    useMemo,
    useState
} from "react";
import { useParams } from "react-router-dom";
import MusicCard from "./MusicCard";
import "../assets/scss/Playlist.scss";
import { supabase } from "../Pages/supabase-config";
import { useAuth } from "../../auth/AuthContext";
import {
    getBookPlaybackProgress
} from "../../services/listeningService";

const PLAYLIST_CACHE_PREFIX =
    "ae-playlist-cache:";

function getPlaylistCacheKey(
    playlistId
) {
    return `${PLAYLIST_CACHE_PREFIX}${playlistId}`;
}

function readPlaylistCache(
    playlistId
) {
    try {
        const raw =
            sessionStorage.getItem(
                getPlaylistCacheKey(
                    playlistId
                )
            );

        if (!raw) {
            return null;
        }

        const parsed =
            JSON.parse(raw);

        if (
            !parsed ||
            !parsed.book ||
            !Array.isArray(
                parsed.tracks
            )
        ) {
            return null;
        }

        return parsed;
    } catch (error) {
        console.warn(
            "讀取 Playlist 快取失敗:",
            error
        );

        return null;
    }
}

function writePlaylistCache(
    playlistId,
    book,
    tracks
) {
    try {
        sessionStorage.setItem(
            getPlaylistCacheKey(
                playlistId
            ),
            JSON.stringify({
                book,
                tracks,
                cachedAt:
                    Date.now()
            })
        );
    } catch (error) {
        console.warn(
            "寫入 Playlist 快取失敗:",
            error
        );
    }
}

function Playlist() {
    const { playlistId } =
        useParams();

    const {
        firebaseUser,
        role
    } = useAuth();

    const [
        book,
        setBook
    ] = useState(null);

    const [
        tracks,
        setTracks
    ] = useState([]);

    const [
        progressMap,
        setProgressMap
    ] = useState({});

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        errorMessage,
        setErrorMessage
    ] = useState("");

    // =========================================
    // Playlist 本體
    // =========================================

    useEffect(() => {
        let cancelled =
            false;

        const fetchPlaylist =
            async () => {
                if (!playlistId) {
                    return;
                }

                setErrorMessage("");

                // =================================
                // 1. 先讀 sessionStorage
                // =================================

                const cached =
                    readPlaylistCache(
                        playlistId
                    );

                if (cached) {
                    setBook(
                        cached.book
                    );

                    setTracks(
                        cached.tracks
                    );

                    // 有快取就立即解除 Loading
                    setLoading(
                        false
                    );
                } else {
                    setLoading(
                        true
                    );
                }

                try {
                    // =================================
                    // 2. 查教材
                    // =================================

                    const {
                        data:
                        bookData,
                        error:
                        bookError
                    } =
                        await supabase
                            .from(
                                "books"
                            )
                            .select(
                                "id,name,code,category_id,sort_order,enabled"
                            )
                            .eq(
                                "code",
                                playlistId
                            )
                            .eq(
                                "enabled",
                                true
                            )
                            .maybeSingle();

                    if (
                        cancelled
                    ) {
                        return;
                    }

                    if (
                        bookError
                    ) {
                        throw (
                            bookError
                        );
                    }

                    if (
                        !bookData
                    ) {
                        throw new Error(
                            "找不到這本教材"
                        );
                    }

                    // =================================
                    // 3. 查音檔
                    // =================================

                    const {
                        data:
                        trackData,
                        error:
                        trackError
                    } =
                        await supabase
                            .from(
                                "music_tracks"
                            )
                            .select(
                                "*"
                            )
                            .eq(
                                "book_id",
                                bookData.id
                            )
                            .eq(
                                "enabled",
                                true
                            )
                            .order(
                                "sort_order",
                                {
                                    ascending:
                                        true
                                }
                            );

                    if (
                        cancelled
                    ) {
                        return;
                    }

                    if (
                        trackError
                    ) {
                        throw (
                            trackError
                        );
                    }

                    // =================================
                    // 4. Storage URL
                    // =================================

                    const convertedTracks =
                        (
                            trackData ||
                            []
                        ).map(
                            track => {
                                const {
                                    data:
                                    publicUrlData
                                } =
                                    supabase.storage
                                        .from(
                                            "music"
                                        )
                                        .getPublicUrl(
                                            track.audio_url
                                        );

                                return {
                                    id:
                                        track.id,

                                    book_id:
                                        track.book_id,

                                    page:
                                        track.page,

                                    title:
                                        track.title,

                                    sort_order:
                                        track.sort_order,

                                    bookname:
                                        bookData.name,

                                    type:
                                        playlistId,

                                    musicName:
                                        track.music_name,

                                    audioURL:
                                        publicUrlData.publicUrl,

                                    audio_url:
                                        publicUrlData.publicUrl,

                                    image:
                                        track.image
                                };
                            }
                        );

                    if (
                        cancelled
                    ) {
                        return;
                    }

                    // =================================
                    // 5. 音檔先顯示
                    // =================================

                    setBook(
                        bookData
                    );

                    setTracks(
                        convertedTracks
                    );

                    setLoading(
                        false
                    );

                    writePlaylistCache(
                        playlistId,
                        bookData,
                        convertedTracks
                    );

                    // =================================
                    // 6. 播放紀錄背景載入
                    // 不阻塞 MusicCard 顯示
                    // =================================

                    if (
                        firebaseUser &&
                        role ===
                        "student"
                    ) {
                        getBookPlaybackProgress(
                            firebaseUser,
                            bookData.id
                        )
                            .then(
                                result => {
                                    if (
                                        cancelled
                                    ) {
                                        return;
                                    }

                                    const nextProgressMap =
                                        {};

                                    (
                                        result?.progress ||
                                        []
                                    ).forEach(
                                        item => {
                                            nextProgressMap[
                                                String(
                                                    item.track_id
                                                )
                                            ] = {
                                                playCount:
                                                    Number(
                                                        item.play_count
                                                    ) ||
                                                    0,

                                                completed:
                                                    Boolean(
                                                        item.completed
                                                    ),

                                                completedAt:
                                                    item.completed_at ||
                                                    null,

                                                lastPlayedAt:
                                                    item.last_played_at ||
                                                    null
                                            };
                                        }
                                    );

                                    setProgressMap(
                                        nextProgressMap
                                    );
                                }
                            )
                            .catch(
                                progressError => {
                                    console.error(
                                        "背景讀取播放紀錄失敗:",
                                        progressError
                                    );
                                }
                            );
                    } else {
                        setProgressMap(
                            {}
                        );
                    }
                } catch (
                error
                ) {
                    console.error(
                        "Playlist 載入失敗:",
                        error
                    );

                    // 已經有快取的情況下
                    // 不要因背景同步失敗把畫面整個弄掉
                    if (!cached) {
                        setErrorMessage(
                            error?.message ||
                            "教材載入失敗"
                        );

                        setBook(
                            null
                        );

                        setTracks(
                            []
                        );

                        setLoading(
                            false
                        );
                    }
                }
            };

        fetchPlaylist();

        return () => {
            cancelled =
                true;
        };
    }, [
        playlistId,
        firebaseUser,
        role
    ]);

    // =========================================
    // MusicPlayer 播完
    // 即時更新播放次數
    // =========================================

    useEffect(() => {
        const handleProgressUpdated =
            event => {
                const progress =
                    event?.detail;

                const trackId =
                    progress?.track_id ||
                    progress?.result_track_id;

                if (
                    !trackId
                ) {
                    return;
                }

                setProgressMap(
                    current => ({
                        ...current,

                        [String(
                            trackId
                        )]: {
                            ...current[
                            String(
                                trackId
                            )
                            ],

                            playCount:
                                Number(
                                    progress.play_count
                                ) ||
                                0,

                            completed:
                                Boolean(
                                    progress.completed
                                ),

                            dailyCount:
                                Number(
                                    progress.daily_count
                                ) ||
                                0,

                            monthlyCount:
                                Number(
                                    progress.monthly_count
                                ) ||
                                0,

                            totalCount:
                                Number(
                                    progress.total_count
                                ) ||
                                0
                        }
                    })
                );
            };

        window.addEventListener(
            "ae:track-progress-updated",
            handleProgressUpdated
        );

        return () => {
            window.removeEventListener(
                "ae:track-progress-updated",
                handleProgressUpdated
            );
        };
    }, []);

    // =========================================
    // 統計
    // =========================================

    const stats =
        useMemo(() => {
            const completedCount =
                tracks.filter(
                    track =>
                        Boolean(
                            progressMap[
                                String(
                                    track.id
                                )
                            ]?.completed
                        )
                ).length;

            const totalPlayCount =
                tracks.reduce(
                    (
                        total,
                        track
                    ) => {
                        return (
                            total +
                            Number(
                                progressMap[
                                    String(
                                        track.id
                                    )
                                ]?.playCount ||
                                0
                            )
                        );
                    },
                    0
                );

            return {
                total:
                    tracks.length,

                completed:
                    completedCount,

                totalPlayCount
            };
        }, [
            tracks,
            progressMap
        ]);

    // =========================================
    // Loading
    // =========================================

    if (
        loading &&
        tracks.length === 0
    ) {
        return (
            <div className="playlist-loading">

                <div className="playlist-loading__icon">
                    🎧
                </div>

                <div>
                    音檔載入中...
                </div>

            </div>
        );
    }

    // =========================================
    // Error
    // =========================================

    if (
        errorMessage &&
        tracks.length === 0
    ) {
        return (
            <div className="playlist-error">

                <h2>
                    讀取失敗
                </h2>

                <p>
                    {
                        errorMessage
                    }
                </p>

            </div>
        );
    }

    // =========================================
    // Render
    // =========================================

    return (
        <div className="playlist-page">

            <div className="playlist-content">

                <header className="playlist-header">

                    <div className="playlist-header__main">

                        <h1>
                            {
                                book?.name ||
                                playlistId
                            }
                        </h1>

                        {role ===
                            "student" && (
                                <div className="playlist-header__stats">

                                    <span>
                                        完成{" "}
                                        {
                                            stats.completed
                                        }{" "}
                                        /{" "}
                                        {
                                            stats.total
                                        }
                                    </span>

                                    <span className="playlist-header__dot">
                                        ·
                                    </span>

                                    <span>
                                        累計播放{" "}
                                        {
                                            stats.totalPlayCount
                                        }{" "}
                                        次
                                    </span>

                                </div>
                            )}

                    </div>

                </header>

                <section className="playlist-list-section">

                    <div className="playlist-list">

                        {tracks.length >
                            0 ? (
                            tracks.map(
                                track => (
                                    <MusicCard
                                        key={
                                            track.id
                                        }
                                        music={
                                            track
                                        }
                                        progress={
                                            progressMap[
                                            String(
                                                track.id
                                            )
                                            ] ||
                                            {}
                                        }
                                    />
                                )
                            )
                        ) : (
                            <div className="playlist-empty">
                                目前沒有音檔
                            </div>
                        )}

                    </div>

                </section>

            </div>

        </div>
    );
}

export default Playlist;