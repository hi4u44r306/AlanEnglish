import React, { useEffect, useId, useRef, useState } from "react";
import { SPEAKING_SCENE_OVERLAP } from "../../utils/segmentedSpeakingMap";
import meadow from "../assets/speaking-map/serpentine-meadow-v3.webp";
import forest from "../assets/speaking-map/serpentine-forest-v3.webp";
import snow from "../assets/speaking-map/serpentine-snow-v3.webp";
import volcano from "../assets/speaking-map/serpentine-volcano-v3.webp";
import pilotMeadow from "../assets/speaking-map/pilot-meadow-v6.webp";
import pilotForest from "../assets/speaking-map/pilot-forest-v6.webp";
import { CARTOON_ASSETS, CARTOON_SIDE_ASSETS } from "./speakingCartoonAssets";
import unifiedForestA from "../assets/speaking-map/unified-forest-a-v1.webp";
import unifiedForestB from "../assets/speaking-map/unified-forest-b-v1.webp";

const SCENES = { meadow, forest, snow, volcano, pilotMeadow, pilotForest, ...CARTOON_ASSETS,
    "unified-forest-a": unifiedForestA, "unified-forest-b": unifiedForestB };

function SceneTile({ scene, route, eager, scenery = false }) {
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
    return <div ref={container} className={`speaking-scene-tile ${scenery ? "is-side-scenery" : ""} is-${scene.biome} ${scene.first ? "is-first" : ""} ${scene.last ? "is-last" : ""}`}
        data-scene-index={scenery ? undefined : scene.index} style={{ "--scene-overlap": `${(scene.fadeOverlap ?? scene.overlap ?? SPEAKING_SCENE_OVERLAP) / scene.height * 100}%`, top: `${scene.top / route.height * 100}%`, height: `${scene.height / route.height * 100}%` }}>
        {nearby && !failed && <img key={attempt} src={scenery ? CARTOON_SIDE_ASSETS[scene.biome] : SCENES[scene.asset]} alt="" width={scenery || scene.unified ? "1536" : "887"} height={scenery || scene.unified ? "1024" : "1774"} decoding="async" loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} />}
        {failed && !scenery && <button className="speaking-scene-retry" type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>重試載入場景</button>}
    </div>;
}

// Do not mount decorative images on phones: display:none alone can still download img sources.
function WideScenery({ route, initialY }) {
    const [wide, setWide] = useState(false);
    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const media = window.matchMedia("(min-width: 700px)");
        const update = () => setWide(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);
    if (!wide) return null;
    return <div className="speaking-map-side-scenery" aria-hidden="true">
        {route.scenes.map(scene => <SceneTile key={scene.id} scene={scene} route={route} scenery
            eager={scene.top < initialY + 700 && scene.top + scene.height > initialY - 700} />)}
    </div>;
}

function PilotBridge({ bridge, width }) {
    const dx = bridge.to.x - bridge.from.x, dy = bridge.to.y - bridge.from.y;
    const length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const boards = Math.ceil(length / 14);
    return <g className="speaking-map-pilot-bridge" transform={`translate(${bridge.from.x} ${bridge.from.y}) rotate(${angle})`}>
        <rect x="-3" y={-width / 2 + 5} width={length + 6} height={width} rx="4" fill="#183e38" opacity=".2" />
        <rect x="-2" y={-width / 2} width={length + 4} height={width} rx="3" fill="#7e502e" />
        {Array.from({ length: boards }, (_, i) => <g key={i}>
            <rect x={i * length / boards} y={-width / 2 + 3} width={length / boards - 1.5} height={width - 6} rx="1.5" fill={i % 3 === 0 ? "#d5a063" : "#e1b174"} />
            <path d={`M${i * length / boards + 5},${-width / 2 + 14}v${width - 28}`} stroke="#9e6b3e" opacity=".3" strokeWidth="1" />
        </g>)}
        {[-1, 1].map(side => <g key={side}>
            <path d={`M0,${side * (width / 2 - 3)}H${length}`} fill="none" stroke="#7f512d" strokeWidth="8" strokeLinecap="round" />
            <path d={`M0,${side * (width / 2 - 3) - 2}H${length}`} fill="none" stroke="#efc88d" strokeWidth="3" strokeLinecap="round" />
            {[0, .5, 1].map(t => <rect key={t} x={t * length - 5} y={side * (width / 2 - 3) - 7} width="10" height="14" rx="2" fill="#986038" stroke="#f2c68d" strokeWidth="1.5" />)}
        </g>)}
    </g>;
}

export default function SegmentedSpeakingMap({ route, initialLevelIndex = 0, children }) {
    const id = useId().replace(/:/g, "");
    const initialY = route.nodes[initialLevelIndex]?.worldY ?? route.height;
    const start = route.nodes[0];
    const roadPath = route.roadPath ?? route.path;
    return <section className={`speaking-map-chapter is-book is-segmented${route.isPilot || route.isCartoon ? " is-refined-pilot" : ""}${route.isCartoon ? " is-cartoon" : ""}${route.isUnifiedForest ? " is-unified-map" : ""}`}
        style={{ "--map-scene-background": route.theme?.ground }}>
        {route.isCartoon && !route.isUnifiedForest && <WideScenery route={route} initialY={initialY} />}
        {route.isUnifiedForest && <div className="speaking-unified-scene-layer">
            {route.scenes.map(scene => <SceneTile key={scene.id} scene={scene} route={route}
                eager={scene.top < initialY + 700 && scene.top + scene.height > initialY - 700} />)}
        </div>}
        <div className="speaking-map-canvas speaking-segmented-canvas" style={{ "--map-aspect-ratio": route.aspectRatio, "--map-scene-background": route.theme?.ground,
            "--segmented-marker-size": `${route.markerDiameter / route.width * 100}cqw` }}>
            {!route.isUnifiedForest && <div className="speaking-scene-layer">
                {route.scenes.map(scene => <SceneTile key={scene.id} scene={scene} route={route}
                    eager={scene.top < initialY + 700 && scene.top + scene.height > initialY - 700} />)}
            </div>}
            <svg className="speaking-continuous-road" viewBox={`0 0 ${route.width} ${route.height}`} aria-hidden="true" focusable="false">
                {route.paintedRoad ? <path className="speaking-map-centerline" d={route.path} fill="none" stroke="none" /> : <>
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
                {route.isPilot && route.ends.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={route.roadWidth / 2 - 1.5} fill={`url(#${id}-sand)`} stroke="#d5a45e" strokeWidth="3" />)}
                {route.isPilot && <path d={roadPath} transform="translate(0 4)" fill="none" stroke="#57783e" opacity=".22" strokeWidth={route.roadWidth + 8} strokeLinecap="butt" strokeLinejoin="round" />}
                <path className="speaking-continuous-road__rim" d={roadPath} fill="none" stroke={route.isPilot ? "#d5a45e" : "#bd864b"} strokeWidth={route.roadWidth} strokeLinecap={route.isPilot ? "butt" : "round"} strokeLinejoin="round" />
                <path className="speaking-continuous-road__surface" d={roadPath} fill="none" stroke={`url(#${id}-sand)`} strokeWidth={route.roadWidth - 6} strokeLinecap={route.isPilot ? "butt" : "round"} strokeLinejoin="round" />
                {route.isPilot && <>
                    <path d={roadPath} fill="none" stroke={`url(#${id}-sand-grain)`} strokeWidth={route.roadWidth - 10} strokeLinecap="butt" />
                    {route.details.map((point, index) => <g key={index} transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`} opacity=".14" fill="#c18d47">
                        <ellipse cx="-17" cy="5" rx="5" ry="2.6" /><ellipse cx="14" cy="-4" rx="3" ry="1.6" />
                    </g>)}
                </>}
                {route.isPilot && route.bridge && <PilotBridge bridge={route.bridge} width={route.roadWidth} />}
                </>}
                {start && <g className="speaking-map-start-flag" transform={`translate(${start.worldX - 90} ${start.worldY + (route.isPilot || route.isCartoon ? -100 : 20)})`}>
                    <ellipse cx="0" cy="75" rx="17" ry="5" fill="#456c38" opacity=".4" />
                    <path d="M0 0V75" stroke="#754826" strokeWidth="6" strokeLinecap="round" />
                    <circle cy="-2" r="5" fill="#efbd53" />
                    <path d="M3 3 Q19 -3 36 3L32 21Q17 16 3 22Z" fill="#326fbb" stroke="#164379" strokeWidth="1.5" />
                    <path d="m18 5 2.4 5 5.6.8-4 3.8.9 5.4-4.9-2.5-4.9 2.5.9-5.4-4-3.8 5.6-.8Z" fill="#fff7d4" />
                </g>}
                {!route.isPilot && <g className="speaking-map-finish" transform={route.isCartoon ? "translate(380 125)" : "translate(275 135)"}>
                    <path d="M0 0V90" stroke="#714723" strokeWidth="6" strokeLinecap="round" />
                    <path d="M3 0H72L61 20 72 40H3Z" fill="#ffda4b" stroke="#b88341" strokeWidth="3" />
                    <path d="m32 9 4 8 9 1-6.5 6 1.5 9-8-4-8 4 1.5-9-6.5-6 9-1Z" fill="#fff9dd" />
                </g>}
            </svg>
            {children}
        </div>
    </section>;
}
