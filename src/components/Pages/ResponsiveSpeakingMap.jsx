import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildResponsiveSpeakingRoute } from "../../utils/responsiveSpeakingRoute";
import grove from "../assets/speaking-map/responsive-forest-grove-v1.webp";
import pond from "../assets/speaking-map/responsive-forest-pond-v1.webp";
import "./css/ResponsiveSpeakingMap.scss";

function Scenery({ item, initialY }) {
    const ref = useRef(null);
    const [nearby, setNearby] = useState(Math.abs(item.y - initialY) < 1000);
    useEffect(() => {
        if (nearby) return;
        if (typeof IntersectionObserver === "undefined") { setNearby(true); return; }
        const observer = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) { setNearby(true); observer.disconnect(); }
        }, { rootMargin: "600px" });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [nearby]);
    return <div ref={ref} className="responsive-map-scenery" aria-hidden="true"
        style={{ left: item.x - item.size / 2, top: item.y - item.size / 2, width: item.size, height: item.size }}>
        {nearby && <img src={item.kind === "pond" ? pond : grove} alt="" width="1254" height="1254" decoding="async" loading="lazy" />}
    </div>;
}

// Review-only forest layout. Existing six-book production map is unchanged.
export default function ResponsiveSpeakingMap({ lessons, initialLevelIndex = 0, children }) {
    const host = useRef(null);
    const firstPositioned = useRef(false);
    const anchor = useRef(null);
    const [viewport, setViewport] = useState(() => ({
        width: typeof window === "undefined" ? 412 : Math.min(1600, window.innerWidth),
        height: typeof window === "undefined" ? 915 : window.innerHeight,
    }));
    const id = useId().replace(/:/g, "");
    const route = useMemo(() => buildResponsiveSpeakingRoute(lessons, viewport.width, viewport.height), [lessons, viewport]);
    useLayoutEffect(() => {
        const measure = () => {
            const width = Math.round(host.current?.getBoundingClientRect().width || 412);
            const height = window.innerHeight;
            const nodes = [...host.current.querySelectorAll("[data-responsive-level]")];
            if (firstPositioned.current && nodes.length) {
                const node = nodes.reduce((a, b) => Math.abs(a.getBoundingClientRect().top - height / 2) < Math.abs(b.getBoundingClientRect().top - height / 2) ? a : b);
                anchor.current = { id: node.dataset.responsiveLevel, top: node.getBoundingClientRect().top };
            }
            setViewport(old => old.width === width && old.height === height ? old : { width, height });
        };
        measure();
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
        observer?.observe(host.current);
        window.addEventListener("resize", measure);
        return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
    }, []);
    useLayoutEffect(() => {
        if (!host.current) return;
        if (anchor.current) {
            const node = [...host.current.querySelectorAll("[data-responsive-level]")].find(n => n.dataset.responsiveLevel === anchor.current.id);
            if (node) window.scrollBy(0, node.getBoundingClientRect().top - anchor.current.top);
            anchor.current = null;
        } else if (!firstPositioned.current) {
            host.current.querySelectorAll("[data-responsive-level]")[initialLevelIndex]?.scrollIntoView({ block: "center", behavior: "auto" });
            firstPositioned.current = true;
        }
    }, [route, initialLevelIndex]);
    const start = route.nodes[0], finish = route.nodes[route.nodes.length - 1];
    return <section ref={host} className="responsive-speaking-map" style={{ height: route.height, "--responsive-marker": route.markerDiameter + "px" }}>
        <svg className="responsive-map-road" viewBox={"0 0 " + route.width + " " + route.height} aria-hidden="true">
            <defs>
                <pattern id={id + "-grass"} width="217" height="193" patternUnits="userSpaceOnUse">
                    <path d="M32 47q-12-17-17-8 4 12 17 8M32 47q-2-23 7-20 5 11-7 20M171 136q-12-17-17-8 4 12 17 8M171 136q-2-23 7-20 5 11-7 20" fill="#76ab43" opacity=".26" />
                    <circle cx="100" cy="158" r="3" fill="#f8efb4" opacity=".65" />
                    <circle cx="104" cy="154" r="3" fill="#fff5d6" opacity=".65" />
                    <circle cx="108" cy="158" r="3" fill="#fff5d6" opacity=".65" />
                    <circle cx="104" cy="162" r="3" fill="#fff5d6" opacity=".65" />
                    <circle cx="104" cy="158" r="2.5" fill="#eec04c" />
                </pattern>
                <linearGradient id={id + "-sand"} x1="0" x2="1" y1="0" y2="0">
                    <stop stopColor="#ffe5a8" /><stop offset=".5" stopColor="#ffdb91" /><stop offset="1" stopColor="#f7cc83" />
                </linearGradient>
                <pattern id={id + "-grain"} width="83" height="101" patternUnits="userSpaceOnUse">
                    <ellipse cx="19" cy="29" rx="4" ry="2" fill="#d99f58" opacity=".12" />
                    <ellipse cx="62" cy="79" rx="7" ry="3" fill="#edb56c" opacity=".15" />
                </pattern>
            </defs>
            <rect width={route.width} height={route.height} fill={"url(#" + id + "-grass)"} />
            <path d={route.path} fill="none" stroke="#6f9c3f" strokeWidth={route.roadWidth + 8} strokeLinecap="round" opacity=".18" />
            <path d={route.path} fill="none" stroke="#dca65c" strokeWidth={route.roadWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path className="responsive-map-road-surface" d={route.path} fill="none" stroke={"url(#" + id + "-sand)"} strokeWidth={route.roadWidth - 4} strokeLinecap="round" strokeLinejoin="round" />
            <path d={route.path} fill="none" stroke={"url(#" + id + "-grain)"} strokeWidth={route.roadWidth - 6} strokeLinecap="round" />
            {[start, finish].filter(Boolean).map((p, i) => <g key={i} transform={"translate(" + (p.x - route.roadWidth * .65) + " " + (p.y - 88) + ")"}>
                <path d="M0 0V64" stroke="#86512b" strokeWidth="5" strokeLinecap="round" />
                <path d="M2 0H39L32 14 39 28H2Z" fill={i ? "#ffce46" : "#398bde"} stroke="#ffefbb" strokeWidth="2" />
                <path d="m19 6 2 5 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1Z" fill="#fff" />
            </g>)}
        </svg>
        {route.scenery.map(item => <Scenery key={item.id} item={item} initialY={route.nodes[initialLevelIndex]?.y ?? route.height} />)}
        {children(route)}
    </section>;
}
