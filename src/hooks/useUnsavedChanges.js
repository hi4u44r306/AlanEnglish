import { useCallback, useContext, useLayoutEffect, useRef } from "react";
import { UNSAFE_LocationContext, UNSAFE_NavigationContext } from "react-router-dom";

export const cancelUnsavedLeaveApproval = () => window.dispatchEvent(new Event("ae:cancel-unsaved-leave"));
export const confirmRouteLeave = () => window.dispatchEvent(new Event("ae:confirm-route-leave", { cancelable: true }));
export const confirmUnsavedChanges = () => window.dispatchEvent(new Event("ae:confirm-unsaved-leave", { cancelable: true }));

// Only opted-in forms guard route changes. Expired auth scopes always allow
// redirects; GuardedBrowserRouter checks POP before changing the rendered page.
export default function useUnsavedChanges(dirty, { enabled = true, message = "尚有未儲存的修改。離開後會捨棄這些內容，確定離開嗎？" } = {}) {
    const navigation = useContext(UNSAFE_NavigationContext);
    const locationContext = useContext(UNSAFE_LocationContext);
    const current = useRef({ dirty, enabled, message, location: locationContext?.location });
    current.current = { dirty, enabled, message, location: locationContext?.location };
    const approvedLeave = useRef(false);
    const confirmDiscard = useCallback(() => {
        if (approvedLeave.current) { approvedLeave.current = false; return true; }
        return !current.current.enabled || !current.current.dirty || window.confirm(current.current.message);
    }, []);
    const navigator = navigation?.navigator;
    useLayoutEffect(() => {
        const cancelApproval = () => { approvedLeave.current = false; };
        const confirmRoute = event => { if (!confirmDiscard()) event.preventDefault(); };
        const confirmLeave = event => { if (!confirmDiscard()) event.preventDefault(); else approvedLeave.current = current.current.enabled && current.current.dirty; };
        const beforeUnload = event => {
            if (!current.current.enabled || !current.current.dirty) return;
            event.preventDefault(); event.returnValue = "";
        };
        window.addEventListener("beforeunload", beforeUnload);
        window.addEventListener("ae:confirm-unsaved-leave", confirmLeave);
        window.addEventListener("ae:confirm-route-leave", confirmRoute);
        window.addEventListener("ae:cancel-unsaved-leave", cancelApproval);
        if (!navigator) return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("ae:confirm-unsaved-leave", confirmLeave); window.removeEventListener("ae:confirm-route-leave", confirmRoute); window.removeEventListener("ae:cancel-unsaved-leave", cancelApproval); };
        const originals = { push: navigator.push, replace: navigator.replace };
        const samePage = to => {
            const location = current.current.location;
            if (!location) return false;
            const path = typeof to === "string" ? new URL(to, window.location.origin + location.pathname) : to;
            return (path.pathname || location.pathname) === location.pathname && (path.search || "") === (location.search || "");
        };
        const push = (...args) => {
            if (!samePage(args[0]) && !confirmDiscard()) return;
            return originals.push.apply(navigator, args);
        };
        const replace = (...args) => {
            if (!samePage(args[0]) && !confirmDiscard()) return;
            return originals.replace.apply(navigator, args);
        };
        navigator.push = push; navigator.replace = replace;
        return () => {
            window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("ae:confirm-unsaved-leave", confirmLeave); window.removeEventListener("ae:confirm-route-leave", confirmRoute); window.removeEventListener("ae:cancel-unsaved-leave", cancelApproval);
            if (navigator.push === push) navigator.push = originals.push;
            if (navigator.replace === replace) navigator.replace = originals.replace;
        };
    }, [navigator, confirmDiscard]);
    return confirmDiscard;
}
