import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiMinus, FiPlus } from "react-icons/fi";
import { IslandMap } from "./WordIslandMap";

// 手機全螢幕模式：整個螢幕都是海和島。
// 島可以放大縮小（按鈕或兩指捏合）；島超出畫面時，左右邊緣各出現一個箭頭，按一下直接捲到最左／最右。
// 點地塊時，那一塊會先被帶到畫面上方，下面升起的答題視窗就不會把它蓋住。
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const START_ZOOM = 1.7;
const ZOOM_STEP = 0.4;
const EDGE = 8;

const clampZoom = value => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
const smooth = () => {
    try {
        return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    } catch {
        return "auto";
    }
};

function ImmersiveIsland({ islands, islandIndex, onSelectIsland, onClose, sheetOpen, mapProps }) {
    const island = islands[islandIndex];
    const scroller = useRef(null);
    const center = useRef(null);
    const pinch = useRef(null);
    const [zoom, setZoom] = useState(START_ZOOM);
    const [edges, setEdges] = useState({ left: false, right: false });
    const zoomRef = useRef(START_ZOOM);
    zoomRef.current = zoom;

    // 全螢幕時鎖住背後頁面的捲動。
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, []);

    const measure = useCallback(() => {
        const el = scroller.current;
        if (!el) return;
        const left = el.scrollLeft > EDGE;
        const right = el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE;
        setEdges(prev => (prev.left === left && prev.right === right ? prev : { left, right }));
    }, []);

    // 換島或第一次進來：把島放在畫面正中央。
    useLayoutEffect(() => {
        const el = scroller.current;
        if (!el) return;
        el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
        el.scrollTop = 0;
        measure();
    }, [islandIndex, measure]);

    // 縮放後保持原本看的中心點。
    useLayoutEffect(() => {
        const el = scroller.current;
        if (!el) return;
        if (center.current) {
            el.scrollLeft = center.current.x * el.scrollWidth - el.clientWidth / 2;
            el.scrollTop = center.current.y * el.scrollHeight - el.clientHeight / 2;
            center.current = null;
        }
        measure();
    }, [zoom, measure]);

    useEffect(() => {
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [measure]);

    const changeZoom = useCallback(next => {
        const el = scroller.current;
        if (el && el.scrollWidth > 0 && el.scrollHeight > 0) {
            center.current = {
                x: (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth,
                y: (el.scrollTop + el.clientHeight / 2) / el.scrollHeight
            };
        }
        setZoom(clampZoom(next));
    }, []);

    // 兩指捏合縮放；需要非被動的 touchmove 才能擋掉瀏覽器自己的整頁縮放。
    useEffect(() => {
        const el = scroller.current;
        if (!el) return undefined;
        const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
        const onStart = event => {
            if (event.touches.length === 2) pinch.current = { start: distance(event.touches), zoom: zoomRef.current };
        };
        const onMove = event => {
            if (event.touches.length !== 2 || !pinch.current || !pinch.current.start) return;
            event.preventDefault();
            changeZoom(pinch.current.zoom * (distance(event.touches) / pinch.current.start));
        };
        const onEnd = event => { if (event.touches.length < 2) pinch.current = null; };
        el.addEventListener("touchstart", onStart, { passive: true });
        el.addEventListener("touchmove", onMove, { passive: false });
        el.addEventListener("touchend", onEnd, { passive: true });
        el.addEventListener("touchcancel", onEnd, { passive: true });
        return () => {
            el.removeEventListener("touchstart", onStart);
            el.removeEventListener("touchmove", onMove);
            el.removeEventListener("touchend", onEnd);
            el.removeEventListener("touchcancel", onEnd);
        };
    }, [changeZoom]);
    const goEdge = side => {
        const el = scroller.current;
        if (!el) return;
        el.scrollTo({ left: side === "left" ? 0 : el.scrollWidth, behavior: smooth() });
    };

    // 點地塊：先把那一塊帶到畫面上方約三成的位置，再交給原本的作答流程。
    const onTile = tile => {
        const el = scroller.current;
        const item = el?.querySelectorAll(".wi-grid__item")[tile.tile];
        if (el && item) {
            const box = el.getBoundingClientRect();
            const rect = item.getBoundingClientRect();
            el.scrollTo({
                left: el.scrollLeft + (rect.left - box.left) + rect.width / 2 - box.width / 2,
                top: Math.max(0, el.scrollTop + (rect.top - box.top) + rect.height / 2 - box.height * 0.28),
                behavior: smooth()
            });
        }
        mapProps.onTile(tile);
    };

    if (!island) return null;
    const upgradeCount = island.tiles.filter(tile => tile.can_upgrade).length;
    return (
        <div className={`wi-imm${sheetOpen ? " is-sheet-open" : ""}`} role="region" aria-label="單字島全螢幕挑戰">
            <div className="wi-imm__top">
                <button type="button" className="wi-imm__round" onClick={onClose} aria-label="回到單字島首頁"><FiArrowLeft aria-hidden="true" /></button>
                <p className="wi-imm__title">
                    <strong>第 {islandIndex + 1} 座島</strong>
                    <span>已佔領 {island.claimed_count} / {island.total}</span>
                    {upgradeCount > 0 && <span className="wi-imm__hint">{upgradeCount} 塊可以升級：點有「升級」標籤的地塊</span>}
                </p>
                <div className="wi-imm__zoom">
                    <button type="button" className="wi-imm__round" onClick={() => changeZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label="縮小"><FiMinus aria-hidden="true" /></button>
                    <button type="button" className="wi-imm__round" onClick={() => changeZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label="放大"><FiPlus aria-hidden="true" /></button>
                </div>
            </div>

            <div className="wi-imm__scroll" ref={scroller} onScroll={measure}>
                <div className="wi-imm__canvas" style={{ width: `${zoom * 100}%` }}>
                    <IslandMap {...mapProps} island={island} islandIndex={islandIndex} onTile={onTile} />
                </div>
            </div>

            {edges.left && <button type="button" className="wi-imm__edge is-left" onClick={() => goEdge("left")} aria-label="捲到島的最左邊"><FiChevronLeft aria-hidden="true" /></button>}
            {edges.right && <button type="button" className="wi-imm__edge is-right" onClick={() => goEdge("right")} aria-label="捲到島的最右邊"><FiChevronRight aria-hidden="true" /></button>}

            <div className="wi-imm__dots" role="group" aria-label="切換島嶼">
                {islands.map((item, index) => (
                    <button
                        key={item.island}
                        type="button"
                        className={`wi-imm__dot${index === islandIndex ? " is-current" : ""}`}
                        disabled={!item.unlocked}
                        aria-current={index === islandIndex ? "true" : undefined}
                        aria-label={`第 ${index + 1} 座島${item.unlocked ? "" : "，尚未開放"}`}
                        onClick={() => onSelectIsland(index)}
                    ><i /></button>
                ))}
            </div>
        </div>
    );
}

export default ImmersiveIsland;
