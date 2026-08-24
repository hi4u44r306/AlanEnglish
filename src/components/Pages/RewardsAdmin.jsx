import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiEdit3, FiGift, FiImage, FiPackage, FiPlus, FiRefreshCw, FiSave, FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import {
    deleteReward,
    getRewardAdminCatalog,
    saveReward,
    updateRewardRedemption,
    uploadGamificationImage
} from "../../services/gamificationService";
import "./css/Gamification.scss";

const CLASS_OPTIONS = ["E1", "E3", "E5", "E7"];
const STATUS_LABELS = {
    pending: "待確認",
    approved: "已確認",
    ordered: "已訂購",
    ready: "可領取",
    completed: "已領取",
    cancelled: "已取消"
};
const NEXT_ACTIONS = {
    pending: [{ status: "approved", label: "確認兌換" }, { status: "cancelled", label: "拒絕 / 取消" }],
    approved: [{ status: "ordered", label: "標記已訂購" }, { status: "ready", label: "直接標記到貨" }, { status: "cancelled", label: "取消" }],
    ordered: [{ status: "ready", label: "標記已到貨" }, { status: "cancelled", label: "取消" }],
    ready: [{ status: "completed", label: "標記已領取" }, { status: "cancelled", label: "取消" }]
};
const EMPTY_FORM = {
    id: null,
    name: "",
    description: "",
    image_path: "",
    image_url: "",
    points_cost: 50,
    stock_quantity: 10,
    enabled: true,
    per_student_limit: 1,
    applicable_classes: [],
    sort_order: 0
};
const formatNumber = value => Number(value || 0).toLocaleString("zh-TW");

function RewardsAdmin() {
    const { firebaseUser } = useAuth();
    const imageInputRef = useRef(null);
    const [data, setData] = useState({ rewards: [], redemptions: [] });
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [statusBusy, setStatusBusy] = useState(null);
    const [tab, setTab] = useState("rewards");

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        setLoading(true);
        try {
            const result = await getRewardAdminCatalog(firebaseUser);
            setData({ rewards: result?.rewards || [], redemptions: result?.redemptions || [] });
        } catch (error) {
            toast.error(error.message || "獎品管理讀取失敗");
        } finally {
            setLoading(false);
        }
    }, [firebaseUser]);

    useEffect(() => {
        load();
    }, [load]);

    const pendingCount = useMemo(() => data.redemptions.filter(item => item.status === "pending").length, [data.redemptions]);

    const resetForm = () => setForm(EMPTY_FORM);
    const editReward = reward => {
        setForm({
            id: reward.id,
            name: reward.name || "",
            description: reward.description || "",
            image_path: reward.image_path || "",
            image_url: reward.image_url || "",
            points_cost: Number(reward.points_cost || 50),
            stock_quantity: Number(reward.stock_quantity || 0),
            enabled: reward.enabled !== false,
            per_student_limit: reward.per_student_limit ?? "",
            applicable_classes: reward.applicable_classes || [],
            sort_order: Number(reward.sort_order || 0)
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const toggleClass = classCode => {
        setForm(current => ({
            ...current,
            applicable_classes: current.applicable_classes.includes(classCode)
                ? current.applicable_classes.filter(item => item !== classCode)
                : [...current.applicable_classes, classCode]
        }));
    };

    const handleImage = async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !firebaseUser) return;
        setUploading(true);
        try {
            const result = await uploadGamificationImage(firebaseUser, "reward", file);
            setForm(current => ({ ...current, image_path: result.path, image_url: result.image_url }));
            toast.success("獎品圖片上傳完成");
        } catch (error) {
            toast.error(error.message || "獎品圖片上傳失敗");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async event => {
        event.preventDefault();
        if (!firebaseUser || saving) return;
        setSaving(true);
        try {
            await saveReward(firebaseUser, {
                ...form,
                points_cost: Number(form.points_cost),
                stock_quantity: Number(form.stock_quantity),
                per_student_limit: form.per_student_limit === "" ? null : Number(form.per_student_limit),
                sort_order: Number(form.sort_order)
            });
            toast.success(form.id ? "獎品已更新" : "獎品已新增");
            resetForm();
            await load();
        } catch (error) {
            toast.error(error.message || "獎品儲存失敗");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async reward => {
        if (!firebaseUser || !window.confirm(`確定要刪除「${reward.name}」嗎？已有兌換紀錄的獎品會改為下架，不會刪除歷史紀錄。`)) return;
        try {
            const result = await deleteReward(firebaseUser, reward.id);
            toast.success(result.archived ? "已有兌換紀錄，已改為下架" : "獎品已刪除");
            if (form.id === reward.id) resetForm();
            await load();
        } catch (error) {
            toast.error(error.message || "刪除獎品失敗");
        }
    };

    const handleStatus = async (redemption, status) => {
        if (!firebaseUser || statusBusy) return;
        const isCancel = status === "cancelled";
        const confirmed = window.confirm(isCancel
            ? `確定取消「${redemption.reward_name}」的兌換嗎？系統會自動退回 ${formatNumber(redemption.points_cost)} P。`
            : `將「${redemption.reward_name}」更新為「${STATUS_LABELS[status]}」？`);
        if (!confirmed) return;
        setStatusBusy(redemption.id);
        try {
            await updateRewardRedemption(firebaseUser, redemption.id, status);
            toast.success("兌換狀態已更新");
            await load();
        } catch (error) {
            toast.error(error.message || "兌換狀態更新失敗");
        } finally {
            setStatusBusy(null);
        }
    };

    return (
        <main className="gamification-page gamification-admin">
            <section className="gamification-hero">
                <div>
                    <span className="gamification-eyebrow"><FiGift /> REWARD ADMIN</span>
                    <h1>獎品與兌換管理</h1>
                    <p>建立獎品、設定點數與庫存，並處理學生的兌換、代訂、到貨與領取流程。</p>
                </div>
                <button className="gamification-refresh" type="button" onClick={load} disabled={loading}><FiRefreshCw className={loading ? "is-spinning" : ""} />更新</button>
            </section>

            <div className="gamification-admin-tabs">
                <button type="button" className={tab === "rewards" ? "active" : ""} onClick={() => setTab("rewards")}><FiGift />獎品管理</button>
                <button type="button" className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><FiPackage />兌換代訂 {pendingCount > 0 && <span>{pendingCount}</span>}</button>
            </div>

            {tab === "rewards" ? (
                <div className="gamification-admin-grid">
                    <form className="gamification-editor" onSubmit={handleSave}>
                        <header><div><span>{form.id ? "EDIT REWARD" : "NEW REWARD"}</span><h2>{form.id ? "編輯獎品" : "新增獎品"}</h2></div>{form.id && <button type="button" className="gamification-text-button" onClick={resetForm}><FiPlus />新增另一個</button>}</header>

                        <button className="gamification-image-picker" type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading}>
                            {form.image_url ? <img src={form.image_url} alt="獎品預覽" /> : <><FiImage /><span>{uploading ? "上傳中…" : "上傳獎品照片"}</span></>}
                        </button>
                        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleImage} />

                        <label><span>獎品名稱</span><input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="例如：自動鉛筆" required /></label>
                        <label><span>獎品說明</span><textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="學生會看到的簡短說明" rows={3} /></label>
                        <div className="gamification-editor__row">
                            <label><span>需要點數</span><input type="number" min="1" value={form.points_cost} onChange={event => setForm(current => ({ ...current, points_cost: event.target.value }))} required /></label>
                            <label><span>庫存</span><input type="number" min="0" value={form.stock_quantity} onChange={event => setForm(current => ({ ...current, stock_quantity: event.target.value }))} required /></label>
                        </div>
                        <div className="gamification-editor__row">
                            <label><span>每位學生上限</span><input type="number" min="1" value={form.per_student_limit} onChange={event => setForm(current => ({ ...current, per_student_limit: event.target.value }))} placeholder="空白 = 不限制" /></label>
                            <label><span>排序</span><input type="number" value={form.sort_order} onChange={event => setForm(current => ({ ...current, sort_order: event.target.value }))} /></label>
                        </div>

                        <fieldset className="gamification-class-options">
                            <legend>適用班級 <small>全部不勾 = 所有班級</small></legend>
                            <div>{CLASS_OPTIONS.map(classCode => <label key={classCode}><input type="checkbox" checked={form.applicable_classes.includes(classCode)} onChange={() => toggleClass(classCode)} /><span>{classCode}</span></label>)}</div>
                        </fieldset>

                        <label className="gamification-switch"><input type="checkbox" checked={form.enabled} onChange={event => setForm(current => ({ ...current, enabled: event.target.checked }))} /><span>學生商城上架</span></label>
                        <button className="gamification-save" type="submit" disabled={saving || uploading}><FiSave />{saving ? "儲存中…" : form.id ? "儲存修改" : "新增獎品"}</button>
                    </form>

                    <section className="gamification-admin-list">
                        <header><div><span>REWARD CATALOG</span><h2>目前獎品</h2></div></header>
                        {loading ? <div className="gamification-loading">資料載入中…</div> : data.rewards.length === 0 ? <div className="gamification-empty">目前還沒有獎品。</div> : data.rewards.map(reward => (
                            <article key={reward.id} className={!reward.enabled ? "is-disabled" : ""}>
                                <div className="gamification-admin-thumb">{reward.image_url ? <img src={reward.image_url} alt="" /> : <FiGift />}</div>
                                <div className="gamification-admin-copy"><strong>{reward.name}</strong><span>{formatNumber(reward.points_cost)} P · 庫存 {reward.stock_quantity}</span><small>{reward.enabled ? "上架中" : "已下架"}{reward.applicable_classes?.length ? ` · ${reward.applicable_classes.join(" / ")}` : " · 全班級"}</small></div>
                                <div className="gamification-admin-actions"><button type="button" onClick={() => editReward(reward)}><FiEdit3 />編輯</button><button type="button" className="danger" onClick={() => handleDelete(reward)}><FiTrash2 />刪除</button></div>
                            </article>
                        ))}
                    </section>
                </div>
            ) : (
                <section className="gamification-orders">
                    <header><div><span>REDEMPTIONS</span><h2>學生兌換與代訂</h2></div></header>
                    {loading ? <div className="gamification-loading">兌換資料載入中…</div> : data.redemptions.length === 0 ? <div className="gamification-empty">目前沒有兌換申請。</div> : (
                        <div className="gamification-order-list">
                            {data.redemptions.map(item => (
                                <article key={item.id}>
                                    <div className="gamification-order-student"><strong>{item.student?.english_name || item.student?.name || `學生 #${item.student_id}`}</strong><span>{item.student?.class ? `${item.student.class} 班` : "未設定班級"}</span></div>
                                    <div className="gamification-order-reward"><strong>{item.reward_name}</strong><span>{formatNumber(item.points_cost)} P</span></div>
                                    <div className={`gamification-status status-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</div>
                                    <div className="gamification-order-actions">{(NEXT_ACTIONS[item.status] || []).map(action => <button key={action.status} type="button" className={action.status === "cancelled" ? "danger" : ""} disabled={statusBusy === item.id} onClick={() => handleStatus(item, action.status)}>{action.label}</button>)}</div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </main>
    );
}

export default RewardsAdmin;
