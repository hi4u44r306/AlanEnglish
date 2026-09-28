import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    BiBookOpen,
    BiHeadphone,
    BiHomeAlt2,
    BiLogIn,
    BiPlayCircle,
    BiSearch
} from "react-icons/bi";
import Brand from "../fragment/Brand";
import SeoHead from "../fragment/SeoHead";
import { getPublicLinks } from "../../services/linkService";
import "./css/Links.scss";

const CATEGORY_CONFIG = [
    { key: "exercise", label: "習作本", description: "依課本與習作快速找到對應音檔", icon: BiBookOpen },
    { key: "listening", label: "聽力本", description: "集中練習聽力教材與課堂音檔", icon: BiHeadphone },
    { key: "speedphonics", label: "Speed Phonics", description: "自然發音與基礎拼讀練習", icon: BiPlayCircle }
];

const PUBLIC_CATEGORY_KEYS = new Set(CATEGORY_CONFIG.map(category => category.key));

function Links() {
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const loadLinks = async () => {
            try {
                setLoading(true);
                setError("");
                const nextItems = await getPublicLinks();
                if (!cancelled) setItems(nextItems);
            } catch (loadError) {
                console.error("Supabase Links 載入失敗:", loadError);
                if (!cancelled) {
                    setItems([]);
                    setError("連結暫時無法載入，請稍後再試。");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadLinks();
        return () => {
            cancelled = true;
        };
    }, []);

    const normalizedQuery = query.trim().toLowerCase();

    const visibleGroups = useMemo(() => CATEGORY_CONFIG.map(category => ({
        ...category,
        items: items.filter(item => {
            if (item.category !== category.key) return false;
            if (!normalizedQuery) return true;
            return String(item.title || "").toLowerCase().includes(normalizedQuery);
        })
    })).filter(category => category.items.length > 0), [items, normalizedQuery]);

    const visibleCount = visibleGroups.reduce((total, category) => total + category.items.length, 0);
    const hasPublicLinks = items.some(item => PUBLIC_CATEGORY_KEYS.has(item.category));

    return (
        <div className="links-page">
            <SeoHead path="/links" />

            <header className="links-page__header">
                <div className="links-page__shell links-page__nav">
                    <Link className="links-page__brand" to="/" aria-label="前往 Alan English 首頁">
                        <Brand />
                    </Link>
                    <div className="links-page__nav-actions">
                        <Link className="links-page__nav-link" to="/">
                            <BiHomeAlt2 />
                            <span>網站介紹</span>
                        </Link>
                        <Link className="links-page__login" to="/login">
                            <BiLogIn />
                            <span>學生登入</span>
                        </Link>
                    </div>
                </div>
            </header>

            <main>

                <section className="links-page__content">
                    <div className="links-page__shell">
                        <div className="links-page__toolbar">
                            <div>
                                <span className="links-page__section-kicker">QUICK ACCESS</span>
                                <h2>選擇教材</h2>
                            </div>
                            <label className="links-page__search">
                                <BiSearch aria-hidden="true" />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={event => setQuery(event.target.value)}
                                    placeholder="搜尋教材名稱"
                                    aria-label="搜尋教材名稱"
                                />
                                {query && (
                                    <button type="button" onClick={() => setQuery("")} aria-label="清除搜尋">
                                        ×
                                    </button>
                                )}
                            </label>
                        </div>

                        {loading && (
                            <div className="links-page__state">
                                <span className="links-page__loader" />
                                <strong>正在載入教材連結</strong>
                                <p>請稍候一下。</p>
                            </div>
                        )}

                        {!loading && error && (
                            <div className="links-page__state links-page__state--error">
                                <strong>目前無法取得連結</strong>
                                <p>{error}</p>
                            </div>
                        )}

                        {!loading && !error && !hasPublicLinks && (
                            <div className="links-page__state">
                                <strong>目前還沒有教材連結</strong>
                                <p>教材連結正在整理中，請稍後再回來查看。</p>
                            </div>
                        )}

                        {!loading && !error && hasPublicLinks && visibleCount === 0 && (
                            <div className="links-page__state">
                                <strong>找不到「{query}」</strong>
                                <p>換一個教材名稱或清除搜尋條件再試一次。</p>
                                <button type="button" onClick={() => setQuery("")}>清除搜尋</button>
                            </div>
                        )}

                        {!loading && !error && visibleGroups.length > 0 && (
                            <div className="links-page__groups">
                                {visibleGroups.map(group => {
                                    const Icon = group.icon;
                                    return (
                                        <section className={`links-page__group links-page__group--${group.key}`} key={group.key}>
                                            <div className="links-page__group-heading">
                                                <span className="links-page__group-icon"><Icon /></span>
                                                <div>
                                                    <div className="links-page__group-title-row">
                                                        <h3>{group.label}</h3>
                                                        <span>{group.items.length}</span>
                                                    </div>
                                                    <p>{group.description}</p>
                                                </div>
                                            </div>
                                            <div className="links-page__grid">
                                                {group.items.map(item => (
                                                    <a
                                                        className="links-page__card"
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        key={item.id}
                                                    >
                                                        <span className="links-page__card-copy">
                                                            <strong>{item.title}</strong>
                                                        </span>
                                                        <span className="links-page__card-arrow" aria-hidden="true">↗</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <footer className="links-page__footer">
                <div className="links-page__shell">
                    <span>© {new Date().getFullYear()} Alan English</span>
                    <Link to="/">了解 Alan English</Link>
                </div>
            </footer>
        </div>
    );
}

export default Links;
