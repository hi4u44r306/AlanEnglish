import { useCallback, useEffect, useState } from "react";

const preferenceKey = uid => `ae-reward-goal-v1:${encodeURIComponent(uid)}`;
const readGoal = uid => {
    if (!uid) return null;
    try {
        const value = localStorage.getItem(preferenceKey(uid));
        return value && value.length <= 128 ? value : null;
    } catch {
        return null;
    }
};

// This stores only a display preference. Stock, price and redemption remain server decisions.
export default function useRewardGoal(uid) {
    const [selection, setSelection] = useState(() => ({ uid, id: readGoal(uid) }));
    useEffect(() => { setSelection({ uid, id: readGoal(uid) }); }, [uid]);
    const chooseGoal = useCallback(id => {
        const value = String(id);
        if (value.length > 128) return;
        setSelection({ uid, id: value });
        if (!uid) return;
        try { localStorage.setItem(preferenceKey(uid), value); } catch { /* Keep the choice for this visit. */ }
    }, [uid]);
    return [selection.uid === uid ? selection.id : readGoal(uid), chooseGoal];
}
