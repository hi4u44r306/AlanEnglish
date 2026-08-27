import React, { useEffect, useMemo, useState } from "react";
import { BiEditAlt, BiLinkExternal, BiPlus, BiSave, BiTrash, BiX } from "react-icons/bi";
import { useAuth } from "../../auth/AuthContext";
import {
    LINK_CATEGORIES,
    bootstrapManagedLinks,
    createManagedLink,
    deleteManagedLink,
    getManagedLinks,
    updateManagedLink
} from "../../services/linkService";
import { sortLinkItemsAscending } from "../../utils/linkSort";
import "./css/LinkAdmin.scss";

const isValidHttpUrl = value => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
};

function LinkAdmin() {
    const { firebaseUser } = useAuth();
    const [title, setTitle] = useState("");
    const [url, setUrl] = useState("");
    const [category, setCategory] = useState("exercise");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [editUrl, setEditUrl] = useState("");
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!firebaseUser) return undefined;
        let cancelled = false;

        const bootstrap = async () => {
            try {
                setLoading(true);
                setError("");
                const result = await bootstrapManagedLinks(firebaseUser);
                if (cancelled) return;
                setItems(sortLinkItemsAscending(result?.links || []));
                if (result?.migration) {
                    const imported = Number(result.migration.imported || 0);
                    const skipped = Number(result.migration.skipped || 0);
                    setMessage(
                        imported > 0
                            ? `已從 Firebase 安全匯入 ${imported} 筆舊連結${skipped > 0 ? `，略過 ${skipped} 筆格式不完整資料` : ""}。之後將完全使用 Supabase。`
                            : "Supabase links 已完成初始化，未找到需要匯入的 Firebase 連結。"
                    );
                }
            } catch (bootstrapError) {
                console.error("Supabase Links 後台初始化失敗:", bootstrapError);
                if (!cancelled) {
                    setItems([]);
                    setError(bootstrapError?.message || "無法載入 Supabase links 資料。");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        bootstrap();
        return () => {
            cancelled = true;
        };
    }, [firebaseUser]);

    const groupedCount = useMemo(() => LINK_CATEGORIES.reduce((result, option) => {
        result[option.value] = items.filter(item => item.category === option.value).length;
        return result;
    }, {}), [items]);

    const clearNotice = () => {
        setMessage("");
        setError("");
    };

    const refreshLinks = async () => {
        const result = await getManagedLinks(firebaseUser);
        setItems(sortLinkItemsAscending(result?.links || []));
    };

    const startEditing = item => {
        clearNotice();
        setEditingId(item.id);
        setEditTitle(item.title || "");
        setEditUrl(item.url || "");
    };

    const cancelEditing = () => {
        if (updating) return;
        setEditingId(null);
        setEditTitle("");
        setEditUrl("");
    };

    const handleUpdate = async item => {
        if (updating || !firebaseUser) return;
        clearNotice();

        const cleanTitle = editTitle.trim();
        const cleanUrl = editUrl.trim();
        if (!cleanTitle || !cleanUrl) {
            setError("請輸入連結名稱與網址。");
            return;
        }
        if (!isValidHttpUrl(cleanUrl)) {
            setError("網址格式不正確，請輸入以 http:// 或 https:// 開頭的完整網址。");
            return;
        }

        setUpdating(true);
        try {
            await updateManagedLink(firebaseUser, {
                id: item.id,
                title: cleanTitle,
                url: cleanUrl,
                category: item.category,
                sort_order: item.sort_order,
                is_active: item.is_active
            });
            await refreshLinks();
            setEditingId(null);
            setEditTitle("");
            setEditUrl("");
            setMessage(`已更新「${cleanTitle}」，公開頁面會直接顯示新名稱與網址。`);
        } catch (updateError) {
            console.error("更新 Supabase 連結失敗:", updateError);
            setError(updateError?.message || "更新失敗，請稍後再試。");
        } finally {
            setUpdating(false);
        }
    };

    const handleSubmit = async event => {
        event.preventDefault();
        if (saving || !firebaseUser) return;
        clearNotice();

        const cleanTitle = title.trim();
        const cleanUrl = url.trim();

        if (!cleanTitle || !cleanUrl) {
            setError("請輸入連結名稱與網址。");
            return;
        }

        if (!isValidHttpUrl(cleanUrl)) {
            setError("網址格式不正確，請輸入以 http:// 或 https:// 開頭的完整網址。");
            return;
        }

        setSaving(true);
        try {
            await createManagedLink(firebaseUser, {
                title: cleanTitle,
                url: cleanUrl,
                category
            });
            await refreshLinks();
            setTitle("");
            setUrl("");
            setMessage("連結已新增到 Supabase，公開首頁會直接讀取新資料。");
        } catch (submitError) {
            console.error("新增 Supabase 連結失敗:", submitError);
            setError(submitError?.message || "新增失敗，請稍後再試。");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async item => {
        if (!firebaseUser) return;
        const confirmed = window.confirm(`確定要刪除「${item.title || "未命名連結"}」嗎？`);
        if (!confirmed) return;

        clearNotice();
        try {
            await deleteManagedLink(firebaseUser, item.id);
            setItems(current => current.filter(link => link.id !== item.id));
            setMessage(`已從 Supabase 刪除「${item.title || "未命名連結"}」。`);
        } catch (deleteError) {
            console.error("刪除 Supabase 連結失敗:", deleteError);
            setError(deleteError?.message || "刪除失敗，請稍後再試。");
        }
    };

    const getCategoryLabel = value => LINK_CATEGORIES.find(option => option.value === value)?.label || "Special";

    return (
        <div className="link-admin-page">
            <div className="link-admin-page__header">
                <div>
                    <span className="link-admin-page__kicker">PUBLIC LINKS</span>
                    <h1>教材連結管理</h1>
                    <p>公開教材連結已改由 Supabase 管理；首次進入此頁時會自動嘗試匯入舊 Firebase links。</p>
                </div>
                <a href="/" target="_blank" rel="noopener noreferrer" className="link-admin-page__preview">
                    <BiLinkExternal />
                    查看公開頁面
                </a>
            </div>

            <div className="link-admin-page__stats">
                <article><span>全部連結</span><strong>{items.length}</strong></article>
                {LINK_CATEGORIES.map(option => (
                    <article key={option.value}>
                        <span>{option.label}</span>
                        <strong>{groupedCount[option.value] || 0}</strong>
                    </article>
                ))}
            </div>

            <div className="link-admin-page__layout">
                <section className="link-admin-page__panel">
                    <div className="link-admin-page__panel-heading">
                        <span className="link-admin-page__panel-icon"><BiPlus /></span>
                        <div>
                            <h2>新增連結</h2>
                            <p>新資料會直接寫入 Supabase links，並使用固定分類與結構化欄位。</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="link-admin-page__form">
                        <label>
                            <span>教材名稱</span>
                            <input
                                type="text"
                                value={title}
                                onChange={event => setTitle(event.target.value)}
                                placeholder="例如：習作本 3"
                                maxLength={120}
                            />
                        </label>

                        <label>
                            <span>分類</span>
                            <select value={category} onChange={event => setCategory(event.target.value)}>
                                {LINK_CATEGORIES.map(option => (
                                    <option value={option.value} key={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>

                        <label className="link-admin-page__url-field">
                            <span>網址</span>
                            <input
                                type="url"
                                value={url}
                                onChange={event => setUrl(event.target.value)}
                                placeholder="https://youtu.be/..."
                                inputMode="url"
                            />
                        </label>

                        <button type="submit" disabled={saving || loading}>
                            <BiPlus />
                            {saving ? "新增中..." : "新增連結"}
                        </button>
                    </form>

                    {message && <div className="link-admin-page__notice success">{message}</div>}
                    {error && <div className="link-admin-page__notice error">{error}</div>}
                </section>

                <section className="link-admin-page__panel link-admin-page__panel--list">
                    <div className="link-admin-page__list-heading">
                        <div>
                            <h2>目前連結</h2>
                            <p>資料來源：Supabase <code>public.links</code>。</p>
                        </div>
                        <span>{items.length} 筆</span>
                    </div>

                    {loading ? (
                        <div className="link-admin-page__empty">正在載入 Supabase links...</div>
                    ) : items.length === 0 ? (
                        <div className="link-admin-page__empty">目前沒有連結資料。</div>
                    ) : (
                        <div className="link-admin-page__list">
                            {items.map(item => (
                                <article className="link-admin-page__item" key={item.id}>
                                    {editingId === item.id ? (
                                        <div className="link-admin-page__edit-form">
                                            <label>
                                                <span>連結名稱</span>
                                                <input
                                                    aria-label="編輯連結名稱"
                                                    value={editTitle}
                                                    onChange={event => setEditTitle(event.target.value)}
                                                    maxLength={120}
                                                    disabled={updating}
                                                />
                                            </label>
                                            <label>
                                                <span>URL</span>
                                                <input
                                                    type="url"
                                                    aria-label="編輯連結網址"
                                                    value={editUrl}
                                                    onChange={event => setEditUrl(event.target.value)}
                                                    inputMode="url"
                                                    disabled={updating}
                                                />
                                            </label>
                                            <div className="link-admin-page__edit-actions">
                                                <button type="button" onClick={() => handleUpdate(item)} disabled={updating} aria-label={`儲存 ${item.title}`}>
                                                    <BiSave />
                                                    {updating ? "儲存中..." : "儲存"}
                                                </button>
                                                <button type="button" onClick={cancelEditing} disabled={updating} className="secondary" aria-label={`取消編輯 ${item.title}`}>
                                                    <BiX />
                                                    取消
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="link-admin-page__item-copy">
                                                <span>{getCategoryLabel(item.category)}</span>
                                                <strong>{item.title || "未命名連結"}</strong>
                                                <a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>
                                            </div>
                                            <div className="link-admin-page__item-actions">
                                                <button type="button" onClick={() => startEditing(item)} aria-label={`編輯 ${item.title}`}>
                                                    <BiEditAlt />
                                                </button>
                                                <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`開啟 ${item.title}`}>
                                                    <BiLinkExternal />
                                                </a>
                                                <button type="button" onClick={() => handleDelete(item)} aria-label={`刪除 ${item.title}`}>
                                                    <BiTrash />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export default LinkAdmin;
