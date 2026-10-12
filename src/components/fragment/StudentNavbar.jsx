import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import Offcanvas from "react-bootstrap/Offcanvas";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    FiBell,
    FiBookOpen,
    FiCheckSquare,
    FiChevronRight,
    FiCreditCard,
    FiHelpCircle,
    FiLock,
    FiLogOut,
    FiMenu,
    FiTrendingUp,
    FiUser
} from "react-icons/fi";
import { PiFireFill, PiJoystick } from "react-icons/pi";
import StudentGrowthHeader from "./StudentGrowthHeader";
import StudentAvatarImage from "./StudentAvatarImage";
import { getStudentAvatarDisplayUrl } from "../../constants/defaultStudentAvatars";
import { getStudentNotificationDestination } from "../../constants/studentNotificationRoutes";
import { useCachedStudentAvatarUrl } from "../../hooks/useCachedStudentAvatarUrl";
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
    bossEvent = null,
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
    const hasActiveLearningAccess = profile?.membership?.is_active === true;
    const features = profile?.membership?.effective_access?.features || {};
    // Homework belongs to enrolled class students only; everyone else never sees the entry.
    const hasAssignmentsAccess = hasActiveLearningAccess && features.assignments === true;
    // Without the speaking entitlement the entry stays visible but locked, as it was in the drawer.
    const hasSpeakingChallengeAccess = hasActiveLearningAccess && features.pronunciation === true;
    const unreadCount = notifications.filter(item => !item.read_at).length;
    const isPathActive = path => location.pathname === path || location.pathname.startsWith(`${path}/`);
    const speakingActive = isPathActive("/student/speaking-challenges");
    const materialsActive = isPathActive("/student/books");
    const assignmentsActive = isPathActive("/student/assignments");
    const profileActive = [
        "/student/settings",
        "/student/leaderboard",
        "/student/membership",
        "/student/notifications",
        "/account/security",
        "/support",
        "/student/review",
        "/student/weekly-report",
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

    const openDrawer = useCallback(view => {
        setDrawer(view);
        setDrawerOpen(true);
    }, []);
    const closeDrawer = () => {
        setDrawerOpen(false);
    };
    const closeDrawerThenNavigate = () => closeDrawer();
    const handleDrawerExited = () => {
        setDrawer("");
    };

    const navigate = useNavigate();
    useEffect(() => {
        // 教材 and 冒險 are pages now; other screens that used to ask for those drawers are sent there.
        const handleMenuRequest = event => {
            if (event.detail === "materials") navigate("/student/books");
            else if (event.detail === "speaking") navigate("/student/speaking-challenges");
            else openDrawer("menu");
        };
        window.addEventListener("ae:open-student-menu", handleMenuRequest);
        return () => window.removeEventListener("ae:open-student-menu", handleMenuRequest);
    }, [openDrawer, navigate]);

    useEffect(() => {
        closeDrawer();
    }, [location.pathname]);

    // The menu is the settings place: who I am, notifications, account, help. Everything about
    // learning lives on 我的進度 and the bottom bar, so nothing is listed twice.
    const settingsLinks = (
        <nav className="ae-student-menu-list" aria-label="設定">
            <InstantDrawerLink to="/student/profile" onNavigate={closeDrawerThenNavigate} className={isPathActive("/student/profile") ? "active" : ""}><span className="ae-student-menu-tile is-blue" aria-hidden="true"><FiUser /></span><strong>個人資料</strong><FiChevronRight aria-hidden="true" /></InstantDrawerLink>
            <InstantDrawerLink to="/student/notification-settings" onNavigate={closeDrawerThenNavigate} className={isPathActive("/student/notification-settings") ? "active" : ""}><span className="ae-student-menu-tile is-yellow" aria-hidden="true"><FiBell /></span><strong>通知設定</strong><FiChevronRight aria-hidden="true" /></InstantDrawerLink>
            <InstantDrawerLink to="/account/security" onNavigate={closeDrawerThenNavigate} className={isPathActive("/account/security") ? "active" : ""}><span className="ae-student-menu-tile is-navy" aria-hidden="true"><FiLock /></span><strong>帳號與密碼</strong><FiChevronRight aria-hidden="true" /></InstantDrawerLink>
            <InstantDrawerLink to="/student/membership" onNavigate={closeDrawerThenNavigate} className={isPathActive("/student/membership") ? "active" : ""}><span className="ae-student-menu-tile is-green" aria-hidden="true"><FiCreditCard /></span><strong>會員與功能</strong><FiChevronRight aria-hidden="true" /></InstantDrawerLink>
            <InstantDrawerLink to="/support" onNavigate={closeDrawerThenNavigate} className={isPathActive("/support") ? "active" : ""}><span className="ae-student-menu-tile is-orange" aria-hidden="true"><FiHelpCircle /></span><strong>聯絡客服</strong><FiChevronRight aria-hidden="true" /></InstantDrawerLink>
            <button type="button" onClick={() => { closeDrawer(); onOpenTour(); }}><span className="ae-student-menu-tile is-purple" aria-hidden="true"><FiBookOpen /></span><strong>使用教學</strong><FiChevronRight aria-hidden="true" /></button>
        </nav>
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
            <Link data-tour="progress" to="/student/settings" aria-current={isPathActive("/student/settings") ? "page" : undefined} className={`ae-student-bottom-profile ${profileActive ? "active" : ""}`} aria-label="我的進度">
                <NavigationIcon tone="profile"><FiTrendingUp /></NavigationIcon>
                <span>我的進度</span>
            </Link>
            {hasAssignmentsAccess && <Link data-tour="assignments" to="/student/assignments" aria-current={assignmentsActive ? "page" : undefined} className={assignmentsActive ? "active" : ""}>
                <NavigationIcon tone="homework"><FiCheckSquare /></NavigationIcon>
                <span>作業</span>
            </Link>}
            <Link data-tour="materials" to="/student/books" aria-current={materialsActive ? "page" : undefined} className={materialsActive ? "active" : ""}><NavigationIcon tone="books"><FiBookOpen /></NavigationIcon><span>教材</span></Link>
            {hasSpeakingChallengeAccess
                ? <Link data-tour="adventure" to="/student/speaking-challenges" aria-current={speakingActive ? "page" : undefined} className={speakingActive ? "active" : ""}><NavigationIcon tone="adventure"><PiJoystick /></NavigationIcon><span>冒險</span>{bossEvent && <span className="ae-boss-nav-badge" aria-label="Boss 挑戰出現了"><PiFireFill /></span>}</Link>
                : <button type="button" data-tour="adventure" disabled aria-label="冒險，需要有效發音練習權限"><NavigationIcon tone="adventure"><FiLock /></NavigationIcon><span>冒險</span></button>}
        </nav>
    );

    return (
        <>
            <Navbar className={`ae-navbar ae-student-navbar ${scrolled ? "scrolled" : ""}`}>
                <Container fluid className="ae-navbar-container">
                    <StudentGrowthHeader key={firebaseUser?.uid} summary={growthSummary} loading={growthLoading} error={growthError} pointsAccess={hasRewardsAccess} onRetry={onGrowthRetry} avatarUrl={avatarUrl} name={profileName} />
                    <Nav as="nav" className="ae-student-desktop-nav" aria-label="學生桌面導覽" onSelect={closeDrawer}>
                        <Nav.Link as={Link} data-tour="progress" to="/student/settings" aria-current={isPathActive("/student/settings") ? "page" : undefined} className={profileActive ? "active" : ""} aria-label="我的進度"><span><NavigationIcon tone="profile"><FiTrendingUp /></NavigationIcon>我的進度</span></Nav.Link>
                        {hasAssignmentsAccess && <Nav.Link as={Link} data-tour="assignments" to="/student/assignments" aria-current={assignmentsActive ? "page" : undefined} className={assignmentsActive ? "active" : ""}><span><NavigationIcon tone="homework"><FiCheckSquare /></NavigationIcon>作業</span></Nav.Link>}
                        <Nav.Link as={Link} data-tour="materials" to="/student/books" aria-current={materialsActive ? "page" : undefined} className={materialsActive ? "active" : ""}><span><NavigationIcon tone="books"><FiBookOpen /></NavigationIcon>教材</span></Nav.Link>
                        {hasSpeakingChallengeAccess
                            ? <Nav.Link as={Link} data-tour="adventure" to="/student/speaking-challenges" aria-current={speakingActive ? "page" : undefined} className={speakingActive ? "active" : ""}><span><NavigationIcon tone="adventure"><PiJoystick /></NavigationIcon>冒險{bossEvent && <PiFireFill className="ae-boss-nav-flame" aria-label="Boss 挑戰出現了" />}</span></Nav.Link>
                            : <button type="button" className="nav-link" disabled aria-label="冒險，需要有效發音練習權限"><span><NavigationIcon tone="adventure"><FiLock /></NavigationIcon>冒險</span></button>}
                    </Nav>
                    <div className="ae-student-desktop-account">
                        {notificationMenu}
                        {/* On desktop the name opens the same settings menu the hamburger opens on phones. */}
                        <button type="button" data-tour="settings" className="ae-student-account-link" onClick={() => openDrawer("menu")} aria-label="開啟設定" aria-expanded={drawerOpen && drawer === "menu"} aria-controls="student-navigation-drawer">
                            <span className="ae-student-account-chip"><span>{profileAvatar}</span><strong>{profileName}</strong></span>
                        </button>
                        <button type="button" className="ae-student-desktop-logout" onClick={onLogout} disabled={loggingOut} aria-label={loggingOut ? "登出中..." : "登出"} title="登出">
                            <FiLogOut aria-hidden="true" />
                        </button>
                    </div>
                    <div className="ae-student-mobile-account">
                        <Link to="/student/notifications" aria-label={unreadCount > 0 ? `查看通知，目前有 ${unreadCount} 則未讀` : "查看通知"}><FiBell />{unreadCount > 0 && <b>{unreadCount > 99 ? "99+" : unreadCount}</b>}</Link>
                        <button type="button" data-tour="settings" className="ae-student-mobile-menu-button" onClick={() => openDrawer("menu")} aria-label="開啟功能選單" aria-expanded={drawerOpen && drawer === "menu"} aria-controls="student-navigation-drawer"><FiMenu /></button>
                    </div>
                </Container>
            </Navbar>

            {typeof document === "undefined" ? bottomNavigation : createPortal(bottomNavigation, document.body)}

            <Offcanvas id="student-navigation-drawer" show={drawerOpen} onHide={closeDrawer} onExited={handleDrawerExited} placement="end" className="ae-student-drawer is-menu" backdrop scroll={false}>
                <Offcanvas.Header closeButton closeLabel="關閉選單">
                    <div><strong>設定</strong><small>{profileName}</small></div>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    {drawer === "menu" && (
                        <>
                            {settingsLinks}
                            <button type="button" className="ae-student-drawer-logout" onClick={onLogout} disabled={loggingOut}><FiLogOut />{loggingOut ? "登出中..." : "登出"}</button>
                        </>
                    )}
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
};

export default StudentNavbar;
