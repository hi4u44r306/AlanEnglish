import React, { useEffect, useId, useRef, useState } from "react";
import { SPEAKING_SCENE_OVERLAP } from "../../utils/segmentedSpeakingMap";
import meadow from "../assets/speaking-map/serpentine-meadow-v3.webp";
import forest from "../assets/speaking-map/serpentine-forest-v3.webp";
import snow from "../assets/speaking-map/serpentine-snow-v3.webp";
import volcano from "../assets/speaking-map/serpentine-volcano-v3.webp";
import pilotMeadow from "../assets/speaking-map/pilot-meadow-v4.webp";
import pilotForest from "../assets/speaking-map/pilot-forest-v4.webp";

const SCENES = { meadow, forest, snow, volcano, pilotMeadow, pilotForest };

function SceneTile({ scene, route, eager }) {
    const container = useRef(null);
    const [nearby, setNearby] = useState(eager);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (nearby) return;
        if (typeof IntersectionObserver === "undefined") { setNearby(true); return; }
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) { setNearby(true); observer.disconnect(); }
        }, { rootMargin: "650px 0px" });
        observer.observe(container.current);
        return () => observer.disconnect();
    }, [nearby]);
    return <div ref={container} className={`speaking-scene-tile is-${scene.biome} ${scene.first ? "is-first" : ""} ${scene.last ? "is-last" : ""}`}
        data-scene-index={scene.index} style={{ "--scene-overlap": `${(scene.overlap ?? SPEAKING_SCENE_OVERLAP) / scene.height * 100}%`, top: `${scene.top / route.height * 100}%`, height: `${scene.height / route.height * 100}%` }}>
        {nearby && !failed && <img key={attempt} src={SCENES[scene.asset]} alt="" width={route.isPilot ? 941 : 887} height={route.isPilot ? 1672 : 1774} decoding="async" loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} />}
        {failed && <button className="speaking-scene-retry" type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>重試載入場景</button>}
    </div>;
}

export default function SegmentedSpeakingMap({ route, initialLevelIndex = 0, children }) {
    const id = useId().replace(/:/g, "");
    const initialY = route.nodes[initialLevelIndex]?.worldY ?? route.height;
    const start = route.nodes[0];
    return <section className={`speaking-map-chapter is-book is-segmented${route.isPilot ? " is-refined-pilot" : ""}`}>
        <div className="speaking-map-canvas speaking-segmented-canvas" style={{ "--map-aspect-ratio": route.aspectRatio,
            "--segmented-marker-size": `${route.markerDiameter / route.width * 100}cqw` }}>
            <div className="speaking-scene-layer">
                {route.scenes.map(scene => <SceneTile key={scene.id} scene={scene} route={route}
                    eager={scene.top < initialY + 700 && scene.top + scene.height > initialY - 700} />)}
            </div>
            <svg className="speaking-continuous-road" viewBox={`0 0 ${route.width} ${route.height}`} aria-hidden="true" focusable="false">
                <defs>
                    {route.isPilot && <pattern id={`${id}-sand-grain`} width="79" height="93" patternUnits="userSpaceOnUse">
                        <ellipse cx="12" cy="19" rx="3.5" ry="1.8" fill="#ce9550" opacity=".15" />
                        <ellipse cx="54" cy="57" rx="5" ry="2.4" fill="#dfac63" opacity=".18" />
                        <circle cx="26" cy="76" r=".7" fill="#bb843e" opacity=".2" />
                        <circle cx="66" cy="9" r="1" fill="#fff7ce" opacity=".5" />
                    </pattern>}
                    <linearGradient id={`${id}-sand`} x1="80" x2="350" y1="0" y2="0" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#ffe7b2" /><stop offset=".5" stopColor="#ffdda0" /><stop offset="1" stopColor="#f7cf8d" />
                    </linearGradient>
                </defs>
                {route.isPilot && <path d={route.path} transform="translate(0 4)" fill="none" stroke="#57783e" opacity=".22" strokeWidth={route.roadWidth + 8} strokeLinecap="round" strokeLinejoin="round" />}
                <path className="speaking-continuous-road__rim" d={route.path} fill="none" stroke={route.isPilot ? "#d5a45e" : "#bd864b"} strokeWidth={route.roadWidth} strokeLinecap="round" strokeLinejoin="round" />
                <path className="speaking-continuous-road__surface" d={route.path} fill="none" stroke={`url(#${id}-sand)`} strokeWidth={route.roadWidth - 6} strokeLinecap="round" strokeLinejoin="round" />
                {route.isPilot && <>
                    <path d={route.path} fill="none" stroke={`url(#${id}-sand-grain)`} strokeWidth={route.roadWidth - 10} strokeLinecap="round" />
                    {route.details.map((point, index) => <g key={index} transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`} opacity=".14" fill="#c18d47">
                        <ellipse cx="-17" cy="5" rx="5" ry="2.6" /><ellipse cx="14" cy="-4" rx="3" ry="1.6" />
                    </g>)}
                </>}
                {start && <g className="speaking-map-start-flag" transform={`translate(${start.worldX - 90} ${start.worldY + (route.isPilot ? -100 : 20)})`}>
                    <ellipse cx="0" cy="75" rx="17" ry="5" fill="#456c38" opacity=".4" />
                    <path d="M0 0V75" stroke="#754826" strokeWidth="6" strokeLinecap="round" />
                    <circle cy="-2" r="5" fill="#efbd53" />
                    <path d="M3 3 Q19 -3 36 3L32 21Q17 16 3 22Z" fill="#326fbb" stroke="#164379" strokeWidth="1.5" />
                    <path d="m18 5 2.4 5 5.6.8-4 3.8.9 5.4-4.9-2.5-4.9 2.5.9-5.4-4-3.8 5.6-.8Z" fill="#fff7d4" />
                </g>}
                {!route.isPilot && <g className="speaking-map-finish" transform="translate(275 135)">
                    <path d="M0 0V90" stroke="#714723" strokeWidth="6" strokeLinecap="round" />
                    <path d="M3 0H72L61 20 72 40H3Z" fill="#ffda4b" stroke="#b88341" strokeWidth="3" />
                    <path d="m32 9 4 8 9 1-6.5 6 1.5 9-8-4-8 4 1.5-9-6.5-6 9-1Z" fill="#fff9dd" />
                </g>}
            </svg>
            {children}
        </div>
    </section>;
}
