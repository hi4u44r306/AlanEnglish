import React, { useEffect, useMemo, useRef } from "react";
import { BADGES, CENTER_TILE, baseSkinFor, fusedImageFor, fusedSkinFor, ghostImageFor, isSeasonal, skinForClaim, tileArtFor, tileImageFor } from "../../utils/wordIslandSkins";

// 一座島：16 塊六角地塊拼在海上。還沒佔領的地塊沉在水裡（可以點來作答），答對後那一塊從水裡浮上來；
// 已佔領的地塊隔天再答對會升級（繁榮：出現裝飾、星星徽章、金色光暈）；
// 整座島都升級後融合成一張完整的島，點「翻開地塊」可以回到 16 塊並練習任何一個字。
// 畫面平常完全靜止，只有「你操作的那一刻」才播動畫。
const ROWS = [3, 4, 5, 4];
const STEP_X = 104;
const STEP_Y = 62;
const STAGE_W = 600;
const STAGE_H = 400;
const TILE_W = 112;

// 每一格在舞台上的中心位置（以 600 x 400 為基準，輸出成百分比，所以任何寬度都會等比縮放）。
const POSITIONS = (() => {
    const list = [];
    ROWS.forEach((count, row) => {
        for (let i = 0; i < count; i += 1) {
            list.push({ row, left: ((STAGE_W / 2 + (i - (count - 1) / 2) * STEP_X) / STAGE_W) * 100, top: ((STAGE_H / 2 + (row - 1.5) * STEP_Y) / STAGE_H) * 100 });
        }
    });
    return list;
})();

const tileLabel = (tile, flipped) => {
    if (tile.state === "claimed") {
        const parts = [`已佔領：${tile.display}`];
        if (tile.review) parts.push("待複習");
        if (tile.stale) parts.push("很久沒練了");
        if (tile.can_upgrade) parts.push("可以再答一次升級");
        else if (flipped && tile.can_practice) parts.push("按下練習");
        else if (tile.level >= 1) parts.push("已升級");
        else parts.push("明天再來升級");
        return parts.join("，");
    }
    if (tile.state === "locked") return `${tile.gloss}，要先把上一座島佔滿`;
    if (tile.state === "cooldown") return `${tile.gloss}，剛看過答案，明天再來`;
    return `${tile.review ? "待複習：" : ""}${tile.gloss}，按下作答`;
};

export function IslandMap({ island, islandIndex, onTile, fresh, flipped, onFlip, override = "", askingTile = null }) {
    // 每一塊地的樣子依「哪天佔領」決定（節日當天佔領的是節日地塊）；還沒佔領的格子用這座島原本的地形。
    const baseSkin = baseSkinFor(islandIndex);
    const tileSkins = useMemo(() => island.tiles.map(tile => (tile.state === "claimed" ? skinForClaim(islandIndex, tile.claimed_at, { override }) : override ? skinForClaim(islandIndex, null, { override }) : baseSkin)), [island.tiles, islandIndex, override, baseSkin]);
    const artCache = useRef(new Map());
    const artOf = (skin, tileIndex) => {
        const key = `${islandIndex}:${skin.id}`;
        if (!artCache.current.has(key)) artCache.current.set(key, tileArtFor(skin, islandIndex, island.tiles.length));
        return artCache.current.get(key)[tileIndex];
    };
    // 融合成哪一張圖：看哪一種樣子的地塊最多；一樣多時節日優先。
    const { skin, holidayCounts } = useMemo(
        () => fusedSkinFor(islandIndex, island.tiles.filter(tile => tile.state === "claimed").map(tile => tile.claimed_at), { override }),
        [island.tiles, islandIndex, override]
    );
    const fusedSrc = island.maxed ? fusedImageFor(skin) : null;
    const showFused = Boolean(fusedSrc) && !flipped;
    // 升滿的島：有融合圖的要「翻開」才看得到單字；沒有融合圖的（節日島）直接顯示單字、可以練習。
    const wordsOn = island.maxed && (flipped || !fusedSrc);
    return (
        <div className={`wi-stage${island.maxed ? " is-maxed" : ""}`} data-skin={skin.id}>
            {(isSeasonal(skin) || holidayCounts.length > 0) && (
                <span className="wi-stage__tag">
                    {isSeasonal(skin)
                        ? skin.label
                        : holidayCounts.map(entry => `${entry.skin.label}地塊 ×${entry.n}`).join("、")}
                </span>
            )}
            {showFused ? (
                <img className="wi-fused" src={fusedSrc} alt={`第 ${islandIndex + 1} 座島，已完全升級`} draggable="false" />
            ) : (
                <ul className="wi-grid">
                    {island.tiles.map(tile => {
                        const pos = POSITIONS[tile.tile];
                        const tileArt = artOf(tileSkins[tile.tile], tile.tile);
                        const claimed = tile.state === "claimed";
                        const level = tile.level ?? 0;
                        const center = tile.tile === CENTER_TILE;
                        const image = claimed ? tileImageFor(tileArt, level, { center }) : null;
                        const practice = claimed && wordsOn && tile.can_practice;
                        const clickable = tile.state === "open" || (claimed && tile.can_upgrade) || practice;
                        const isFresh = fresh && fresh.tile === tile.tile ? fresh.kind : "";
                        const classes = ["wi-tile", `is-${tile.state}`];
                        if (claimed && level >= 1) classes.push("is-gold");
                        if (claimed && tile.can_upgrade) classes.push("can-upgrade");
                        if (tile.stale) classes.push("is-stale");
                        if (tile.review) classes.push("is-review");
                        if (askingTile === tile.tile) classes.push("is-asking");
                        if (isFresh === "claim") classes.push("is-rising");
                        if (isFresh === "upgrade") classes.push("is-upgrading");
                        return (
                            <li key={tile.tile} className="wi-grid__item" style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: `${(TILE_W / STAGE_W) * 100}%`, zIndex: pos.row }}>
                                <button
                                    type="button"
                                    className={classes.join(" ")}
                                    aria-disabled={clickable ? undefined : "true"}
                                    aria-label={tileLabel(tile, wordsOn)}
                                    onClick={() => clickable && onTile(tile)}
                                >
                                    <img className="wi-tile__img" src={claimed ? image.src : ghostImageFor(tileArt)} alt="" draggable="false" />
                                    {!claimed && tile.state !== "locked" && <span className="wi-tile__label"><span className="wi-tile__text">{tile.state === "cooldown" ? "明天再來" : tile.gloss}</span></span>}
                                    {claimed && wordsOn && <span className="wi-tile__label is-word">{tile.display}</span>}
                                    {claimed && !wordsOn && level >= 1 && <img className="wi-tile__coin" src={BADGES.star} alt="" draggable="false" />}
                                    {claimed && tile.can_upgrade && (
                                        <span className="wi-tile__up" aria-hidden="true">
                                            <svg viewBox="0 0 48 48">
                                                <path d="M24 6 L42 28 H30 V42 H18 V28 H6 Z" fill="#2f5fd0" stroke="#2f5fd0" strokeWidth="3" strokeLinejoin="round" />
                                            </svg>
                                            升級
                                        </span>
                                    )}
                                    {tile.review && <span className="wi-tile__dot" aria-hidden="true" />}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            {island.maxed && fusedSrc && (
                <button type="button" className="wi-flip" onClick={onFlip}>{flipped ? "收起地塊" : "翻開地塊"}</button>
            )}
            {island.maxed && island.needs_review && (
                <button type="button" className="wi-cloud" onClick={() => !wordsOn && onFlip && onFlip()} aria-label="這座島有字想複習，點開練習">
                    <span className="wi-cloud__body">想複習</span>
                    <span className="wi-cloud__badge" aria-hidden="true">!</span>
                </button>
            )}
        </div>
    );
}

// 勳章彈出（升級過半、全島佔領、複習完成）：自己消失，不需要按。
export function MedalPop({ badge, text, onDone }) {
    useEffect(() => {
        const timer = setTimeout(onDone, 2400);
        return () => clearTimeout(timer);
    }, [onDone]);
    return (
        <div className="wi-medal" role="status" aria-live="polite">
            <div className="wi-medal__rays" aria-hidden="true" />
            <img className="wi-medal__img" src={BADGES[badge]} alt="" draggable="false" />
            <p className="wi-medal__text">{text}</p>
        </div>
    );
}

// 完全升級：畫面變暗，皇冠徽章落下，下面寫「完全升級」。不放數字。
export function FullUpgradeOverlay({ onClose }) {
    return (
        <div className="wi-full" role="dialog" aria-modal="true" aria-label="完全升級" onClick={onClose}>
            <div className="wi-full__rays" aria-hidden="true" />
            <img className="wi-full__badge" src={BADGES.crown} alt="" draggable="false" />
            <p className="wi-full__label">完全升級</p>
            <button type="button" className="wi-full__close" onClick={onClose}>繼續</button>
        </div>
    );
}
