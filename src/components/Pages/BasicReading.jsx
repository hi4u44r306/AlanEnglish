import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BiChevronLeft, BiChevronRight, BiHeadphone, BiHomeAlt2, BiPlayCircle } from "react-icons/bi";
import Brand from "../fragment/Brand";
import "./css/BasicReading.scss";

const ACCESS_REFRESH_BUFFER_SECONDS = 30;

const fetchJson = async url => {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || "音檔服務暫時無法使用");
    return body;
};

const trackLabel = trackNumber => `Track ${trackNumber}`;

function BasicReading() {
    const audioRef = useRef(null);
    const accessCacheRef = useRef(new Map());
    const retryRef = useRef(false);
    const [collections, setCollections] = useState([]);
    const [selectedCollectionId, setSelectedCollectionId] = useState("");
    const [activeTrackNumber, setActiveTrackNumber] = useState(1);
    const [audioSrc, setAudioSrc] = useState("");
    const [loading, setLoading] = useState(true);
    const [preparing, setPreparing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const loadCatalog = async () => {
            try {
                const result = await fetchJson("/api/basic-reading/catalog");
                const nextCollections = Array.isArray(result?.collections) ? result.collections : [];
                if (cancelled) return;
                setCollections(nextCollections);
                setSelectedCollectionId(nextCollections[0]?.id || "");
            } catch (catalogError) {
                if (!cancelled) setError(catalogError?.message || "音檔目錄載入失敗");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadCatalog();
        return () => {
            cancelled = true;
        };
    }, []);

    const groupedCollections = useMemo(() => collections.reduce((groups, collection) => {
        const level = String(collection.level || "");
        if (!groups[level]) groups[level] = [];
        groups[level].push(collection);
        return groups;
    }, {}), [collections]);

    const selectedCollection = useMemo(
        () => collections.find(collection => collection.id === selectedCollectionId) || null,
        [collections, selectedCollectionId]
    );

    const tracks = useMemo(() => Array.from(
        { length: Number(selectedCollection?.trackCount || 0) },
        (_, index) => index + 1
    ), [selectedCollection]);

    const ensureAccess = useCallback(async (collectionId, force = false) => {
        const cached = accessCacheRef.current.get(collectionId);
        const now = Math.floor(Date.now() / 1000);
        if (!force && cached && Number(cached.expires) > now + ACCESS_REFRESH_BUFFER_SECONDS) return cached;

        const result = await fetchJson(`/api/basic-reading/token?collection=${encodeURIComponent(collectionId)}`);
        const access = { token: result.token, expires: Number(result.expires) };
        accessCacheRef.current.set(collectionId, access);
        return access;
    }, []);

    const activateTrack = useCallback((trackNumber, access, autoplay) => {
        if (!selectedCollection) return;
        const path = `/api/basic-reading/audio/${encodeURIComponent(selectedCollection.id)}/Track${trackNumber}.mp3`;
        const params = new URLSearchParams({
            expires: String(access.expires),
            token: access.token
        });
        const nextAudioSrc = `${path}?${params.toString()}`;
        setActiveTrackNumber(trackNumber);
        setAudioSrc(nextAudioSrc);
        retryRef.current = false;

        const audio = audioRef.current;
        if (!audio) return;
        audio.src = nextAudioSrc;
        audio.load();
        if (!autoplay) return;
        const playback = audio.play();
        if (playback?.catch) void playback.catch(() => undefined);
    }, [selectedCollection]);

    const prepareTrack = useCallback(async (trackNumber, autoplay = true, forceRefresh = false) => {
        if (!selectedCollection) return;
        const cached = accessCacheRef.current.get(selectedCollection.id);
        const now = Math.floor(Date.now() / 1000);
        if (!forceRefresh && cached && Number(cached.expires) > now + ACCESS_REFRESH_BUFFER_SECONDS) {
            setError("");
            activateTrack(trackNumber, cached, autoplay);
            return;
        }
        try {
            setPreparing(true);
            setError("");
            const access = await ensureAccess(selectedCollection.id, forceRefresh);
            activateTrack(trackNumber, access, autoplay);
        } catch (accessError) {
            setError(accessError?.message || "暫時無法取得播放網址");
        } finally {
            setPreparing(false);
        }
    }, [activateTrack, ensureAccess, selectedCollection]);

    useEffect(() => {
        if (!selectedCollection) return;
        void prepareTrack(1, false);
    }, [prepareTrack, selectedCollection]);

    const selectCollection = collectionId => {
        audioRef.current?.pause();
        setSelectedCollectionId(collectionId);
        setActiveTrackNumber(1);
        setAudioSrc("");
        setError("");
        retryRef.current = false;
    };

    const moveTrack = direction => {
        if (!selectedCollection) return;
        const nextTrack = activeTrackNumber + direction;
        if (nextTrack < 1 || nextTrack > selectedCollection.trackCount) return;
        void prepareTrack(nextTrack, true);
    };

    const handleAudioError = () => {
        if (!audioSrc || retryRef.current) {
            setError("音檔暫時無法播放，請稍後再試。");
            return;
        }
        retryRef.current = true;
        void prepareTrack(activeTrackNumber, false, true);
    };

    return (
        <div className="basic-reading-page">
            <header className="basic-reading-page__header">
                <Link className="basic-reading-page__brand" to="/" aria-label="前往 Alan English 首頁">
                    <Brand />
                </Link>
                <nav aria-label="Basic Reading 導覽">
                    <Link to="/links"><BiChevronLeft aria-hidden="true" />教材連結</Link>
                    <Link to="/"><BiHomeAlt2 aria-hidden="true" /><span>首頁</span></Link>
                </nav>
            </header>

            <main className="basic-reading-page__main">
                <section className="basic-reading-page__intro">
                    <span><BiHeadphone aria-hidden="true" /> PUBLIC LISTENING</span>
                    <h1>Basic Reading 400～1200</h1>
                    <p>先選級數與冊別，再直接點 Track 播放；不需要登入。</p>
                </section>

                {loading && <div className="basic-reading-page__state" aria-live="polite">正在整理音檔目錄…</div>}
                {!loading && collections.length === 0 && (
                    <div className="basic-reading-page__state basic-reading-page__state--error" role="alert">
                        {error || "目前沒有可播放的音檔。"}
                    </div>
                )}

                {collections.length > 0 && (
                    <>
                        <section className="basic-reading-page__levels" aria-label="選擇 Basic Reading 冊別">
                            {Object.entries(groupedCollections).map(([level, levelCollections]) => (
                                <div className="basic-reading-page__level" key={level}>
                                    <h2>Basic Reading {level}</h2>
                                    <div className="basic-reading-page__books">
                                        {levelCollections.map(collection => (
                                            <button
                                                type="button"
                                                className={collection.id === selectedCollectionId ? "is-active" : ""}
                                                onClick={() => selectCollection(collection.id)}
                                                aria-pressed={collection.id === selectedCollectionId}
                                                key={collection.id}
                                            >
                                                第 {collection.book} 冊
                                                <small>{collection.trackCount} 軌</small>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </section>

                        <section className="basic-reading-page__track-section">
                            <div className="basic-reading-page__track-heading">
                                <div>
                                    <span>目前選擇</span>
                                    <h2>{selectedCollection?.title}</h2>
                                </div>
                                <strong>{selectedCollection?.trackCount} Tracks</strong>
                            </div>
                            <div className="basic-reading-page__tracks" aria-label={`${selectedCollection?.title} 音軌`}>
                                {tracks.map(trackNumber => (
                                    <button
                                        type="button"
                                        className={trackNumber === activeTrackNumber ? "is-active" : ""}
                                        onClick={() => void prepareTrack(trackNumber, true)}
                                        disabled={preparing}
                                        aria-label={`播放 ${trackLabel(trackNumber)}`}
                                        key={trackNumber}
                                    >
                                        <BiPlayCircle aria-hidden="true" />
                                        <span>{trackLabel(trackNumber)}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </main>

            {selectedCollection && (
                <section className="basic-reading-player" aria-label="Basic Reading 播放器">
                    <div className="basic-reading-player__copy">
                        <span>{selectedCollection.title}</span>
                        <strong>{trackLabel(activeTrackNumber)}</strong>
                    </div>
                    <div className="basic-reading-player__controls">
                        <button
                            type="button"
                            onClick={() => moveTrack(-1)}
                            disabled={preparing || activeTrackNumber <= 1}
                            aria-label="上一首"
                        >
                            <BiChevronLeft aria-hidden="true" />
                        </button>
                        <audio
                            ref={audioRef}
                            controls
                            preload="metadata"
                            src={audioSrc || undefined}
                            onEnded={() => moveTrack(1)}
                            onError={handleAudioError}
                            aria-label={`${selectedCollection.title} ${trackLabel(activeTrackNumber)}`}
                        >
                            瀏覽器不支援音訊播放。
                        </audio>
                        <button
                            type="button"
                            onClick={() => moveTrack(1)}
                            disabled={preparing || activeTrackNumber >= selectedCollection.trackCount}
                            aria-label="下一首"
                        >
                            <BiChevronRight aria-hidden="true" />
                        </button>
                    </div>
                    {preparing && <small aria-live="polite">正在準備音檔…</small>}
                    {!preparing && error && <small className="basic-reading-player__error" role="alert">{error}</small>}
                </section>
            )}
        </div>
    );
}

export default BasicReading;
