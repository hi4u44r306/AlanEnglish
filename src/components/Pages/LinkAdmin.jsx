import React, { useEffect, useMemo, useState } from "react";
import { onValue, push, ref, remove } from "firebase/database";
import { BiLinkExternal, BiPlus, BiTrash } from "react-icons/bi";
import { rtdb } from "./firebase-config";
import "./css/LinkAdmin.scss";

const CATEGORY_OPTIONS = [
    { value: "special", label: "Special" },
    { value: "exercise", label: "習作本" },
    { value: "listening", label: "聽力本" },
    { value: "discovery", label: "Discovery" },
    { value: "speedphonics", label: "Speed Phonics" }
];

const getLegacyCategory = item => {
    const explicitCategory = String(item?.category || "").trim().toLowerCase();
    if (CATEGORY_OPTIONS.some(option => option.value === explicitCategory)) return explicitCategory;

    const title = String(item?.title || "").trim().toLowerCase();
    if (title.includes("習作本")) return "exercise";
    if (title.includes("聽力本")) return "listening";
    if (title.includes("discovery")) return "discovery";
    if (title.includes("speed phonics") || title.includes("speedphonics")) return "speedphonics";
    return "special";
};

const isValidHttpUrl = value => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
};

function LinkAdmin() {
    const [title, setTitle] = useState("");
    const [url, setUrl] = useState("");
    const [category, setCategory] = useState("exercise");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const linksRef = ref(rtdb, "links");
        const unsubscribe = onValue(
            linksRef,
            snapshot => {
                const nextItems = Object.entries(snapshot.val() || {})
                    .map(([id, item]) => ({
                        id,
                        title: String(item?.title || "").trim(),
                        url: String(item?.url || "").trim(),
                        category: getLegacyCategory(item)
                    }))
                    .filter(item => item.title || item.url)
                    .sort((a, b) => a.title.localeCompare(b.title, "zh-Hant", { numeric: true, sensitivity: "base" }));
                setItems(nextItems);
                setLoading(false);
            },
            firebaseError => {
                console.error("Links 後台載入失敗:", firebaseError);
                setError("無法讀取 Firebase links 資料。請確認 Realtime Database 權限設定。");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const groupedCount = useMemo(() => CATEGORY_OPTIONS.reduce((result, option) => {
        result[option.value] = items.filter(item => item.category === option.value).length;
        return result;
    }, {}), [items]);

    const clearNotice = () => {
        setMessage("");
        setError("");
    };

    const handleSubmit = async event => {
        event.preventDefault();
        if (saving) return;
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
            await push(ref(rtdb, "links"), {
                title: cleanTitle,
                url: cleanUrl,
                category,
                createdAt: Date.now()
            });
            setTitle("");
            setUrl("");
            setMessage("連結已新增。首頁會立即同步顯示。");
        } catch (submitError) {
            console.error("新增連結失敗:", submitError);
            setError("新增失敗，請確認 Firebase Realtime Database 寫入權限。");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async item => {
        const confirmed = window.confirm(`確定要刪除「${item.title || "未命名連結"}」嗎？`);
        if (!confirmed) return;

        clearNotice();
        try {
            await remove(ref(rtdb, `links/${item.id}`));
            setMessage(`已刪除「${item.title || "未命名連結"}」。`);
        } catch (deleteError) {
            console.error("刪除連結失敗:", deleteError);
            setError("刪除失敗，請確認 Firebase Realtime Database 寫入權限。");
        }
    };

    const getCategoryLabel = value => CATEGORY_OPTIONS.find(option => option.value === value)?.label || "Special";

    return (
        <div className="link-admin-page">
            <div className="link-admin-page__header">
                <div>
                    <span className="link-admin-page__kicker">PUBLIC LINKS</span>
                    <h1>教材連結管理</h1>
                    <p>管理首頁教材快捷連結。舊 Firebase 資料可以直接沿用，不需要重新輸入。</p>
                </div>
                <a href="/" target="_blank" rel="noopener noreferrer" className="link-admin-page__preview">
                    <BiLinkExternal />
                    查看公開頁面
                </a>
            </div>

            <div className="link-admin-page__stats">
                <article><span>全部連結</span><strong>{items.length}</strong></article>
                {CATEGORY_OPTIONS.map(option => (
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
                            <p>新資料會多存一個 category 欄位；舊資料仍會依名稱自動分類。</p>
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
                                maxLength={100}
                            />
                        </label>

                        <label>
                            <span>分類</span>
                            <select value={category} onChange={event => setCategory(event.target.value)}>
                                {CATEGORY_OPTIONS.map(option => (
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

                        <button type="submit" disabled={saving}>
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
                            <p>直接讀取 Firebase Realtime Database 的 <code>links</code> 節點。</p>
                        </div>
                        <span>{items.length} 筆</span>
                    </div>

                    {loading ? (
                        <div className="link-admin-page__empty">正在載入...</div>
                    ) : items.length === 0 ? (
                        <div className="link-admin-page__empty">目前沒有連結資料。</div>
                    ) : (
                        <div className="link-admin-page__list">
                            {items.map(item => (
                                <article className="link-admin-page__item" key={item.id}>
                                    <div className="link-admin-page__item-copy">
                                        <span>{getCategoryLabel(item.category)}</span>
                                        <strong>{item.title || "未命名連結"}</strong>
                                        <a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>
                                    </div>
                                    <div className="link-admin-page__item-actions">
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`開啟 ${item.title}`}>
                                            <BiLinkExternal />
                                        </a>
                                        <button type="button" onClick={() => handleDelete(item)} aria-label={`刪除 ${item.title}`}>
                                            <BiTrash />
                                        </button>
                                    </div>
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
