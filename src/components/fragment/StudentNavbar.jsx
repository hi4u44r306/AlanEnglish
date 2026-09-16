import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import Offcanvas from "react-bootstrap/Offcanvas";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    FiBarChart2,
    FiBell,
    FiBookOpen,
    FiCreditCard,
    FiGift,
    FiHelpCircle,
    FiLock,
    FiLogOut,
    FiMenu,
    FiMic,
    FiRefreshCw,
    FiSettings,
    FiStar,
    FiTrendingUp,
    FiZap
} from "react-icons/fi";
import Brand from "./Brand";
import { getStudentAvatarDisplayUrl } from "../../constants/defaultStudentAvatars";
import { prefetchReviewDashboard } from "../../services/reviewService";
import "../assets/scss/StudentNavbar.scss";

const InstantDrawerLink = ({ onNavigate, onClick, to, ...props }) => {
    const navigate = useNavigate();

    const handleClick = event => {
        onClick?.(event);
        const isNonPrimaryClick = typeof event.button === "number" && event.button !== 0;
        if (event.defaultPrevented || isNonPrimaryClick || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;

        event.preventDefault();
        // Touch-generated clicks may not expose event.button. Always keep ordinary
        // taps inside React Router so AuthProvider is not remounted by a document load.
        onNavigate?.();
        navigate(to);
    };

    return <Link {...props} to={to} onClick={handleClick} />;
};

const StudentNavbar = ({
    categories,
    firebaseUser,
    gamificationLevel,
    hasAiAccess,
    hasAiPremium,
    hasPronunciationAccess,
    hasRewardsAccess,
    loading,
    loggingOut,
    navError,
    notifications,
    onLogout,
    onNotificationRead,
    onOpenTour,
    profile,
    scrolled,
    totalXp,
    xpProgressPercent,
    xpToNextLevel
}) => {
    const location = useLocation();
    const [drawer, setDrawer] = useState("");
    const [materialsOpen, setMaterialsOpen] = useState(false);
    const accessibleCategories = categories || [];
    const materialCount = accessibleCategories.reduce((total, category) => total + category.books.length, 0);
    const hasMaterials = materialCount > 0;
    // Keep the student-facing entry stable while the entitlement catalog is loading.
    // It only reveals the loading state, never material names or links before access is known.
    const shouldShowMaterials = loading || hasMaterials || Boolean(navError);
    const hasActiveLearningAccess = profile?.membership?.is_active === true;
    const features = profile?.membership?.effective_access?.features || {};
    const hasAssignmentsAccess = hasActiveLearningAccess && features.assignments === true;
    const hasReviewAccess = hasActiveLearningAccess && features.review === true;
    const unreadCount = notifications.filter(item => !item.read_at).length;
    const isPathActive = path => location.pathname === path || location.pathname.startsWith(`${path}/`);
    const speakingActive = isPathActive("/student/pronunciation") || isPathActive("/student/speaking-challenges");
    const learningActive = [
        "/student/assignments",
        "/student/review",
        "/student/weekly-report",
        "/student/rewards",
        "/student/ai-generator"
    ].some(isPathActive);
    const avatarUrl = profile?.avatar_url ? getStudentAvatarDisplayUrl(profile.avatar_url, 96) : "";
    const profileName = profile?.name || "Alan English 學生";
    const profileInitial = profileName.slice(0, 1) || "A";
    const profileAvatar = avatarUrl
        ? <img src={avatarUrl} alt="" />
        : <span>{profileInitial}</span>;

    const warmReviewExperience = useCallback(() => {
        if (!firebaseUser || !hasReviewAccess) return;
        prefetchReviewDashboard(firebaseUser);
        import("../Pages/ReviewCenter").catch(() => {});
    }, [firebaseUser, hasReviewAccess]);
    const openDrawer = useCallback(view => {
        setDrawer(view);
        if (view === "menu") warmReviewExperience();
    }, [warmReviewExperience]);
    const closeDrawer = () => {
        setDrawer("");
        setMaterialsOpen(false);
    };

    useEffect(() => {
        const handleMenuRequest = event => {
            const requestedMenu = ["materials", "speaking", "menu"].includes(event.detail)
                ? event.detail
                : "menu";
            openDrawer(requestedMenu);
        };
        window.addEventListener("ae:open-student-menu", handleMenuRequest);
        return () => window.removeEventListener("ae:open-student-menu", handleMenuRequest);
    }, [openDrawer]);

    useEffect(() => {
        closeDrawer();
        setMaterialsOpen(false);
    }, [location.pathname]);

    const renderMaterials = variant => {
        if (loading) return <div className="ae-student-menu-status">教材載入中...</div>;
        if (navError) return <div className="ae-student-menu-status error">教材暫時無法載入</div>;
        if (!hasMaterials) return <div className="ae-student-menu-status">目前沒有可使用的教材</div>;

        return accessibleCategories.map(category => (
            <details className="ae-student-material-group" key={`${variant}-${category.id}`}>
                <summary aria-label={`切換${category.name}，${category.books.length} 本教材`}>
                    <span><FiBookOpen />{category.name}</span>
                    <span>{category.books.length} 本</span>
                </summary>
                <div>
                    {category.books.map(book => (
                        <InstantDrawerLink
                            key={book.id || book.code}
                            to={`/student/books/${book.code}`}
                            onNavigate={closeDrawer}
                            className={isPathActive(`/student/books/${book.code}`) ? "active" : ""}
                        >
                            {book.name}
                        </InstantDrawerLink>
                    ))}
                </div>
            </details>
        ));
    };

    const speakingLinks = (
        <div className="ae-student-choice-list">
            <InstantDrawerLink to="/student/pronunciation" onNavigate={closeDrawer} className={isPathActive("/student/pronunciation") ? "active" : ""}>
                <span className="is-blue"><FiMic /></span>
                <span><strong>發音教練</strong><small>跟著句子練清楚發音</small></span>
            </InstantDrawerLink>
            <InstantDrawerLink to="/student/speaking-challenges" onNavigate={closeDrawer} className={isPathActive("/student/speaking-challenges") ? "active" : ""}>
                <span className="is-orange"><FiStar /></span>
                <span><strong>口說大挑戰</strong><small>聽問題，用完整英文回答</small></span>
            </InstantDrawerLink>
        </div>
    );

    const learningLinks = (
        <section className="ae-student-drawer-section">
            <span>學習功能</span>
            {hasAssignmentsAccess && <InstantDrawerLink to="/student/assignments" onNavigate={closeDrawer} className={isPathActive("/student/assignments") ? "active" : ""}><FiBookOpen />我的作業</InstantDrawerLink>}
            {hasReviewAccess && <InstantDrawerLink to="/student/review" onNavigate={closeDrawer} className={isPathActive("/student/review") ? "active" : ""}><FiRefreshCw />智慧複習</InstantDrawerLink>}
            {hasActiveLearningAccess && <InstantDrawerLink to="/student/weekly-report" onNavigate={closeDrawer} className={isPathActive("/student/weekly-report") ? "active" : ""}><FiBarChart2 />每週報告</InstantDrawerLink>}
            {hasRewardsAccess && <InstantDrawerLink to="/student/rewards" onNavigate={closeDrawer} className={isPathActive("/student/rewards") ? "active" : ""}><FiGift />獎品商城</InstantDrawerLink>}
            {hasAiAccess && <InstantDrawerLink to="/student/ai-generator" onNavigate={closeDrawer} className={isPathActive("/student/ai-generator") ? "active" : ""}><FiStar />AI 教材</InstantDrawerLink>}
        </section>
    );

    const accountLinks = (
        <section className="ae-student-drawer-section">
            <span>帳號與幫助</span>
            <InstantDrawerLink to="/student/membership" onNavigate={closeDrawer} className={isPathActive("/student/membership") ? "active" : ""}><FiCreditCard />會員與功能</InstantDrawerLink>
            <InstantDrawerLink to="/student/settings" onNavigate={closeDrawer} className={isPathActive("/student/settings") ? "active" : ""}><FiSettings />我的設定</InstantDrawerLink>
            <InstantDrawerLink to="/account/security" onNavigate={closeDrawer}><FiLock />帳號與密碼</InstantDrawerLink>
            <button type="button" onClick={() => { closeDrawer(); onOpenTour(); }}><FiHelpCircle />使用教學</button>
            <InstantDrawerLink to="/support" onNavigate={closeDrawer}><FiHelpCircle />聯絡客服</InstantDrawerLink>
        </section>
    );

    const notificationMenu = (
        <NavDropdown
            id="student-notifications"
            title={<span className="ae-notification-trigger" aria-label={unreadCount > 0 ? `通知，目前有 ${unreadCount} 則未讀` : "通知"}><FiBell aria-hidden="true" />{unreadCount > 0 && <b>{unreadCount > 99 ? "99+" : unreadCount}</b>}</span>}
            className="ae-notification-dropdown"
            align="end"
        >
            <div className="ae-notification-heading"><strong>通知</strong><span>{unreadCount > 0 ? `${unreadCount} 則未讀` : "沒有新通知"}</span></div>
            {notifications.length === 0
                ? <div className="ae-notification-empty">目前沒有新通知</div>
                : notifications.slice(0, 4).map(notification => (
                    <NavDropdown.Item as="button" type="button" key={notification.id} onClick={() => onNotificationRead(notification)} className={`ae-notification-item ${notification.read_at ? "is-read" : ""}`}>
                        <FiBell /><span><strong>{notification.title}</strong><small>{notification.body}</small></span>
                    </NavDropdown.Item>
                ))}
            <NavDropdown.Divider />
            <NavDropdown.Item as={Link} to="/student/notifications" className="ae-dropdown-item"><FiBell />查看全部通知</NavDropdown.Item>
        </NavDropdown>
    );

    const bottomNavigation = (
        <nav className="ae-student-bottom-nav" aria-label="學生主要導覽">
            <Link to="/student/leaderboard" className={isPathActive("/student/leaderboard") ? "active" : ""}><FiTrendingUp /><span>排行榜</span></Link>
            {shouldShowMaterials && <button type="button" onClick={() => openDrawer("materials")} className={isPathActive("/student/books") ? "active" : ""}><FiBookOpen /><span>教材</span></button>}
            {hasPronunciationAccess && <button type="button" onClick={() => openDrawer("speaking")} className={speakingActive ? "active" : ""}><FiMic /><span>開口說</span></button>}
            <Link to="/student/settings" className={`ae-student-bottom-profile ${isPathActive("/student/settings") ? "active" : ""}`} aria-label="我的設定">
                <span className="ae-student-bottom-avatar">{profileAvatar}</span>
                <span>我的設定</span>
            </Link>
        </nav>
    );

    return (
        <>
            <Navbar className={`ae-navbar ae-student-navbar ${scrolled ? "scrolled" : ""}`}>
                <Container fluid className="ae-navbar-container">
                    <Navbar.Brand as={Link} to="/student/leaderboard" className="ae-brand" aria-label="Alan English 學習排行榜"><Brand /></Navbar.Brand>
                    <Nav className="ae-student-desktop-nav" onSelect={closeDrawer}>
                        <Nav.Link as={Link} to="/student/leaderboard" className={isPathActive("/student/leaderboard") ? "active" : ""}><span><FiTrendingUp />排行榜</span></Nav.Link>
                        {shouldShowMaterials && (
                            <NavDropdown id="student-materials" title={<span><FiBookOpen />我的教材</span>} show={materialsOpen} onToggle={setMaterialsOpen} className={isPathActive("/student/books") ? "active" : ""}>
                                <div className="ae-student-dropdown-heading"><strong>選一本教材</strong><small>{loading ? "教材載入中…" : `${materialCount} 本可使用`}</small></div>
                                {renderMaterials("desktop")}
                            </NavDropdown>
                        )}
                        {hasPronunciationAccess && (
                            <NavDropdown id="student-speaking" title={<span><FiMic />開口說</span>} className={speakingActive ? "active" : ""}>
                                <div className="ae-student-dropdown-heading"><strong>今天想怎麼練？</strong><small>選一種練習</small></div>
                                {speakingLinks}
                            </NavDropdown>
                        )}
                        <NavDropdown id="student-more" title={<span><FiZap />學習功能</span>} className={learningActive ? "active" : ""}>
                            <div className="ae-student-more-grid is-learning-only">{learningLinks}</div>
                        </NavDropdown>
                    </Nav>
                    <div className="ae-student-desktop-account">
                        {notificationMenu}
                        <Link to="/student/settings" className="ae-student-account-link" aria-label="前往我的設定">
                            <span className="ae-student-account-chip"><span>{profileAvatar}</span><strong>{profile?.name || "同學"}</strong></span>
                        </Link>
                        <button type="button" className="ae-student-desktop-logout" onClick={onLogout} disabled={loggingOut}>
                            <FiLogOut aria-hidden="true" />{loggingOut ? "登出中..." : "登出"}
                        </button>
                    </div>
                    <div className="ae-student-mobile-account">
                        <Link to="/student/notifications" aria-label={unreadCount > 0 ? `查看通知，目前有 ${unreadCount} 則未讀` : "查看通知"}><FiBell />{unreadCount > 0 && <b>{unreadCount > 99 ? "99+" : unreadCount}</b>}</Link>
                        <button type="button" className="ae-student-mobile-menu-button" onClick={() => openDrawer("menu")} aria-label="開啟功能選單" aria-expanded={drawer === "menu"} aria-controls="student-navigation-drawer"><FiMenu /></button>
                    </div>
                </Container>
            </Navbar>

            {typeof document === "undefined" ? bottomNavigation : createPortal(bottomNavigation, document.body)}

            <Offcanvas id="student-navigation-drawer" show={Boolean(drawer)} onHide={closeDrawer} placement={drawer === "menu" ? "end" : "bottom"} className={`ae-student-drawer ${drawer === "menu" ? "is-menu" : "is-choice"}`} backdrop scroll={false}>
                <Offcanvas.Header closeButton closeLabel="關閉選單">
                    <div><strong>{drawer === "materials" ? "我的教材" : drawer === "speaking" ? "開口說" : "功能選單"}</strong><small>{drawer === "materials" ? "選一本想練習的教材" : drawer === "speaking" ? "選擇一種口說練習" : "學習、帳號與幫助"}</small></div>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    {drawer === "materials" && renderMaterials("mobile")}
                    {drawer === "speaking" && speakingLinks}
                    {drawer === "menu" && (
                        <>
                            <div className="ae-student-drawer-profile">
                                <span className="ae-student-drawer-avatar">{profileAvatar}</span>
                                <div><strong>{profileName}</strong><small>Lv.{gamificationLevel} · {totalXp.toLocaleString("zh-TW")} XP</small></div>
                                {hasAiPremium && <b><FiZap />AI Premium</b>}
                            </div>
                            <div className="ae-student-drawer-xp"><span style={{ width: `${xpProgressPercent}%` }} /><small>距離下一級還差 {xpToNextLevel.toLocaleString("zh-TW")} XP</small></div>
                            <div className="ae-student-more-grid">{learningLinks}{accountLinks}</div>
                            <button type="button" className="ae-student-drawer-logout" onClick={onLogout} disabled={loggingOut}><FiLogOut />{loggingOut ? "登出中..." : "登出"}</button>
                        </>
                    )}
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
};

export default StudentNavbar;
