import React, { useEffect, useId, useRef, useState } from "react";
import meadow from "../assets/speaking-map/segmented-meadow-v1.webp";
import forest from "../assets/speaking-map/segmented-forest-v1.webp";
import snow from "../assets/speaking-map/segmented-snow-v1.webp";
import volcano from "../assets/speaking-map/segmented-volcano-v1.webp";
import summit from "../assets/speaking-map/segmented-summit-v1.webp";

const SCENES = { meadow, forest, snow, volcano, summit };

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
        data-scene-index={scene.index} style={{ top: `${scene.top / route.height * 100}%`, height: `${scene.height / route.height * 100}%` }}>
        {nearby && !failed && <img key={attempt} src={SCENES[scene.asset]} alt="" width="1024" height="1536" decoding="async" loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} />}
        {failed && <button className="speaking-scene-retry" type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>重試載入場景</button>}
    </div>;
}

export default function SegmentedSpeakingMap({ route, initialLevelIndex = 0, children }) {
    const id = useId().replace(/:/g, "");
    const initialY = route.nodes[initialLevelIndex]?.worldY ?? route.height;
    const bridge = route.bridge;
    const start = route.nodes[0];
    return <section className="speaking-map-chapter is-book is-segmented">
        <div className="speaking-map-canvas speaking-segmented-canvas" style={{ "--map-aspect-ratio": route.aspectRatio,
            "--segmented-marker-size": `${route.markerDiameter / route.width * 100}cqw` }}>
            <div className="speaking-scene-layer">
                {route.scenes.map(scene => <SceneTile key={scene.id} scene={scene} route={route}
                    eager={scene.top < initialY + 700 && scene.top + scene.height > initialY - 700} />)}
            </div>
            <svg className="speaking-continuous-road" viewBox={`0 0 ${route.width} ${route.height}`} aria-hidden="true" focusable="false">
                <defs>
                    <linearGradient id={`${id}-sand`} x1="80" x2="350" y1="0" y2="0" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#ffe7b2" /><stop offset=".5" stopColor="#ffdda0" /><stop offset="1" stopColor="#f7cf8d" />
                    </linearGradient>
                    <pattern id={`${id}-planks`} width="124" height="19" patternUnits="userSpaceOnUse">
                        <rect width="124" height="19" fill="#bc864a" /><path d="M0 1H124 M0 18H124" stroke="#795232" strokeWidth="2" />
                        <path d="M8 6H105 M22 12H116" stroke="#e4b878" strokeWidth="1" opacity=".6" />
                    </pattern>
                </defs>
                {bridge && <g transform={`translate(${bridge.x} ${bridge.y}) rotate(${bridge.angle + 90})`}>
                    <path d="M-350 28 C-190 -35 -110 35 0 0 S190 -30 350 12" fill="none" stroke="#72b7b4" strokeWidth="80" />
                    <path d="M-350 28 C-190 -35 -110 35 0 0 S190 -30 350 12" fill="none" stroke="#5cc9e9" strokeWidth="58" />
                    <path d="M-245 14q11 -7 23 0 M-166 -4q11 -7 23 0 M120 15q11 -7 23 0 M230 -2q11 -7 23 0" fill="none" stroke="#c7f3ff" strokeWidth="3" strokeLinecap="round" opacity=".8" />
                </g>}
                <path className="speaking-continuous-road__rim" d={route.path} fill="none" stroke="#bd864b" strokeWidth={route.roadWidth} strokeLinecap="round" strokeLinejoin="round" />
                <path className="speaking-continuous-road__surface" d={route.path} fill="none" stroke={`url(#${id}-sand)`} strokeWidth={route.roadWidth - 6} strokeLinecap="round" strokeLinejoin="round" />
                {bridge && <g className="speaking-continuous-bridge" transform={`translate(${bridge.x} ${bridge.y}) rotate(${bridge.angle + 90})`}>
                    <rect x="-62" y="-42" width="124" height="84" rx="3" fill={`url(#${id}-planks)`} />
                    {[-61, 61].map(x => <g key={x}><path d={`M${x} -43V43`} stroke="#79502e" strokeWidth="7" />
                        {[-40, 0, 40].map(y => <rect key={y} x={x - 5} y={y - 5} width="10" height="10" rx="2" fill="#e0ad69" stroke="#79502e" strokeWidth="2" />)}</g>)}
                </g>}
                {start && <g className="speaking-map-start-flag" transform={`translate(${start.worldX - 98} ${start.worldY - 55})`}>
                    <ellipse cx="0" cy="75" rx="17" ry="5" fill="#456c38" opacity=".4" />
                    <path d="M0 0V75" stroke="#754826" strokeWidth="6" strokeLinecap="round" />
                    <circle cy="-2" r="5" fill="#efbd53" />
                    <path d="M3 3 Q19 -3 36 3L32 21Q17 16 3 22Z" fill="#326fbb" stroke="#164379" strokeWidth="1.5" />
                    <path d="m18 5 2.4 5 5.6.8-4 3.8.9 5.4-4.9-2.5-4.9 2.5.9-5.4-4-3.8 5.6-.8Z" fill="#fff7d4" />
                </g>}
            </svg>
            {children}
        </div>
    </section>;
}
