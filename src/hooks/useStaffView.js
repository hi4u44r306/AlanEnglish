import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { readStaffView, writeStaffView } from "../services/staffPageCache";

export default function useStaffView(scope, key, defaults, ready) {
    const [state, setState] = useState(() => ({ scope, value: readStaffView(scope, key) || defaults }));
    const value = state.scope === scope ? state.value : readStaffView(scope, key) || defaults;
    const current = useRef({ scope, value }); current.current = { scope, value };
    const initial = useRef(defaults);
    const setView = useCallback(updater => {
        const previous = current.current.scope === scope ? current.current.value : readStaffView(scope, key) || initial.current;
        const next = typeof updater === "function" ? updater(previous) : updater;
        current.current = { scope, value: next }; writeStaffView(scope, key, next); setState({ scope, value: next });
    }, [scope, key]);
    useEffect(() => { if (scope) writeStaffView(scope, key, value); }, [scope, key, value]);
    useLayoutEffect(() => {
        if (!scope || !ready || process.env.NODE_ENV === "test") return undefined;
        const savedY = Math.max(0, Number(readStaffView(scope, key)?.scrollY) || 0);
        let restoring = true, second;
        const first = window.requestAnimationFrame(() => { second = window.requestAnimationFrame(() => {
            window.scrollTo({ top: savedY, left: 0, behavior: "auto" }); restoring = false;
        }); });
        const remember = () => {
            if (!restoring) writeStaffView(scope, key, { ...(readStaffView(scope, key) || current.current.value), scrollY: window.scrollY });
        };
        window.addEventListener("scroll", remember, { passive: true });
        return () => { remember(); window.removeEventListener("scroll", remember); window.cancelAnimationFrame(first); if (second) window.cancelAnimationFrame(second); };
    }, [scope, key, ready]);
    return [value, setView];
}
