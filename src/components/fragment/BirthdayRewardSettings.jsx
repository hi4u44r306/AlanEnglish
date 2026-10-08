import React, { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getBirthdayRewardSettings, saveBirthdayRewardSettings } from "../../services/gamificationService";

export default function BirthdayRewardSettings() {
    const { firebaseUser } = useAuth();
    const [reload, setReload] = useState(0);
    const [settings, setSettings] = useState(null);
    const [points, setPoints] = useState("");
    const [enabled, setEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setSettings(null);
        setError("");
        if (!firebaseUser) return () => { cancelled = true; };
        getBirthdayRewardSettings(firebaseUser).then(result => {
            if (cancelled) return;
            if (!result?.settings || !Number.isInteger(result.settings.gift_points)) throw new Error("生日活動設定不完整，請重新讀取。");
            setSettings(result.settings);
            setPoints(String(result.settings.gift_points));
            setEnabled(result.settings.enabled);
        }).catch(failure => {
            if (!cancelled) setError(failure.message || "生日活動設定讀取失敗");
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [firebaseUser, reload]);
    const save = async event => {
        event.preventDefault();
        if (saving || loading || !settings || !firebaseUser) return;
        const amount = Number(points);
        if (points.trim() === "" || !Number.isInteger(amount) || amount < 0 || amount > 10000) {
            setError("生日禮請填寫 0～10,000 的整數點數。");
            return;
        }
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const result = await saveBirthdayRewardSettings(firebaseUser, { gift_points: amount, enabled, version: settings.version });
            setSettings(result.settings);
            setPoints(String(result.settings.gift_points));
            setEnabled(result.settings.enabled);
            setMessage("生日活動設定已儲存，新的點數適用於尚未領取的生日禮。");
        } catch (failure) {
            setError(failure.message || "生日活動設定儲存失敗");
        } finally { setSaving(false); }
    };
    return <section className="birthday-settings" aria-labelledby="birthday-settings-heading">
        <h2 id="birthday-settings-heading">生日月活動</h2>
        <p>生日當月經驗值兩倍；有效在校英文班學生首次登入時自動領取生日禮，每人每年一次。</p>
        {loading ? <p role="status">正在讀取生日活動設定…</p> : settings && <form onSubmit={save}>
            <label className="birthday-settings__toggle"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={saving} />啟用生日月活動</label>
            <label htmlFor="birthday-gift-points">每年生日贈送 AE Points</label>
            <div className="birthday-settings__controls"><input id="birthday-gift-points" type="number" min="0" max="10000" step="1" required value={points} onChange={event => setPoints(event.target.value)} disabled={saving} /><button type="submit" disabled={saving}>{saving ? "儲存中…" : "儲存生日活動"}</button></div>
            <small>可設定 0～10,000 點；0 點表示不贈送生日禮，XP 仍加倍。變更不補發、不追回已領點數。停用活動會停止新生日禮及 XP 加倍。</small>
        </form>}
        {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setReload(value => value + 1)} disabled={saving || loading}>重新讀取設定</button></div>}
        {message && <p role="status">{message}</p>}
    </section>;
}
