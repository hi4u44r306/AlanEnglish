import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import Offcanvas from "react-bootstrap/Offcanvas";
import { Link, useLocation } from "react-router-dom";
import {
    FiBarChart2,
    FiBell,
    FiBookOpen,
    FiCreditCard,
    FiGift,
    FiHelpCircle,
    FiHome,
    FiLock,
    FiLogOut,
    FiMenu,
    FiSettings,
    FiStar,
    FiTrendingUp,
    FiUsers,
    FiZap
} from "react-icons/fi";
import { PiJoystick } from "react-icons/pi";
import StudentGrowthHeader from "./StudentGrowthHeader";
import StudentAvatarImage from "./StudentAvatarImage";
import { getStudentAvatarDisplayUrl } from "../../constants/defaultStudentAvatars";
import { getStudentNotificationDestination } from "../../constants/studentNotificationRoutes";
import { useCachedStudentAvatarUrl } from "../../hooks/useCachedStudentAvatarUrl";
import MaterialsNavigator from "./MaterialsNavigator";
import "../assets/scss/StudentNavbar.scss";
import "../assets/scss/StudentAdventureNavigation.scss";
import "../assets/scss/StudentGrowthHeader.scss";

const InstantDrawerLink = ({ onNavigate, onClick, to, ...props }) => {
    const handleClick = event => {
        onClick?.(event);
        const isNonPrimaryClick = typeof event.button === "number" && event.button !== 0;
        if (event.defaultPrevented || isNonPrimaryClick || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
        onNavigate?.(to, event);
    };

    return <Link {...props} to={to} onClick={handleClick} />;
};

const NavigationIcon = ({ tone, children }) => <span className={`ae-student-nav-icon is-${tone}`} aria-hidden="true">{children}</span>;

const StudentNavbar = ({
    categories,
    firebaseUser,
    gamificationLevel,
    growthSummary,
    growthLoading,
    growthError,
    onGrowthRetry,
    hasAiPremium,
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
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [materialsOpen, setMaterialsOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [materialsResetToken, setMaterialsResetToken] = useState(0);
    const accessibleCategories = categories || [];
    const materialCount = accessibleCategories.reduce((total, category) => total + category.books.length, 0);
    const hasMaterials = materialCount > 0;
    // Keep the student-facing entry stable while the entitlement catalog is loading.
    // It only reveals the loading state, never material names or links before access is known.
    const shouldShowMaterials = loading || hasMaterials || Boolean(navError);
    const hasActiveLearningAccess = profile?.membership?.is_active === true;
    const features = profile?.membership?.effective_access?.features || {};
    const hasAssignmentsAccess = hasActiveLearningAccess && features.assignments === true;
    const hasSpeakingChallengeAccess = hasActiveLearningAccess && features.pronunciation === true;
    const unreadCount = notifications.filter(item => !item.read_at).length;
    const isPathActive = path => location.pathname === path || location.pathname.startsWith(`${path}/`);
    const speakingActive = isPathActive("/student/speaking-challenges");
    const materialsActive = isPathActive("/student/books");
    const profileActive = [
        "/student/settings",
        "/student/leaderboard",
        "/student/membership",
        "/student/notifications",
        "/account/security",
        "/support",
        "/student/assignments",
        "/student/review",
        "/student/weekly-report",
        "/student/friends",
        "/student/rewards",
        "/student/ai-generator"
    ].some(isPathActive);
    const cachedAvatarUrl = useCachedStudentAvatarUrl(profile?.avatar_url, {
        ownerUid: firebaseUser?.uid,
        sourceKey: profile?.user_image || profile?.userimage
    });
    const avatarUrl = getStudentAvatarDisplayUrl(cachedAvatarUrl, 96);
    const profileName = profile?.nickname || profile?.name || "Alan English 學生";
    const profileInitial = profileName.slice(0, 1) || "A";
    const profileAvatar = avatarUrl
        ? <StudentAvatarImage src={avatarUrl} alt="" />
        : <span>{profileInitial}</span>;

    const resetMaterialsView = useCallback(() => {
        setMaterialsResetToken(current => current + 1);
    }, []);

    const openDrawer = useCallback(view => {
        if (view === "materials") resetMaterialsView();
        setDrawer(view);
        setDrawerOpen(true);
    }, [resetMaterialsView]);
    const closeDrawer = () => {
        setDrawerOpen(false);
        setMaterialsOpen(false);
        setProfileOpen(false);
    };
    const closeDrawerThenNavigate = () => closeDrawer();
    const handleDrawerExited = () => {
        setDrawer("");
        resetMaterialsView();
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
        return <MaterialsNavigator categories={accessibleCategories} loading={loading} navError={navError} onNavigate={closeDrawerThenNavigate} resetToken={materialsResetToken} variant={variant} />;
    };

    const speakingLinks = (
        <div className="ae-student-choice-list">
            {hasSpeakingChallengeAccess ? <InstantDrawerLink to="/student/speaking-challenges" onNavigate={closeDrawerThenNavigate}>
                <span className="is-orange"><FiStar /></span>
                <span><strong>口說大挑戰</strong><small>選擇教材，開始闖關</small></span>
            </InstantDrawerLink> : <button type="button" disabled aria-label="口說大挑戰，需要有效發音練習權限">
                <span className="is-orange"><FiStar /></span>
                <span><strong>口說大挑戰</strong><small>需要有效發音練習權限</small></span>
                <b><FiLock /></b>
            </button>}
        </div>
    );

    const learningLinks = hasActiveLearningAccess ? (
        <section className="ae-student-drawer-section">
            <span>學習紀錄</span>
            {hasAssignmentsAccess && <InstantDrawerLink to="/student/assignments" onNavigate={closeDrawerThenNavigate} className={isPathActive("/student/assignments") ? "active" : ""}><FiBookOpen />我的作業</InstantDrawerLink>}
            {hasActiveLearningAccess && <InstantDrawerLink to="/student/weekly-report" onNavigate={closeDrawerThenNavigate} className={isPathActive("/student/weekly-report") ? "active" : ""}><FiBarChart2 />每週報告</InstantDrawerLink>}
        </section>
    ) : null;

    const growthLinks = (
        <section className="ae-student-drawer-section is-growth">
            <span>角色與獎勵</span>
            <InstantDrawerLink to="/student/settings" onNavigate={closeDrawerThenNavigate} className={isPathActive("/student/settings") ? "active" : ""}><FiSettings />我的角色</InstantDrawerLink>
            {hasActiveLearningAccess && <InstantDrawerLink to="/student/leaderboard" onNavigate={closeDrawerThenNavigate} className={isPathActive("/student/leaderboard") ? "active" : ""}><FiTrendingUp />排行榜</InstantDrawerLink>}
            {hasActiveLearningAccess && <InstantDrawerLink to="/student/friends" onNavigate={closeDrawerThenNavigate} className={isPathActive("/student/friends") ? "active" : ""}><FiUsers />好友</InstantDrawerLink>}
            {hasRewardsAccess && <InstantDrawerLink to="/student/rewards" onNavigate={closeDrawerThenNavigate} className={isPathActive("/student/rewards") ? "active" : ""}><FiGift />獎品商城</InstantDrawerLink>}
        </section>
    );

    const accountLinks = (
        <section className="ae-student-drawer-section">
            <span>帳號與幫助</span>
            <InstantDrawerLink to="/student/membership" onNavigate={closeDrawerThenNavigate} className={isPathActive("/student/membership") ? "active" : ""}><FiCreditCard />會員與功能</InstantDrawerLink>
            <InstantDrawerLink to="/account/security" onNavigate={closeDrawerThenNavigate}><FiLock />帳號與密碼</InstantDrawerLink>
            <button type="button" onClick={() => { closeDrawer(); onOpenTour(); }}><FiHelpCircle />使用教學</button>
            <InstantDrawerLink to="/support" onNavigate={closeDrawerThenNavigate}><FiHelpCircle />聯絡客服</InstantDrawerLink>
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
                : notifications.slice(0, 4).map(notification => {
                    const destination = getStudentNotificationDestination(notification);
                    return (
                        <NavDropdown.Item as={destination ? Link : "button"} to={destination || undefined} type={destination ? undefined : "button"} key={notification.id} onClick={() => onNotificationRead(notification)} className={`ae-notification-item ${notification.read_at ? "is-read" : ""}`}>
                            <FiBell /><span><strong>{notification.title}</strong><small>{notification.body}</small></span>
                        </NavDropdown.Item>
                    );
                })}
            <NavDropdown.Divider />
            <NavDropdown.Item as={Link} to="/student/notifications" className="ae-dropdown-item"><FiBell />查看全部通知</NavDropdown.Item>
        </NavDropdown>
    );

    const bottomNavigation = (
        <nav className="ae-student-bottom-nav" aria-label="學生主要導覽">
            <Link to="/student/dashboard" aria-current={isPathActive("/student/dashboard") ? "page" : undefined} className={isPathActive("/student/dashboard") ? "active" : ""}><NavigationIcon tone="home"><FiHome /></NavigationIcon><span>今日</span></Link>
            {shouldShowMaterials && <button type="button" onClick={() => openDrawer("materials")} aria-current={materialsActive ? "page" : undefined} aria-expanded={drawerOpen && drawer === "materials"} aria-controls="student-navigation-drawer" className={`${materialsActive ? "active" : ""} ${drawerOpen && drawer === "materials" ? "is-open" : ""}`}><NavigationIcon tone="books"><FiBookOpen /></NavigationIcon><span>教材</span></button>}
            <button type="button" onClick={() => openDrawer("speaking")} aria-current={speakingActive ? "page" : undefined} aria-expanded={drawerOpen && drawer === "speaking"} aria-controls="student-navigation-drawer" className={`${speakingActive ? "active" : ""} ${drawerOpen && drawer === "speaking" ? "is-open" : ""}`}><NavigationIcon tone="adventure"><PiJoystick /></NavigationIcon><span>冒險</span></button>
            <Link to="/student/settings" aria-current={isPathActive("/student/settings") ? "page" : undefined} className={`ae-student-bottom-profile ${profileActive ? "active" : ""}`} aria-label="我的">
                <NavigationIcon tone="profile"><span className="ae-student-bottom-avatar">{profileAvatar}</span></NavigationIcon>
                <span>我的</span>
            </Link>
        </nav>
    );

    return (
        <>
            <Navbar className={`ae-navbar ae-student-navbar ${scrolled ? "scrolled" : ""}`}>
                <Container fluid className="ae-navbar-container">
                    <Navbar.Brand as={Link} to="/student/dashboard" className="ae-brand" aria-label="Alan English 今日學習"><img src="/ae-icon.jpeg" alt="" width="40" height="40" /></Navbar.Brand>
                    <StudentGrowthHeader key={firebaseUser?.uid} summary={growthSummary} loading={growthLoading} error={growthError} pointsAccess={hasRewardsAccess} onRetry={onGrowthRetry} avatarUrl={avatarUrl} />
                    <Nav as="nav" className="ae-student-desktop-nav" aria-label="學生桌面導覽" onSelect={closeDrawer}>
                        <Nav.Link as={Link} to="/student/dashboard" aria-current={isPathActive("/student/dashboard") ? "page" : undefined} className={isPathActive("/student/dashboard") ? "active" : ""}><span><NavigationIcon tone="home"><FiHome /></NavigationIcon>今日學習</span></Nav.Link>
                        {shouldShowMaterials && (
                            <NavDropdown id="student-materials" title={<span><NavigationIcon tone="books"><FiBookOpen /></NavigationIcon>我的教材</span>} show={materialsOpen} onToggle={nextOpen => { setMaterialsOpen(nextOpen); if (nextOpen && !materialsOpen) resetMaterialsView(); }} autoClose="outside" className={materialsActive ? "active" : ""}>
                                <div className="ae-student-dropdown-heading"><strong>選一本教材</strong><small>{loading ? "教材載入中…" : `${materialCount} 本可使用`}</small></div>
                                {renderMaterials("desktop")}
                            </NavDropdown>
                        )}
                        <NavDropdown id="student-speaking" title={<span><NavigationIcon tone="adventure"><PiJoystick /></NavigationIcon>口說冒險</span>} className={speakingActive ? "active" : ""}>
                                <div className="ae-student-dropdown-heading"><strong>冒險世界</strong><small>選擇教材，開始闖關</small></div>
                                {speakingLinks}
                        </NavDropdown>
                        <NavDropdown id="student-more" title={<span><NavigationIcon tone="profile">{profileAvatar}</NavigationIcon>我的角色</span>} show={profileOpen} onToggle={setProfileOpen} className={profileActive ? "active" : ""}>
                            <div className="ae-student-dropdown-heading is-profile"><strong>{profileName}</strong><small>Lv.{gamificationLevel}</small></div>
                            <div className="ae-student-more-grid is-profile-menu">{growthLinks}{learningLinks}{accountLinks}</div>
                        </NavDropdown>
                    </Nav>
                    <div className="ae-student-desktop-account">
                        {notificationMenu}
                        <Link to="/student/settings" className="ae-student-account-link" aria-label="前往帳號">
                            <span className="ae-student-account-chip"><span>{profileAvatar}</span><strong>{profileName}</strong></span>
                        </Link>
                        <button type="button" className="ae-student-desktop-logout" onClick={onLogout} disabled={loggingOut} aria-label={loggingOut ? "登出中..." : "登出"} title="登出">
                            <FiLogOut aria-hidden="true" />
                        </button>
                    </div>
                    <div className="ae-student-mobile-account">
                        <Link to="/student/notifications" aria-label={unreadCount > 0 ? `查看通知，目前有 ${unreadCount} 則未讀` : "查看通知"}><FiBell />{unreadCount > 0 && <b>{unreadCount > 99 ? "99+" : unreadCount}</b>}</Link>
                        <button type="button" className="ae-student-mobile-menu-button" onClick={() => openDrawer("menu")} aria-label="開啟功能選單" aria-expanded={drawerOpen && drawer === "menu"} aria-controls="student-navigation-drawer"><FiMenu /></button>
                    </div>
                </Container>
            </Navbar>

            {typeof document === "undefined" ? bottomNavigation : createPortal(bottomNavigation, document.body)}

            <Offcanvas id="student-navigation-drawer" show={drawerOpen} onHide={closeDrawer} onExited={handleDrawerExited} placement={drawer === "speaking" ? "bottom" : "end"} className={`ae-student-drawer ${drawer === "menu" ? "is-menu" : drawer === "materials" ? "is-materials" : "is-choice"}`} backdrop scroll={false}>
                <Offcanvas.Header closeButton closeLabel="關閉選單">
                    <div><strong>{drawer === "materials" ? "我的教材" : drawer === "speaking" ? "口說冒險" : "我的學習選單"}</strong><small>{drawer === "materials" ? "選擇教材、程度與冊別" : drawer === "speaking" ? "選擇教材，開始闖關" : "角色與獎勵、學習紀錄、帳號與幫助"}</small></div>
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
                            <div className="ae-student-more-grid">{growthLinks}{learningLinks}{accountLinks}</div>
                            <button type="button" className="ae-student-drawer-logout" onClick={onLogout} disabled={loggingOut}><FiLogOut />{loggingOut ? "登出中..." : "登出"}</button>
                        </>
                    )}
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
};

export default StudentNavbar;
