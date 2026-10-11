import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { nativeArt, nativeThumbnail, NATIVE_CHARACTERS, NATIVE_ITEMS } from "../../game/teamBossRpg/native/native-rig.mjs";

export function NativeItemArt({ item, className = "" }) {
    const data = NATIVE_ITEMS.find(entry => entry.id === item);
    return data ? <div className={"tb-native-item-art " + className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: nativeThumbnail(data) }} /> : <span>外觀待準備</span>;
}

function previousPose(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup;
    template.content.querySelectorAll(".native-skill-fx").forEach(effect => effect.remove());
    return template.innerHTML.replace('class="native-sprite"', 'class="native-sprite-previous"').replaceAll('data-native-', 'data-previous-native-');
}
export default function TeamBossNativeArt({ character, frame = 0, loadout, effect, camera, transition = false, className = "" }) {
    const id = NATIVE_CHARACTERS.some(entry => entry.id === character) ? character : "boy-knight";
    const bits = JSON.stringify(loadout || {});
    const effectBits = JSON.stringify(effect || null);
    const markup = useMemo(() => nativeArt(id, frame, JSON.parse(bits), JSON.parse(effectBits), {camera}), [id, frame, bits, effectBits, camera]);
    const last = useRef(null), [previous, setPrevious] = useState(null);
    useLayoutEffect(() => {
        const before = last.current;
        last.current = { markup, id, frame, bits, camera };
        if (!transition || !before || before.id !== id || before.bits !== bits || before.camera !== camera || before.frame === frame) {
            setPrevious(null);
            return undefined;
        }
        // The short-lived silhouette is decorative; only the current SVG is an actor.
        setPrevious({ frame: before.frame, markup: previousPose(before.markup) });
        const timer = setTimeout(() => setPrevious(null), 80);
        return () => clearTimeout(timer);
    }, [markup, id, frame, bits, camera, transition]);
    if (transition) return <div className={"tb-native-art " + className} aria-hidden="true" data-frame-blend={previous ? "active" : "rest"}>
        <div className="tb-native-frame-current" dangerouslySetInnerHTML={{ __html: markup }} />
        {previous && <div key={previous.frame} className="tb-native-frame-previous" dangerouslySetInnerHTML={{ __html: previous.markup }} />}
    </div>;
    return <div className={"tb-native-art " + className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}
