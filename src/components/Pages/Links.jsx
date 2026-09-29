import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    BiBookOpen,
    BiHeadphone,
    BiHomeAlt2,
    BiLogIn,
    BiPlayCircle
} from "react-icons/bi";
import Brand from "../fragment/Brand";
import SeoHead from "../fragment/SeoHead";
import { getPublicLinks } from "../../services/linkService";
import "./css/Links.scss";

const CATEGORY_CONFIG = [
    { key: "basicreading", label: "Basic Reading", description: "", icon: BiHeadphone },
    { key: "exercise", label: "習作本", description: "依課本與習作快速找到對應音檔", icon: BiBookOpen },
    { key: "listening", label: "聽力本", description: "集中練習聽力教材與課堂音檔", icon: BiHeadphone },
    { key: "speedphonics", label: "Speed Phonics", description: "自然發音與基礎拼讀練習", icon: BiPlayCircle }
];

const BASIC_READING_LEVELS = ["400", "800", "1200"];

const PUBLIC_CATEGORY_KEYS = new Set(CATEGORY_CONFIG.map(category => category.key));

function Links() {
    const [items, setItems] = useState([]);
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

    const visibleGroups = useMemo(() => CATEGORY_CONFIG.map(category => ({
        ...category,
        items: category.key === "basicreading"
            ? [{ id: "basic-reading-navigation" }]
            : items.filter(item => item.category === category.key)
    })).filter(category => category.items.length > 0), [items]);

    const hasPublicLinks = visibleGroups.some(group => PUBLIC_CATEGORY_KEYS.has(group.key));

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
                        {loading && (
                            <div className="links-page__state">
                                <span className="links-page__loader" />
                                <strong>正在載入教材連結</strong>
                                <p>請稍候一下。</p>
                            </div>
                        )}

                        {!loading && error && visibleGroups.length === 0 && (
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

                        {visibleGroups.length > 0 && (
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
                                                        {group.key !== "basicreading" && <span>{group.items.length}</span>}
                                                    </div>
                                                    {group.description && <p>{group.description}</p>}
                                                </div>
                                            </div>
                                            {group.key === "basicreading" ? (
                                                <div className="links-page__basic-reading">
                                                    <div className="links-page__basic-levels" aria-label="選擇 Basic Reading 程度">
                                                        {BASIC_READING_LEVELS.map(level => (
                                                            <Link
                                                                className="links-page__card links-page__basic-level-link"
                                                                to={`/basic-reading/${level}`}
                                                                aria-label={`Basic Reading ${level}`}
                                                                key={level}
                                                            >
                                                                <span className="links-page__card-copy"><strong>{level}</strong></span>
                                                                <span className="links-page__card-arrow" aria-hidden="true">→</span>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="links-page__grid">
                                                    {group.items.map(item => {
                                                        const content = (
                                                            <>
                                                                <span className="links-page__card-copy">
                                                                    <strong>{item.title}</strong>
                                                                </span>
                                                                <span className="links-page__card-arrow" aria-hidden="true">{item.internal ? "→" : "↗"}</span>
                                                            </>
                                                        );

                                                        return item.internal ? (
                                                            <Link className="links-page__card" to={item.url} key={item.id}>
                                                                {content}
                                                            </Link>
                                                        ) : (
                                                            <a
                                                                className="links-page__card"
                                                                href={item.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                key={item.id}
                                                            >
                                                                {content}
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            )}
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
