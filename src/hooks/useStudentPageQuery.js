import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { fetchStudentPageCache, readStudentPageCache, studentPageScope, subscribeStudentPageCache, updateStudentPageCache } from "../services/studentPageCache";

export default function useStudentPageQuery(key, loader, { enabled = true, persist = true } = {}) {
    const { firebaseUser, role, studentProfile } = useAuth();
    const scope = studentPageScope(firebaseUser, role, studentProfile);
    const uid = firebaseUser?.uid;
    const canPersist = persist && role === "student";
    const identity = `${scope}:${key}:${enabled}`;
    const loaderRef = useRef(loader);
    loaderRef.current = loader;
    const [state, setState] = useState({ identity, error: null, pending: false });
    const entry = enabled ? readStudentPageCache(scope, key, { persist: canPersist }) : null;
    const current = state.identity === identity ? state : { error: null, pending: false };
    const activeRef = useRef(identity);
    const revisionRef = useRef(0);
    activeRef.current = identity;

    const refresh = useCallback((force = true) => {
        if (!enabled || !uid || !scope) return Promise.resolve();
        const requestIdentity = identity;
        const revision = ++revisionRef.current;
        const requestLoader = loaderRef.current;
        setState({ identity, error: null, pending: true });
        return fetchStudentPageCache(scope, key, requestLoader, { persist: canPersist, force })
            .then(() => {
                if (activeRef.current === requestIdentity && revisionRef.current === revision) setState({ identity, error: null, pending: false });
            }).catch(error => {
                if (activeRef.current === requestIdentity && revisionRef.current === revision) setState({ identity, error, pending: false });
            });
    }, [enabled, uid, scope, key, canPersist, identity]);

    useEffect(() => {
        if (!enabled || !scope) return undefined;
        const unsubscribe = subscribeStudentPageCache(scope, key, reason => {
            if (reason === "invalidated") refresh(true);
            else setState(previous => ({ ...previous, identity }));
        });
        refresh(false);
        const focus = () => refresh(false);
        window.addEventListener("focus", focus);
        return () => {
            unsubscribe();
            window.removeEventListener("focus", focus);
            revisionRef.current += 1;
            if (activeRef.current === identity) activeRef.current = "";
        };
    }, [scope, key, enabled, identity, refresh]);

    return {
        data: entry?.value || null,
        error: current.error,
        loading: enabled && !entry && !current.error,
        refreshing: current.pending,
        update: updater => updateStudentPageCache(scope, key, updater),
        refresh
    };
}
