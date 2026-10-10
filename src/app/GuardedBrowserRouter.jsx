import React, { useLayoutEffect, useRef, useState } from "react";
import { Router } from "react-router-dom";
import { createBrowserHistory } from "@remix-run/router";
import { confirmRouteLeave } from "../hooks/useUnsavedChanges";

// BrowserRouter's history adapter, with the POP decision made before React
// receives a new location. A cancelled back/forward must never unmount a draft.
export default function GuardedBrowserRouter({ children, basename, future, window: browserWindow }) {
    const historyRef = useRef(null);
    if (!historyRef.current) historyRef.current = createBrowserHistory({ window: browserWindow, v5Compat: true });
    const history = historyRef.current;
    const [state, setState] = useState(() => ({ action: history.action, location: history.location }));
    const published = useRef(state.location), restoring = useRef(false);
    useLayoutEffect(() => history.listen(update => {
        if (restoring.current) { restoring.current = false; return; }
        const changesPage = update.location.pathname !== published.current.pathname || update.location.search !== published.current.search;
        if (update.action === "POP" && changesPage && Number.isFinite(update.delta) && update.delta !== 0 && !confirmRouteLeave()) {
            restoring.current = true;
            history.go(-update.delta);
            return;
        }
        published.current = update.location;
        setState({ action: update.action, location: update.location });
    }), [history]);
    return <Router basename={basename} location={state.location} navigationType={state.action} navigator={history} future={future}>{children}</Router>;
}
