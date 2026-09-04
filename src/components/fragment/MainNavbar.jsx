import React, { useEffect, useMemo, useRef, useState } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Offcanvas from 'react-bootstrap/Offcanvas';
import '../assets/scss/Navigation.scss';
import 'react-circular-progressbar/dist/styles.css';
import BlueBook from '../assets/img/blue book.png';
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiAward, FiBarChart2, FiBell, FiBookOpen, FiCreditCard, FiGift, FiHelpCircle, FiHome, FiLink, FiLock, FiLogOut, FiMessageCircle, FiMic, FiRefreshCw, FiSettings, FiShoppingBag, FiStar, FiTrendingUp, FiUpload, FiUsers, FiZap } from "react-icons/fi";
import { HiOutlineBars3 } from "react-icons/hi2";
import Brand from "./Brand";
import { useAuth } from "../../auth/AuthContext";
import { getRoleHome } from "../../auth/RoleHomeRedirect";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getGamificationSummary } from "../../services/gamificationService";
import { getStudentNotifications, markStudentNotificationRead } from "../../services/membershipService";
import { hasAiPremiumAccess } from "../../constants/membershipPlans";

const restoreDocumentScroll = () => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    window.requestAnimationFrame(() => {
        const activeBlockingLayer = document.querySelector('.modal.show, .offcanvas.show');
        if (activeBlockingLayer) return;
        document.documentElement.style.removeProperty('overflow');
        document.documentElement.style.removeProperty('padding-right');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
        document.body.classList.remove('modal-open');
    });
};

function MainNavbar() {
    const [scrolled, setScrolled] = useState(false);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [navError, setNavError] = useState(null);
    const [loggingOut, setLoggingOut] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [desktopMaterialsOpen, setDesktopMaterialsOpen] = useState(false);
    const mobileBodyRef = useRef(null);
    const [gamificationSummary, setGamificationSummary] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();
    const { firebaseUser, role, isAuthenticated, logout, studentProfile } = useAuth();
    const isTeacher = role === "teacher" || role === "admin";
    const isAdmin = role === "admin";
    const isStudent = role === "student";
    const effectiveAccess = studentProfile?.membership?.effective_access;
    const hasAiPremium = isStudent && hasAiPremiumAccess(effectiveAccess);
    const hasAiAccess = !isStudent || studentProfile?.membership?.effective_access?.features?.ai_materials === true;
    const hasPronunciationAccess = !isStudent
        || studentProfile?.membership?.effective_access?.features?.pronunciation === true
        || studentProfile?.membership?.effective_access?.features?.pronunciation_practice === true;
    const hasRewardsAccess = isStudent
        && studentProfile?.learner_type === "academy_student"
        && effectiveAccess?.plan_codes?.includes("academy_internal") === true;
    const accessibleStudentCategories = useMemo(() => categories
        .map(category => ({ ...category, books: (category.books || []).filter(book => !book.locked) }))
        .filter(category => category.books.length > 0), [categories]);
    const hasAccessibleStudentMaterials = isStudent && accessibleStudentCategories.length > 0;
    const homePath = isAuthenticated ? getRoleHome(role) : "/";
    const accountManagementPath = isAdmin ? "/admin/accounts" : "/teacher/accounts";
    const reportPath = isAdmin ? "/admin/reports" : "/teacher/reports";
    const leaderboardPath = isAdmin ? "/admin/leaderboard" : "/teacher/leaderboard";
    const gamificationBalance = gamificationSummary?.balance;
    const gamificationLevel = Math.max(1, Number(gamificationBalance?.level || 1));
    const totalXp = Math.max(0, Number(gamificationBalance?.total_xp || 0));
    const nextLevelXp = Math.max(totalXp, Number(gamificationBalance?.next_level_xp || 100));
    const xpToNextLevel = Math.max(0, nextLevelXp - totalXp);
    const xpProgressPercent = Math.min(100, Math.max(0, Number(gamificationBalance?.progress_percent || 0)));
    const unreadNotificationCount = notifications.filter(item => !item.read_at).length;

    const displayRole = useMemo(() => {
        if (isAdmin) return "Admin";
        if (isTeacher) return "Teacher";
        return "Student";
    }, [isAdmin, isTeacher]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 24);
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        setMobileOpen(false);
        setDesktopMaterialsOpen(false);
        const timer = window.setTimeout(() => restoreDocumentScroll(), 420);
        return () => window.clearTimeout(timer);
    }, [location.pathname]);

    useEffect(() => {
        if (!mobileOpen) return undefined;
        const timer = window.setTimeout(() => {
            const activeItem = mobileBodyRef.current?.querySelector("a.active, details.is-active");
            if (typeof activeItem?.scrollIntoView === "function") {
                activeItem.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 220);
        return () => window.clearTimeout(timer);
    }, [mobileOpen, location.pathname]);

    useEffect(() => () => restoreDocumentScroll(), []);

    useEffect(() => {
        if (!firebaseUser || !isStudent) {
            setGamificationSummary(null);
            return undefined;
        }
        let cancelled = false;
        const refreshGamification = () => {
            getGamificationSummary(firebaseUser)
                .then(result => {
                    if (!cancelled) setGamificationSummary(result || null);
                })
                .catch(() => {
                    if (!cancelled) setGamificationSummary(null);
                });
        };
        refreshGamification();
        window.addEventListener("ae:gamification-updated", refreshGamification);
        return () => {
            cancelled = true;
            window.removeEventListener("ae:gamification-updated", refreshGamification);
        };
    }, [firebaseUser, isStudent]);

    useEffect(() => {
        if (!firebaseUser || !isStudent) {
            setNotifications([]);
            return undefined;
        }
        let cancelled = false;
        getStudentNotifications(firebaseUser)
            .then(result => {
                if (!cancelled) setNotifications(result?.notifications || []);
            })
            .catch(() => {
                if (!cancelled) setNotifications([]);
            });
        return () => { cancelled = true; };
    }, [firebaseUser, isStudent]);

    useEffect(() => {
        if (!firebaseUser) {
            setCategories([]);
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        const fetchNavbarData = async () => {
            try {
                setLoading(true);
                setNavError(null);
                const result = await getAccessibleCatalog(firebaseUser);
                if (!cancelled) setCategories(result?.categories || []);
            } catch (error) {
                console.error("MainNavbar 載入失敗:", error);
                if (!cancelled) setNavError(error?.message || "教材載入失敗");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchNavbarData();
        return () => { cancelled = true; };
    }, [firebaseUser]);

    const closeMobileMenu = () => setMobileOpen(false);
    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        closeMobileMenu();
        try {
            await logout();
            navigate("/", { replace: true });
        } catch (error) {
            console.error("登出失敗:", error);
        } finally {
            setLoggingOut(false);
            restoreDocumentScroll();
        }
    };
    const openTour = () => {
        closeMobileMenu();
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("ae:open-tour")), 220);
    };
    const markNotificationRead = async notification => {
        if (!notification || notification.read_at || !firebaseUser) return;
        setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
        try {
            await markStudentNotificationRead(firebaseUser, notification.id);
        } catch (error) {
            setNotifications(current => current.map(item => item.id === notification.id ? notification : item));
        }
    };
    const isPathActive = path => location.pathname === path || (path !== "/" && location.pathname.startsWith(`${path}/`));
    const isMaterialCategoryActive = category => category.books?.some(book => isPathActive(`/student/books/${book.code}`));
    const renderStudentMaterialCategory = (category, variant) => {
        const categoryActive = isMaterialCategoryActive(category);
        const categoryClass = variant === "desktop" ? "ae-desktop-material-category" : "ae-mobile-category";
        const listClass = variant === "desktop" ? "ae-desktop-material-book-list" : "ae-mobile-book-list";
        return (
            <details className={`${categoryClass} ${categoryActive ? "is-active" : ""}`} key={`${variant}-${category.id}`} open={categoryActive || undefined}>
                <summary aria-label={`切換${category.name}，${category.books.length} 本教材`}>
                    <span><FiBookOpen />{category.name}</span>
                    <span className="ae-material-category-meta"><b>{category.books.length} 本</b><span className="ae-mobile-chevron">⌄</span></span>
                </summary>
                <div className={listClass}>{category.books.map(book => {
                    const bookPath = `/student/books/${book.code}`;
                    return <Link key={book.id || book.code} to={bookPath} onClick={variant === "desktop" ? () => setDesktopMaterialsOpen(false) : closeMobileMenu} className={`ae-dropdown-item ${isPathActive(bookPath) ? "active" : ""}`} aria-current={isPathActive(bookPath) ? "page" : undefined}>{variant === "desktop" && <img src={BlueBook} alt="" />}<span>{book.name}</span></Link>;
                })}</div>
            </details>
        );
    };
    const renderDesktopCategory = (category, index) => (
        <NavDropdown id={`desktop-category-${category.id}`} key={category.id} title={<span className="ae-nav-inline"><FiBookOpen />{category.name}</span>} className="ae-desktop-dropdown" data-tour={index === 0 ? "materials" : undefined} align="end">
            {category.books?.length > 0 ? category.books.map(book => <NavDropdown.Item key={book.id} as={Link} to={book.locked ? (book.acquisition || "/student/level") : `/student/books/${book.code}`} className={`ae-dropdown-item ${book.locked ? "is-locked" : ""}`}><img src={BlueBook} alt="" /><span>{book.name}</span>{book.locked && <FiLock aria-label="尚未解鎖" />}</NavDropdown.Item>) : <NavDropdown.Item disabled>尚無教材</NavDropdown.Item>}
        </NavDropdown>
    );
    const renderMobileCategories = () => {
        if (loading) return <div className="ae-mobile-status">教材載入中...</div>;
        if (navError) return <div className="ae-mobile-status error">{navError}</div>;
        return categories.map((category, index) => (
            <details className={`ae-mobile-category ${category.books?.some(book => !book.locked && isPathActive(`/student/books/${book.code}`)) ? "is-active" : ""}`} key={category.id} data-tour={index === 0 ? "materials" : undefined}>
                <summary><span><FiBookOpen />{category.name}</span><span className="ae-mobile-chevron">⌄</span></summary>
                <div className="ae-mobile-book-list">{category.books?.length > 0 ? category.books.map(book => <Link key={book.id} to={book.locked ? (book.acquisition || "/student/level") : `/student/books/${book.code}`} onClick={closeMobileMenu} className={book.locked ? "is-locked" : ""}><span>{book.name}</span>{book.locked && <FiLock aria-label="尚未解鎖" />}</Link>) : <span className="ae-mobile-empty">尚無教材</span>}</div>
            </details>
        ));
    };

    return (
        <>
            <Navbar className={`ae-navbar ${scrolled ? "scrolled" : ""}`}>
                <Container fluid className="ae-navbar-container">
                    <Navbar.Brand as={Link} to={homePath} className="ae-brand" data-tour="home"><Brand /></Navbar.Brand>
                    <Nav className={`ae-desktop-nav ${isStudent ? "is-student" : ""}`}>
                        {isAuthenticated && <Nav.Link as={Link} to={homePath} className={isPathActive(homePath) ? "active" : ""} data-tour="home"><span className="ae-nav-inline"><FiHome />{isTeacher ? "管理首頁" : "我的首頁"}</span></Nav.Link>}
                        {isStudent && <Nav.Link as={Link} to="/student/membership" className={isPathActive("/student/membership") ? "active" : ""}><span className="ae-nav-inline"><FiCreditCard />方案與功能</span></Nav.Link>}
                        {hasAccessibleStudentMaterials && <NavDropdown id="desktop-student-materials" title={<span className="ae-nav-inline"><FiBookOpen />我的教材</span>} className={`ae-desktop-dropdown ae-student-materials-dropdown ${accessibleStudentCategories.some(isMaterialCategoryActive) ? "is-active" : ""}`} align="end" data-tour="materials" show={desktopMaterialsOpen} onToggle={setDesktopMaterialsOpen} autoClose="outside"><div className="ae-materials-dropdown-heading"><strong>選擇教材分類</strong><span>共 {accessibleStudentCategories.reduce((total, category) => total + category.books.length, 0)} 本</span></div>{accessibleStudentCategories.map(category => renderStudentMaterialCategory(category, "desktop"))}</NavDropdown>}
                        {isAuthenticated && <Nav.Link as={Link} to="/student/conversation" className={isPathActive("/student/conversation") ? "active" : ""} data-tour="conversation"><span className="ae-nav-inline"><FiMessageCircle />{isTeacher ? "英文對話示範" : "英文對話"}</span></Nav.Link>}
                        {isAuthenticated && hasPronunciationAccess && <Nav.Link as={Link} to="/student/pronunciation" className={isPathActive("/student/pronunciation") ? "active" : ""}><span className="ae-nav-inline"><FiMic />{isTeacher ? "發音教練示範" : "發音教練"}</span></Nav.Link>}
                        {isAuthenticated && <Nav.Link as={Link} to="/student/ai-generator" className={isPathActive("/student/ai-generator") ? "active" : ""}><span className="ae-nav-inline"><FiStar />{hasAiAccess ? "AI 教材" : "AI 教材與發音方案"}</span></Nav.Link>}
                        {isStudent && <button type="button" className="ae-desktop-all-functions" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-controls="main-navigation-drawer"><HiOutlineBars3 aria-hidden="true" /><span>全部功能</span></button>}
                        {!isStudent && (loading ? <Nav.Link disabled>教材載入中...</Nav.Link> : navError ? <Nav.Link disabled>教材載入失敗</Nav.Link> : categories.map(renderDesktopCategory))}
                        {isTeacher && <NavDropdown id="desktop-account-management" title={<span className="ae-nav-inline"><FiUsers />管理</span>} className="ae-desktop-dropdown" align="end" data-tour="accounts"><NavDropdown.Item as={Link} to={reportPath} className="ae-dropdown-item"><FiBarChart2 />每週學習報告</NavDropdown.Item><NavDropdown.Item as={Link} to={leaderboardPath} className="ae-dropdown-item"><FiTrendingUp />班級排行榜</NavDropdown.Item><NavDropdown.Item as={Link} to={accountManagementPath} className="ae-dropdown-item"><FiUsers />帳號管理</NavDropdown.Item><NavDropdown.Item as={Link} to="/teacher/accounts/create" className="ae-dropdown-item"><FiUsers />建立單一學生</NavDropdown.Item><NavDropdown.Item as={Link} to="/teacher/class-materials" className="ae-dropdown-item"><FiBookOpen />班級教材設定</NavDropdown.Item>{isAdmin && <NavDropdown.Item as={Link} to="/admin/accounts/import" className="ae-dropdown-item"><FiUpload />CSV 批次建立</NavDropdown.Item>}</NavDropdown>}
                        {isTeacher && <NavDropdown id="desktop-music-management" title={<span className="ae-nav-inline"><FiBookOpen />音檔</span>} className="ae-desktop-dropdown" align="end"><NavDropdown.Item as={Link} to="/teacher/music/manage" className="ae-dropdown-item"><FiSettings />音檔管理</NavDropdown.Item>{isAdmin && <NavDropdown.Item as={Link} to="/admin/links" className="ae-dropdown-item"><FiLink />新增連結</NavDropdown.Item>}</NavDropdown>}
                        {isAdmin && <NavDropdown id="desktop-system-tools" title={<span className="ae-nav-inline"><FiSettings />系統</span>} className="ae-desktop-dropdown" align="end"><NavDropdown.Item as={Link} to="/admin/rewards" className="ae-dropdown-item"><FiGift />獎品與兌換管理</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/membership" className="ae-dropdown-item"><FiCreditCard />會員與啟用碼</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/material-packages" className="ae-dropdown-item"><FiBookOpen />教材商品包</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/store-orders" className="ae-dropdown-item"><FiCreditCard />商城訂單與出貨</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/student-lifecycle" className="ae-dropdown-item"><FiUsers />在校／離校管理</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/speaking-content" className="ae-dropdown-item"><FiBookOpen />教材 AI 口說題庫</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/support" className="ae-dropdown-item"><FiHelpCircle />客服案件</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/api-usage" className="ae-dropdown-item"><FiBarChart2 />API 成本</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/levels" className="ae-dropdown-item"><FiAward />等級與晉級測驗</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/catalog" className="ae-dropdown-item"><FiBookOpen />教材導覽管理</NavDropdown.Item></NavDropdown>}
                        {!isStudent && <button type="button" className="ae-desktop-help" onClick={openTour} data-tour="help"><FiHelpCircle />使用教學</button>}
                        {isStudent && <NavDropdown id="desktop-notifications" title={<span className="ae-notification-trigger"><FiBell aria-hidden="true" />{unreadNotificationCount > 0 && <b>{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</b>}</span>} className="ae-notification-dropdown" align="end"><div className="ae-notification-heading"><strong>通知</strong><span>{unreadNotificationCount > 0 ? `${unreadNotificationCount} 則未讀` : "已讀取最新消息"}</span></div>{notifications.length === 0 ? <div className="ae-notification-empty">目前沒有新通知</div> : notifications.slice(0, 4).map(notification => <NavDropdown.Item as="button" type="button" key={notification.id} onClick={() => markNotificationRead(notification)} className={`ae-notification-item ${notification.read_at ? "is-read" : ""}`}><FiBell /><span><strong>{notification.title}</strong><small>{notification.body}</small></span></NavDropdown.Item>)}<NavDropdown.Divider /><NavDropdown.Item as={Link} to="/student/notifications" className="ae-dropdown-item"><FiBell />查看全部通知</NavDropdown.Item></NavDropdown>}
                        {isAuthenticated && <NavDropdown id="desktop-user-menu" title={<span className="ae-user-chip"><span className="ae-user-chip-avatar">{studentProfile?.name?.slice(0, 1) || "A"}</span><span className="ae-user-chip-name">{studentProfile?.name || displayRole}</span>{hasAiPremium && <span className="ae-ai-premium-badge" title="AI Premium｜AI 教材與發音練習已啟用"><FiZap aria-hidden="true" />AI Premium</span>}</span>} className="ae-user-dropdown" align="end"><NavDropdown.Item as={Link} to={homePath} className="ae-dropdown-item"><FiHome />{isTeacher ? "管理首頁" : "我的首頁"}</NavDropdown.Item>{isStudent && <NavDropdown.Item as={Link} to="/student/settings" className="ae-dropdown-item"><FiSettings />我的設定</NavDropdown.Item>}<NavDropdown.Item as={Link} to="/shop" className="ae-dropdown-item"><FiShoppingBag />實體教材商城</NavDropdown.Item><NavDropdown.Item as={Link} to="/account/security" className="ae-dropdown-item"><FiLock />帳號與密碼</NavDropdown.Item><NavDropdown.Item as={Link} to="/support" className="ae-dropdown-item"><FiHelpCircle />聯絡客服</NavDropdown.Item><NavDropdown.Item as="button" onClick={handleLogout} disabled={loggingOut} className="ae-dropdown-item"><FiLogOut />{loggingOut ? "登出中..." : "登出"}</NavDropdown.Item></NavDropdown>}
                    </Nav>
                    <div className="ae-mobile-actions">
                        {isStudent && <Link to="/student/notifications" className="ae-mobile-notification" aria-label={unreadNotificationCount > 0 ? `查看通知，目前有 ${unreadNotificationCount} 則未讀` : "查看通知"}><FiBell aria-hidden="true" />{unreadNotificationCount > 0 && <b>{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</b>}</Link>}
                        <button type="button" className="ae-mobile-toggle" onClick={() => setMobileOpen(true)} aria-label="開啟全部功能選單" aria-expanded={mobileOpen} aria-controls="main-navigation-drawer"><HiOutlineBars3 aria-hidden="true" /></button>
                    </div>
                </Container>
            </Navbar>
            <Offcanvas id="main-navigation-drawer" show={mobileOpen} onHide={closeMobileMenu} onExited={restoreDocumentScroll} placement="end" className="ae-mobile-offcanvas" backdrop scroll={false}>
                <Offcanvas.Header closeButton>
                    <div className="ae-mobile-brand">
                        <span className="ae-mobile-brand-mark">AE</span>
                        <div className="ae-mobile-brand-copy">
                            <strong>ALAN ENGLISH</strong>
                            <small>{isAdmin ? "ADMIN CONSOLE" : isTeacher ? "TEACHER SPACE" : "STUDENT SPACE"}</small>
                        </div>
                    </div>
                </Offcanvas.Header>
                <Offcanvas.Body ref={mobileBodyRef}>
                    {isAuthenticated && <div className={`ae-mobile-profile ${hasAiPremium ? "has-ai-premium" : ""}`}><div className="ae-mobile-avatar">{studentProfile?.name?.slice(0, 1) || "A"}</div><div><strong>{studentProfile?.name || "Alan English User"}</strong><span>{displayRole}{studentProfile?.class ? ` · ${studentProfile.class} 班` : ""}</span>{hasAiPremium && <span className="ae-ai-premium-badge"><FiZap aria-hidden="true" />AI Premium</span>}</div></div>}
                    {isStudent && <section className="ae-mobile-xp-card" aria-label="學習榮譽進度"><div className="ae-mobile-xp-heading"><span><FiZap aria-hidden="true" />學習榮譽</span><strong>Lv.{gamificationLevel}</strong></div><div className="ae-mobile-xp-track" role="progressbar" aria-label={`目前等級 Lv.${gamificationLevel} 的經驗值進度`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={xpProgressPercent}><span style={{ width: `${xpProgressPercent}%` }} /></div><div className="ae-mobile-xp-meta"><span>目前等級 Lv.{gamificationLevel}</span><strong>{totalXp.toLocaleString("zh-TW")} XP</strong></div><p>距離 Lv.{gamificationLevel + 1} 還差 {xpToNextLevel.toLocaleString("zh-TW")} XP</p></section>}
                    <section className="ae-mobile-section"><span className="ae-mobile-section-title">{isStudent ? "開始學習" : "主要功能"}</span><Link to={homePath} onClick={closeMobileMenu} className={isPathActive(homePath) ? "active" : ""} data-tour="home"><FiHome /><span>{isTeacher ? "管理首頁" : "我的首頁"}</span></Link>{isStudent && <Link to="/student/membership" onClick={closeMobileMenu} className={isPathActive("/student/membership") ? "active" : ""}><FiCreditCard /><span>方案與功能</span></Link>}<Link to="/student/conversation" onClick={closeMobileMenu} className={isPathActive("/student/conversation") ? "active" : ""} data-tour="conversation"><FiMessageCircle /><span>{isTeacher ? "英文對話示範" : "英文對話"}</span></Link>{isAuthenticated && hasPronunciationAccess && <Link to="/student/pronunciation" onClick={closeMobileMenu} className={isPathActive("/student/pronunciation") ? "active" : ""}><FiMic /><span>{isTeacher ? "發音教練示範" : "發音教練"}</span></Link>}{isAuthenticated && <Link to="/student/ai-generator" onClick={closeMobileMenu} className={isPathActive("/student/ai-generator") ? "active" : ""}><FiStar /><span>{hasAiAccess ? "AI 教材" : "AI 教材與發音方案"}</span></Link>}</section>
                    {hasAccessibleStudentMaterials && <section className="ae-mobile-section ae-mobile-materials"><span className="ae-mobile-section-title">我的教材 · 共 {accessibleStudentCategories.reduce((total, category) => total + category.books.length, 0)} 本</span>{accessibleStudentCategories.map(category => renderStudentMaterialCategory(category, "mobile"))}</section>}
                    {isStudent && <section className="ae-mobile-section"><span className="ae-mobile-section-title">學習成果</span><Link to="/student/review" onClick={closeMobileMenu} className={isPathActive("/student/review") ? "active" : ""}><FiRefreshCw /><span>智慧複習</span></Link><Link to="/student/weekly-report" onClick={closeMobileMenu} className={isPathActive("/student/weekly-report") ? "active" : ""}><FiBarChart2 /><span>每週報告</span></Link><Link to="/student/level" onClick={closeMobileMenu} className={isPathActive("/student/level") ? "active" : ""}><FiAward /><span>等級晉級</span></Link><Link to="/student/leaderboard" onClick={closeMobileMenu} className={isPathActive("/student/leaderboard") ? "active" : ""}><FiTrendingUp /><span>學習排行榜</span></Link>{hasRewardsAccess && <Link to="/student/rewards" onClick={closeMobileMenu} className={isPathActive("/student/rewards") ? "active" : ""}><FiGift /><span>獎品商城</span></Link>}</section>}
                    {!isStudent && <section className="ae-mobile-section"><span className="ae-mobile-section-title">教材</span>{renderMobileCategories()}</section>}
                    {isTeacher && <section className="ae-mobile-section" data-tour="accounts"><span className="ae-mobile-section-title">管理</span><Link to={reportPath} onClick={closeMobileMenu}><FiBarChart2 /><span>每週學習報告</span></Link><Link to={leaderboardPath} onClick={closeMobileMenu}><FiTrendingUp /><span>班級排行榜</span></Link><Link to={accountManagementPath} onClick={closeMobileMenu}><FiUsers /><span>帳號管理</span></Link><Link to="/teacher/accounts/create" onClick={closeMobileMenu}><FiUsers /><span>建立單一學生</span></Link><Link to="/teacher/class-materials" onClick={closeMobileMenu}><FiBookOpen /><span>班級教材設定</span></Link>{isAdmin && <Link to="/admin/accounts/import" onClick={closeMobileMenu}><FiUpload /><span>CSV 批次建立</span></Link>}</section>}
                    {isTeacher && <section className="ae-mobile-section"><span className="ae-mobile-section-title">音檔</span><Link to="/teacher/music/manage" onClick={closeMobileMenu}><FiSettings /><span>音檔管理</span></Link>{isAdmin && <Link to="/admin/links" onClick={closeMobileMenu}><FiLink /><span>新增連結</span></Link>}</section>}
                    {isAdmin && <section className="ae-mobile-section"><span className="ae-mobile-section-title">系統</span><Link to="/admin/rewards" onClick={closeMobileMenu}><FiGift /><span>獎品與兌換管理</span></Link><Link to="/admin/membership" onClick={closeMobileMenu}><FiCreditCard /><span>會員與啟用碼</span></Link><Link to="/admin/material-packages" onClick={closeMobileMenu}><FiBookOpen /><span>教材商品包</span></Link><Link to="/admin/store-orders" onClick={closeMobileMenu}><FiCreditCard /><span>商城訂單與出貨</span></Link><Link to="/admin/student-lifecycle" onClick={closeMobileMenu}><FiUsers /><span>在校／離校管理</span></Link><Link to="/admin/speaking-content" onClick={closeMobileMenu}><FiBookOpen /><span>教材 AI 口說題庫</span></Link><Link to="/admin/support" onClick={closeMobileMenu}><FiHelpCircle /><span>客服案件</span></Link><Link to="/admin/api-usage" onClick={closeMobileMenu}><FiBarChart2 /><span>API 成本</span></Link><Link to="/admin/levels" onClick={closeMobileMenu}><FiAward /><span>等級與晉級測驗</span></Link><Link to="/admin/catalog" onClick={closeMobileMenu}><FiBookOpen /><span>教材導覽管理</span></Link></section>}
                    <section className="ae-mobile-section ae-mobile-other"><span className="ae-mobile-section-title">其他</span><button type="button" onClick={openTour} data-tour="help"><FiHelpCircle /><span>使用教學</span></button>{isStudent && <Link to="/student/settings" onClick={closeMobileMenu}><FiSettings /><span>我的設定</span></Link>}{isAuthenticated && <Link to="/account/security" onClick={closeMobileMenu}><FiLock /><span>帳號與密碼</span></Link>}<Link to="/shop" onClick={closeMobileMenu}><FiShoppingBag /><span>實體教材商城</span></Link><Link to="/support" onClick={closeMobileMenu}><FiHelpCircle /><span>聯絡客服</span></Link><Link to="/showcase" onClick={closeMobileMenu}><FiBookOpen /><span>關於 AE</span></Link></section>
                    {isAuthenticated && <button type="button" className="ae-mobile-logout" onClick={handleLogout} disabled={loggingOut}><FiLogOut /><span>{loggingOut ? "登出中..." : "登出"}</span></button>}
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
}

export default MainNavbar;
