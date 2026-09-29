import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiBookOpen, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { BASIC_READING_LEVELS, getBasicReadingBookMeta } from "../../constants/basicReadingCatalog";

const materialPath = book => book.path || `/student/books/${book.code}`;

function MaterialsNavigator({ categories = [], loading, navError, onNavigate, resetToken = 0, variant = "desktop" }) {
    const location = useLocation();
    const [view, setView] = useState("root");
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [selectedBasicReadingLevel, setSelectedBasicReadingLevel] = useState(null);
    const [direction, setDirection] = useState("forward");
    const basicReadingCategory = categories.find(category => category.navigationType === "basic-reading");
    const selectedCategory = categories.find(category => String(category.id) === String(selectedCategoryId));
    const materialCount = categories.reduce((total, category) => total + (category.books?.length || 0), 0);
    const availableBasicReadingLevels = useMemo(() => BASIC_READING_LEVELS.filter(level => (
        basicReadingCategory?.books.some(book => getBasicReadingBookMeta(book)?.level === level)
    )), [basicReadingCategory]);

    useEffect(() => {
        setView("root");
        setSelectedCategoryId(null);
        setSelectedBasicReadingLevel(null);
        setDirection("forward");
    }, [resetToken]);

    if (loading) return <div className="ae-student-menu-status">教材載入中...</div>;
    if (navError) return <div className="ae-student-menu-status error">教材暫時無法載入</div>;
    if (!materialCount) return <div className="ae-student-menu-status">目前沒有可使用的教材</div>;

    const animationClass = direction === "back" ? "is-back" : "is-forward";
    const openCategory = category => {
        setDirection("forward");
        setSelectedCategoryId(category.id);
        setView(category.navigationType === "basic-reading" ? "levels" : "category-books");
    };
    const goBack = () => {
        setDirection("back");
        if (view === "basic-books") {
            setView("levels");
            return;
        }
        setSelectedCategoryId(null);
        setSelectedBasicReadingLevel(null);
        setView("root");
    };
    const isActive = destination => location.pathname === destination || location.pathname.startsWith(`${destination}/`);
    const bookLink = (book, label, detail = "開啟播放清單") => {
        const destination = materialPath(book);
        return (
            <Link
                key={book.id || book.code}
                to={destination}
                onClick={() => onNavigate?.(destination)}
                className={isActive(destination) ? "active" : ""}
                aria-current={isActive(destination) ? "page" : undefined}
            >
                <span><strong>{label}</strong><small>{detail}</small></span><FiChevronRight />
            </Link>
        );
    };

    if (view === "levels" && basicReadingCategory) {
        return (
            <div className={`ae-student-materials-panel ${animationClass}`} key={`${variant}-basic-levels`}>
                <button type="button" className="ae-student-materials-back" onClick={goBack}><FiChevronLeft />全部教材</button>
                <div className="ae-student-materials-heading"><strong>Basic Reading</strong><small>選擇程度</small></div>
                <div className="ae-student-materials-choice-grid" aria-label="選擇 Basic Reading 程度">
                    {availableBasicReadingLevels.map(level => (
                        <button type="button" key={level} onClick={() => { setDirection("forward"); setSelectedBasicReadingLevel(level); setView("basic-books"); }}>
                            <span><strong>{level}</strong><small>3 冊聽力</small></span><FiChevronRight />
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (view === "basic-books" && basicReadingCategory) {
        const books = basicReadingCategory.books.filter(book => getBasicReadingBookMeta(book)?.level === selectedBasicReadingLevel);
        return (
            <div className={`ae-student-materials-panel ${animationClass}`} key={`${variant}-basic-${selectedBasicReadingLevel}`}>
                <button type="button" className="ae-student-materials-back" onClick={goBack}><FiChevronLeft />選擇程度</button>
                <div className="ae-student-materials-heading"><strong>Basic Reading {selectedBasicReadingLevel}</strong><small>選擇冊別</small></div>
                <div className="ae-student-materials-choice-grid" aria-label={`選擇 Basic Reading ${selectedBasicReadingLevel} 冊別`}>
                    {books.map(book => bookLink(book, `第 ${getBasicReadingBookMeta(book).bookNumber} 冊`))}
                </div>
            </div>
        );
    }

    if (view === "category-books" && selectedCategory) {
        return (
            <div className={`ae-student-materials-panel ${animationClass}`} key={`${variant}-${selectedCategory.id}-books`}>
                <button type="button" className="ae-student-materials-back" onClick={goBack}><FiChevronLeft />全部教材</button>
                <div className="ae-student-materials-heading"><strong>{selectedCategory.name}</strong><small>選擇冊別</small></div>
                <div className="ae-student-materials-choice-grid" aria-label={`選擇${selectedCategory.name}教材`}>
                    {selectedCategory.books.map(book => bookLink(book, book.name))}
                </div>
            </div>
        );
    }

    return (
        <div className={`ae-student-materials-panel ${animationClass}`} key={`${variant}-materials-root`}>
            <div className="ae-student-materials-root-grid" aria-label="選擇教材分類">
                {categories.map(category => (
                    <button
                        type="button"
                        className="ae-student-material-entry"
                        key={category.id}
                        onClick={() => openCategory(category)}
                        aria-label={`開啟${category.name}，${category.books.length} 本教材`}
                    >
                        <span className="ae-student-basic-reading-icon"><FiBookOpen /></span>
                        <span>
                            <strong>{category.name}</strong>
                            <small>{category.navigationType === "basic-reading" ? "400 · 800 · 1200" : `${category.books.length} 本教材`}</small>
                        </span>
                        <FiChevronRight />
                    </button>
                ))}
            </div>
        </div>
    );
}

export default MaterialsNavigator;
