import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { studentPageScope } from "../services/studentPageCache";
import { fetchStaffPageCache, readStaffPageCache, subscribeStaffPageCache, updateStaffPageCache } from "../services/staffPageCache";

export default function useStaffPageQuery(key, loader) {
    const { firebaseUser, role, studentProfile } = useAuth();
    const enabled = Boolean(firebaseUser?.uid && ["teacher", "admin"].includes(role));
    const scope = enabled ? studentPageScope(firebaseUser, role, studentProfile) : "";
    const identity = `${scope}:${key}`;
    const loaderRef = useRef(loader), active = useRef(identity), revision = useRef(0);
    loaderRef.current = loader; active.current = identity;
    const [state, setState] = useState({ identity, pending: false, error: null });
    const current = state.identity === identity ? state : { pending: false, error: null };
    const entry = enabled ? readStaffPageCache(scope, key) : null;
    const refresh = useCallback((force = true) => {
        if (!scope) return Promise.resolve(null);
        const token = ++revision.current, requestIdentity = identity, requestLoader = loaderRef.current;
        setState({ identity, pending: true, error: null });
        return fetchStaffPageCache(scope, key, requestLoader, { force }).then(value => {
            if (active.current === requestIdentity && token === revision.current) setState({ identity, pending: false, error: null });
            return value;
        }).catch(error => {
            if (active.current === requestIdentity && token === revision.current) setState({ identity, pending: false, error });
            return null;
        });
    }, [scope, key, identity]);
    useEffect(() => {
        if (!scope) return undefined;
        const unsubscribe = subscribeStaffPageCache(scope, key, () => setState(previous => ({ ...previous, identity })));
        refresh(false);
        const focus = () => refresh(false);
        window.addEventListener("focus", focus);
        return () => { unsubscribe(); window.removeEventListener("focus", focus); revision.current += 1; if (active.current === identity) active.current = ""; };
    }, [scope, key, identity, refresh]);
    const update = useCallback(updater => updateStaffPageCache(scope, key, updater), [scope, key]);
    return { scope, data: entry?.value || null, loading: enabled && !entry && !current.error, refreshing: current.pending, error: current.error, refresh, update };
}
