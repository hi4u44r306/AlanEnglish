import { cancelUnsavedLeaveApproval, confirmUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { REWARD_SHOP_ENABLED } from "../../constants/rewardShop";
import React, { useEffect, useMemo, useRef, useState } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Offcanvas from 'react-bootstrap/Offcanvas';
import '../assets/scss/Navigation.scss';
import '../assets/scss/StaffMenuLight.scss';
import 'react-circular-progressbar/dist/styles.css';
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiBarChart2, FiBell, FiBookOpen, FiCheckSquare, FiCreditCard, FiGift, FiHelpCircle, FiHome, FiLock, FiLogOut, FiMic, FiRefreshCw, FiSettings, FiStar, FiTrendingUp, FiUpload, FiUsers, FiZap } from "react-icons/fi";
import { HiOutlineBars3 } from "react-icons/hi2";
import Brand from "./Brand";
import useStudentPageQuery from "../../hooks/useStudentPageQuery";
import useStudentWarmup from "../../hooks/useStudentWarmup";
import { useAuth } from "../../auth/AuthContext";
import { getRoleHome } from "../../auth/RoleHomeRedirect";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getGamificationSummary } from "../../services/gamificationService";
import { getStudentNotifications, markStudentNotificationRead } from "../../services/membershipService";
import { hasAiPremiumAccess } from "../../constants/membershipPlans";
import { cacheStudentAvatarDisplayUrl } from "../../constants/studentAvatarCache";
import { readAppShellCache, scheduleWhenIdle, writeAppShellCache } from "../../services/appShellCache";
import StudentNavbar from "./StudentNavbar";
import MaterialsNavigator from "./MaterialsNavigator";
import { NOTIFICATIONS_READ_EVENT, notifyNotificationsRead } from "../../constants/notificationEvents";
import { getStudentNotificationDestination } from "../../constants/studentNotificationRoutes";
import { createBasicReadingCategory, isBasicReadingBook } from "../../constants/basicReadingCatalog";

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

const staysInAuthenticatedShell = destination => [
    "/student",
    "/teacher",
    "/admin",
    "/account",
    "/billing"
].some(prefix => destination === prefix || destination.startsWith(`${prefix}/`));

const isTextbookCategory = category => (
    String(category?.code || "").trim().toLowerCase() === "textbook"
    || String(category?.name || "").trim() === "課本"
);

const isBasicReadingCategory = category => (
    String(category?.code || "").trim().toLowerCase() === "basic-reading"
    || String(category?.navigationType || "") === "basic-reading"
);

const isListeningCategory = category => (
    String(category?.code || "").trim().toLowerCase() === "listening"
    || String(category?.name || "").trim() === "聽力本"
);

const EMPTY_LIST = [];

function MainNavbar() {
    const [scrolled, setScrolled] = useState(false);



    const [loggingOut, setLoggingOut] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [desktopMaterialsOpen, setDesktopMaterialsOpen] = useState(false);
    const [materialsResetToken, setMaterialsResetToken] = useState(0);
    const mobileBodyRef = useRef(null);
    const pendingMobileNavigationRef = useRef("");

    const [notifications, setNotifications] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();
    const { firebaseUser, role, isAuthenticated, logout, studentProfile } = useAuth();
    const isTeacher = role === "teacher" || role === "admin";
    const isAdmin = role === "admin";
    const classMaterialsPath = isAdmin ? "/admin/class-materials" : "/teacher/class-materials";
    const isStudent = role === "student";
    const catalogQuery = useStudentPageQuery("catalog", () => getAccessibleCatalog(firebaseUser), { enabled: Boolean(firebaseUser) });
    useStudentWarmup(isStudent ? catalogQuery.data : null);
    const summaryQuery = useStudentPageQuery("summary", () => getGamificationSummary(firebaseUser), { enabled: Boolean(firebaseUser && isStudent) });
    const categories = catalogQuery.data?.categories || EMPTY_LIST;
    const loading = catalogQuery.loading;
    const navError = catalogQuery.error?.message;
    const gamificationSummary = summaryQuery.data;
    const effectiveAccess = studentProfile?.membership?.effective_access;
    const hasActiveStudentMembership = isStudent && studentProfile?.membership?.is_active === true;
    const hasActiveAcademyAccess = isStudent
        && hasActiveStudentMembership
        && effectiveAccess?.plan_codes?.includes("academy_internal") === true;
    const hasAiPremium = isStudent && hasActiveStudentMembership && hasAiPremiumAccess(effectiveAccess);
    const hasAiAccess = !isStudent || (hasActiveStudentMembership && effectiveAccess?.features?.ai_materials === true);
    const hasPronunciationAccess = !isStudent
        || (hasActiveStudentMembership && (
            effectiveAccess?.features?.pronunciation === true
            || effectiveAccess?.features?.pronunciation_practice === true
            || hasActiveAcademyAccess
        ));
    const hasRewardsAccess = REWARD_SHOP_ENABLED && isStudent
        && hasActiveStudentMembership
        && studentProfile?.learner_type === "academy_student"
        && effectiveAccess?.plan_codes?.includes("academy_internal") === true;
    const materialCategories = useMemo(() => {
        const regularCategories = [];
        const basicReadingBooks = [];

        categories.forEach(category => {
            if (isListeningCategory(category)) return;
            const unlockedBooks = (category.books || []).filter(book => !book.locked);
            if (isTextbookCategory(category) || isBasicReadingCategory(category)) {
                basicReadingBooks.push(...unlockedBooks.filter(isBasicReadingBook));
                return;
            }
            if (unlockedBooks.length > 0) regularCategories.push({ ...category, books: unlockedBooks });
        });

        return basicReadingBooks.length > 0
            ? [createBasicReadingCategory(basicReadingBooks), ...regularCategories]
            : regularCategories;
    }, [categories]);
    const homePath = isAuthenticated ? getRoleHome(role) : "/";
    const accountManagementPath = isAdmin ? "/admin/accounts" : "/teacher/accounts";
    const reportPath = isAdmin ? "/admin/reports" : "/teacher/reports";
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
    const displayName = studentProfile?.nickname || studentProfile?.name || displayRole;

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 24);
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!isStudent) return undefined;
        const onNotificationsRead = event => {
            const notificationIds = event?.detail?.notificationIds;
            if (notificationIds === "all") {
                const readAt = new Date().toISOString();
                setNotifications(current => current.map(item => ({ ...item, read_at: item.read_at || readAt })));
            } else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
                const ids = new Set(notificationIds.map(Number));
                const readAt = new Date().toISOString();
                setNotifications(current => current.map(item => ids.has(Number(item.id)) ? { ...item, read_at: item.read_at || readAt } : item));
            } else if (Array.isArray(notificationIds?.unreadIds) && notificationIds.unreadIds.length > 0) {
                const ids = new Set(notificationIds.unreadIds.map(Number));
                setNotifications(current => current.map(item => ids.has(Number(item.id)) ? { ...item, read_at: null } : item));
            }
        };
        window.addEventListener(NOTIFICATIONS_READ_EVENT, onNotificationsRead);
        return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, onNotificationsRead);
    }, [isStudent]);

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
        if (gamificationSummary?.profile?.avatar_url && firebaseUser?.uid) {
            cacheStudentAvatarDisplayUrl(gamificationSummary.profile.avatar_url, {
                ownerUid: firebaseUser.uid,
                sourceKey: studentProfile?.user_image || studentProfile?.userimage
            });
        }
    }, [gamificationSummary, firebaseUser?.uid, studentProfile?.user_image, studentProfile?.userimage]);
    useEffect(() => {
        if (!firebaseUser || !isStudent) {
            setNotifications([]);
            return undefined;
        }
        let cancelled = false;
        const cachedNotifications = readAppShellCache(firebaseUser.uid, "notifications", 90 * 1000);
        if (cachedNotifications) setNotifications(cachedNotifications);
        const refreshNotifications = () => {
            getStudentNotifications(firebaseUser)
                .then(result => {
                    if (!cancelled) {
                        const nextNotifications = result?.notifications || [];
                        setNotifications(nextNotifications);
                        writeAppShellCache(firebaseUser.uid, "notifications", nextNotifications);
                    }
                })
                .catch(() => {
                    if (!cancelled && !cachedNotifications) setNotifications([]);
                });
        };
        const cancelIdleRefresh = cachedNotifications
            ? scheduleWhenIdle(refreshNotifications)
            : (() => {
                refreshNotifications();
                return () => { };
            })();
        return () => {
            cancelled = true;
            cancelIdleRefresh();
        };
    }, [firebaseUser, isStudent]);

    const closeMobileMenu = () => setMobileOpen(false);
    const handleMobileMenuNavigation = event => {
        const link = event.target.closest("a[href]");
        const isNonPrimaryClick = typeof event.button === "number" && event.button !== 0;
        if (!link || event.defaultPrevented || isNonPrimaryClick || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;

        const destination = link.getAttribute("href") || "";
        if (!staysInAuthenticatedShell(destination)) {
            event.preventDefault();
            pendingMobileNavigationRef.current = destination;
        }
        closeMobileMenu();
    };
    const handleMobileMenuExited = () => {
        restoreDocumentScroll();
        const destination = pendingMobileNavigationRef.current;
        pendingMobileNavigationRef.current = "";
        if (destination) navigate(destination);
    };
    const closeNavigation = () => {
        setMobileOpen(false);
        setDesktopMaterialsOpen(false);
    };
    const handleLogout = async () => {
        if (loggingOut || !confirmUnsavedChanges()) return;
        setLoggingOut(true);
        closeMobileMenu();
        try {
            await logout();
            navigate("/", { replace: true });
        } catch (error) {
            cancelUnsavedLeaveApproval();
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
        notifyNotificationsRead([notification.id]);
        try {
            await markStudentNotificationRead(firebaseUser, notification.id);
        } catch (error) {
            setNotifications(current => current.map(item => item.id === notification.id ? notification : item));
        }
    };
    const isPathActive = path => location.pathname === path || (path !== "/" && location.pathname.startsWith(`${path}/`));
    if (isStudent) {
        return (
            <StudentNavbar
                categories={materialCategories}
                firebaseUser={firebaseUser}
                gamificationLevel={gamificationLevel}
                growthSummary={gamificationSummary}
                growthLoading={summaryQuery.loading || summaryQuery.refreshing}
                growthError={summaryQuery.error}
                onGrowthRetry={() => summaryQuery.refresh(true)}
                hasAiAccess={hasAiAccess}
                hasAiPremium={hasAiPremium}
                hasPronunciationAccess={hasPronunciationAccess}
                hasRewardsAccess={hasRewardsAccess}
                loading={loading}
                loggingOut={loggingOut}
                navError={navError}
                notifications={notifications}
                onLogout={handleLogout}
                onNotificationRead={markNotificationRead}
                onOpenTour={openTour}
                profile={{ ...studentProfile, avatar_url: gamificationSummary?.profile?.avatar_url || studentProfile?.avatar_url }}
                scrolled={scrolled}
                totalXp={totalXp}
                xpProgressPercent={xpProgressPercent}
                xpToNextLevel={xpToNextLevel}
            />
        );
    }

    return (
        <>
            <Navbar className={`ae-navbar ${scrolled ? "scrolled" : ""}${isTeacher ? " is-staff" : ""}`}>
                <Container fluid className="ae-navbar-container">
                    <Navbar.Brand as={Link} to={homePath} className="ae-brand" data-tour="home"><Brand /></Navbar.Brand>
                    <Nav className={`ae-desktop-nav ${isStudent ? "is-student" : ""}`} onSelect={closeNavigation}>
                        {isAuthenticated && <Nav.Link as={Link} to={homePath} className={isPathActive(homePath) ? "active" : ""} data-tour="home"><span className="ae-nav-inline"><FiHome />{isTeacher ? "管理首頁" : "我的首頁"}</span></Nav.Link>}
                        {isTeacher && <NavDropdown id="desktop-account-management" title={<span className="ae-nav-inline"><FiUsers />學生</span>} className="ae-desktop-dropdown" align="end" data-tour="accounts"><NavDropdown.Item as={Link} to={accountManagementPath} className="ae-dropdown-item"><FiUsers />帳號管理</NavDropdown.Item><NavDropdown.Item as={Link} to="/teacher/accounts/create" className="ae-dropdown-item"><FiUsers />建立單一學生</NavDropdown.Item>{isAdmin && <NavDropdown.Item as={Link} to="/admin/accounts/create-staff" className="ae-dropdown-item"><FiUsers />新增教師／管理員</NavDropdown.Item>}<NavDropdown.Item as={Link} to={reportPath} className="ae-dropdown-item"><FiBarChart2 />每週學習報告</NavDropdown.Item>{isAdmin && <NavDropdown.Item as={Link} to="/admin/accounts/import" className="ae-dropdown-item"><FiUpload />CSV 批次建立</NavDropdown.Item>}{isAdmin && <NavDropdown.Item as={Link} to="/admin/student-lifecycle" className="ae-dropdown-item"><FiUsers />在校／離校管理</NavDropdown.Item>}</NavDropdown>}
                        {isTeacher && <Nav.Link as={Link} to="/teacher/assignments" className={isPathActive("/teacher/assignments") ? "active" : ""}><span className="ae-nav-inline"><FiCheckSquare />作業</span></Nav.Link>}
                        {isTeacher && <Nav.Link as={Link} to="/teacher/attendance" className={isPathActive("/teacher/attendance") ? "active" : ""}><span className="ae-nav-inline"><FiUsers />點名</span></Nav.Link>}
                        {isAuthenticated && <NavDropdown id="desktop-staff-materials" title={<span className="ae-nav-inline"><FiBookOpen />{isTeacher ? "教材" : "我的教材"}</span>} className={`ae-desktop-dropdown ae-student-materials-dropdown ${isPathActive("/student/books") ? "is-active" : ""}`} align="end" data-tour="materials" show={desktopMaterialsOpen} onToggle={nextOpen => { setDesktopMaterialsOpen(nextOpen); if (nextOpen) setMaterialsResetToken(current => current + 1); }} autoClose="outside">{isTeacher && <><NavDropdown.Item onClick={() => setDesktopMaterialsOpen(false)} as={Link} to="/teacher/music/manage" className="ae-dropdown-item"><FiSettings />音檔管理</NavDropdown.Item><NavDropdown.Item onClick={() => setDesktopMaterialsOpen(false)} as={Link} to={classMaterialsPath} className="ae-dropdown-item"><FiBookOpen />班級教材設定</NavDropdown.Item>{isAdmin && <NavDropdown.Item onClick={() => setDesktopMaterialsOpen(false)} as={Link} to="/admin/catalog" className="ae-dropdown-item"><FiBookOpen />教材導覽管理</NavDropdown.Item>}{isAdmin && <NavDropdown.Item onClick={() => setDesktopMaterialsOpen(false)} as={Link} to="/admin/speaking-content" className="ae-dropdown-item"><FiMic />口說題庫</NavDropdown.Item>}{hasPronunciationAccess && <NavDropdown.Item onClick={() => setDesktopMaterialsOpen(false)} as={Link} to="/student/speaking-challenges" className="ae-dropdown-item"><FiMic />口說大挑戰預覽</NavDropdown.Item>}{hasPronunciationAccess && <NavDropdown.Item onClick={() => setDesktopMaterialsOpen(false)} as={Link} to="/student/pronunciation" className="ae-dropdown-item"><FiMic />發音教練示範</NavDropdown.Item>}<NavDropdown.Item onClick={() => setDesktopMaterialsOpen(false)} as={Link} to="/student/ai-generator" className="ae-dropdown-item"><FiStar />AI 教材</NavDropdown.Item><NavDropdown.Divider /></>}<div className="ae-materials-dropdown-heading"><strong>選一本教材</strong><span>{loading ? "教材載入中…" : `共 ${materialCategories.reduce((total, category) => total + category.books.length, 0)} 本`}</span></div><MaterialsNavigator categories={materialCategories} loading={loading} navError={navError} onNavigate={() => setDesktopMaterialsOpen(false)} resetToken={materialsResetToken} variant="staff-desktop" /></NavDropdown>}
                        {isAuthenticated && !isTeacher && hasPronunciationAccess && <Nav.Link as={Link} to="/student/pronunciation" className={isPathActive("/student/pronunciation") ? "active" : ""}><span className="ae-nav-inline"><FiMic />{isTeacher ? "發音教練示範" : "發音教練"}</span></Nav.Link>}
                        {isAuthenticated && !isTeacher && hasPronunciationAccess && <Nav.Link as={Link} to="/student/speaking-challenges" className={isPathActive("/student/speaking-challenges") ? "active" : ""}><span className="ae-nav-inline"><FiMic />{isStudent ? "口說大挑戰" : "口說大挑戰預覽"}</span></Nav.Link>}
                        {isAuthenticated && !isTeacher && <Nav.Link as={Link} to="/student/ai-generator" className={isPathActive("/student/ai-generator") ? "active" : ""}><span className="ae-nav-inline"><FiStar />{hasAiAccess ? "AI 教材" : "AI 教材與發音方案"}</span></Nav.Link>}
                        {isStudent && <button type="button" className="ae-desktop-all-functions" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-controls="main-navigation-drawer"><HiOutlineBars3 aria-hidden="true" /><span>全部功能</span></button>}
                        {/* Staff menu: 學生 / 作業 / 教材 / 設定. Pages that are switched off (prize shop, store, level tests, link list, staff leaderboard) keep their routes but have no entry here. */}
                        {isAdmin && <NavDropdown id="desktop-system-tools" title={<span className="ae-nav-inline"><FiSettings />設定</span>} className="ae-desktop-dropdown" align="end"><NavDropdown.Item as={Link} to="/admin/membership" className="ae-dropdown-item"><FiCreditCard />會員與啟用碼</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/support" className="ae-dropdown-item"><FiHelpCircle />客服案件</NavDropdown.Item><NavDropdown.Item as={Link} to="/admin/api-usage" className="ae-dropdown-item"><FiBarChart2 />網站成本</NavDropdown.Item></NavDropdown>}
                        {!isStudent && <button type="button" className="ae-desktop-help" onClick={openTour} data-tour="help"><FiHelpCircle />使用教學</button>}
                        {isStudent && <NavDropdown id="desktop-notifications" title={<span className="ae-notification-trigger"><FiBell aria-hidden="true" />{unreadNotificationCount > 0 && <b>{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</b>}</span>} className="ae-notification-dropdown" align="end"><div className="ae-notification-heading"><strong>通知</strong><span>{unreadNotificationCount > 0 ? `${unreadNotificationCount} 則未讀` : "已讀取最新消息"}</span></div>{notifications.length === 0 ? <div className="ae-notification-empty">目前沒有新通知</div> : notifications.slice(0, 4).map(notification => {
                            const destination = getStudentNotificationDestination(notification);
                            return <NavDropdown.Item as={destination ? Link : "button"} to={destination || undefined} type={destination ? undefined : "button"} key={notification.id} onClick={() => void markNotificationRead(notification)} className={`ae-notification-item ${notification.read_at ? "is-read" : ""}`}><FiBell /><span><strong>{notification.title}</strong><small>{notification.body}</small></span></NavDropdown.Item>;
                        })}<NavDropdown.Divider /><NavDropdown.Item as={Link} to="/student/notifications" className="ae-dropdown-item"><FiBell />查看全部通知</NavDropdown.Item></NavDropdown>}
                        {isAuthenticated && <NavDropdown id="desktop-user-menu" title={<span className="ae-user-chip"><span className="ae-user-chip-avatar">{displayName.slice(0, 1) || "A"}</span><span className="ae-user-chip-name">{displayName}</span>{hasAiPremium && <span className="ae-ai-premium-badge" title="AI Premium｜AI 教材與發音練習已啟用"><FiZap aria-hidden="true" />AI Premium</span>}</span>} className="ae-user-dropdown" align="end"><NavDropdown.Item as={Link} to={homePath} className="ae-dropdown-item"><FiHome />{isTeacher ? "管理首頁" : "我的首頁"}</NavDropdown.Item>{isStudent && <NavDropdown.Item as={Link} to="/student/friends" className={`ae-dropdown-item ${isPathActive("/student/friends") ? "active" : ""}`}><FiUsers />好友與戰績</NavDropdown.Item>}{isStudent && <NavDropdown.Item as={Link} to="/student/membership" className={`ae-dropdown-item ${isPathActive("/student/membership") ? "active" : ""}`}><FiCreditCard />方案與功能</NavDropdown.Item>}{isStudent && <NavDropdown.Item as={Link} to="/student/settings" className="ae-dropdown-item"><FiSettings />我的進度</NavDropdown.Item>}<NavDropdown.Item as={Link} to="/account/security" className="ae-dropdown-item"><FiLock />帳號與密碼</NavDropdown.Item><NavDropdown.Item as={Link} to="/support" className="ae-dropdown-item"><FiHelpCircle />聯絡客服</NavDropdown.Item><NavDropdown.Item as="button" onClick={handleLogout} disabled={loggingOut} className="ae-dropdown-item"><FiLogOut />{loggingOut ? "登出中..." : "登出"}</NavDropdown.Item></NavDropdown>}
                    </Nav>
                    <div className="ae-mobile-actions">
                        {isStudent && <Link to="/student/notifications" className="ae-mobile-notification" aria-label={unreadNotificationCount > 0 ? `查看通知，目前有 ${unreadNotificationCount} 則未讀` : "查看通知"}><FiBell aria-hidden="true" />{unreadNotificationCount > 0 && <b>{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</b>}</Link>}
                        <button type="button" className="ae-mobile-toggle" onClick={() => setMobileOpen(true)} aria-label="開啟全部功能選單" aria-expanded={mobileOpen} aria-controls="main-navigation-drawer"><HiOutlineBars3 aria-hidden="true" /></button>
                    </div>
                </Container>
            </Navbar>
            <Offcanvas id="main-navigation-drawer" show={mobileOpen} onHide={closeMobileMenu} onExited={handleMobileMenuExited} placement="end" className={`ae-mobile-offcanvas${isTeacher ? " is-staff" : ""}`} backdrop scroll={false}>
                <Offcanvas.Header closeButton>
                    <div className="ae-mobile-brand">
                        <span className="ae-mobile-brand-mark">AE</span>
                        <div className="ae-mobile-brand-copy">
                            <strong>ALAN ENGLISH</strong>
                            <small>{isAdmin ? "管理員" : isTeacher ? "老師" : "STUDENT SPACE"}</small>
                        </div>
                    </div>
                </Offcanvas.Header>
                <Offcanvas.Body ref={mobileBodyRef} onClickCapture={handleMobileMenuNavigation}>
                    {isAuthenticated && <div className={`ae-mobile-profile ${hasAiPremium ? "has-ai-premium" : ""}`}><div className="ae-mobile-avatar">{displayName.slice(0, 1) || "A"}</div><div><strong>{displayName}</strong><span>{displayRole}{studentProfile?.class ? ` · ${studentProfile.class} 班` : ""}</span>{hasAiPremium && <span className="ae-ai-premium-badge"><FiZap aria-hidden="true" />AI Premium</span>}</div></div>}
                    {isStudent && <section className="ae-mobile-xp-card" aria-label="學習榮譽進度"><div className="ae-mobile-xp-heading"><span><FiZap aria-hidden="true" />學習榮譽</span><strong>Lv.{gamificationLevel}</strong></div><div className="ae-mobile-xp-track" role="progressbar" aria-label={`目前等級 Lv.${gamificationLevel} 的經驗值進度`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={xpProgressPercent}><span style={{ width: `${xpProgressPercent}%` }} /></div><div className="ae-mobile-xp-meta"><span>目前等級 Lv.{gamificationLevel}</span><strong>{totalXp.toLocaleString("zh-TW")} XP</strong></div><p>距離 Lv.{gamificationLevel + 1} 還差 {xpToNextLevel.toLocaleString("zh-TW")} XP</p></section>}
                    <section className="ae-mobile-section"><span className="ae-mobile-section-title">{isStudent ? "開始學習" : isTeacher ? "首頁" : "主要功能"}</span><Link to={homePath} onClick={closeMobileMenu} className={isPathActive(homePath) ? "active" : ""} data-tour="home"><FiHome /><span>{isTeacher ? "管理首頁" : "我的首頁"}</span></Link>{isAuthenticated && !isTeacher && hasPronunciationAccess && <Link to="/student/pronunciation" onClick={closeMobileMenu} className={isPathActive("/student/pronunciation") ? "active" : ""}><FiMic /><span>{isTeacher ? "發音教練示範" : "發音教練"}</span></Link>}{isAuthenticated && !isTeacher && hasPronunciationAccess && <Link to="/student/speaking-challenges" onClick={closeMobileMenu} className={isPathActive("/student/speaking-challenges") ? "active" : ""}><FiMic /><span>{isStudent ? "口說大挑戰" : "口說大挑戰預覽"}</span></Link>}{isAuthenticated && !isTeacher && <Link to="/student/ai-generator" onClick={closeMobileMenu} className={isPathActive("/student/ai-generator") ? "active" : ""}><FiStar /><span>{hasAiAccess ? "AI 教材" : "AI 教材與發音方案"}</span></Link>}</section>
                    {isTeacher && <section className="ae-mobile-section" data-tour="accounts"><span className="ae-mobile-section-title">學生</span><Link to={accountManagementPath} onClick={closeMobileMenu}><FiUsers /><span>帳號管理</span></Link><Link to="/teacher/accounts/create" onClick={closeMobileMenu}><FiUsers /><span>建立單一學生</span></Link>{isAdmin && <Link to="/admin/accounts/create-staff" onClick={closeMobileMenu}><FiUsers /><span>新增教師／管理員</span></Link>}<Link to={reportPath} onClick={closeMobileMenu}><FiBarChart2 /><span>每週學習報告</span></Link>{isAdmin && <Link to="/admin/accounts/import" onClick={closeMobileMenu}><FiUpload /><span>CSV 批次建立</span></Link>}{isAdmin && <Link to="/admin/student-lifecycle" onClick={closeMobileMenu}><FiUsers /><span>在校／離校管理</span></Link>}</section>}
                    {isTeacher && <section className="ae-mobile-section"><span className="ae-mobile-section-title">作業</span><Link to="/teacher/assignments" onClick={closeMobileMenu}><FiCheckSquare /><span>發布與查看作業</span></Link><Link to="/teacher/attendance" onClick={closeMobileMenu}><FiUsers /><span>點名與補課</span></Link></section>}
                    {isStudent && <section className="ae-mobile-section"><span className="ae-mobile-section-title">學習成果</span><Link to="/student/review" onClick={closeMobileMenu} className={isPathActive("/student/review") ? "active" : ""}><FiRefreshCw /><span>智慧複習</span></Link><Link to="/student/weekly-report" onClick={closeMobileMenu} className={isPathActive("/student/weekly-report") ? "active" : ""}><FiBarChart2 /><span>每週報告</span></Link><Link to="/student/leaderboard" onClick={closeMobileMenu} className={isPathActive("/student/leaderboard") ? "active" : ""}><FiTrendingUp /><span>學習排行榜</span></Link>{hasRewardsAccess && <Link to="/student/rewards" onClick={closeMobileMenu} className={isPathActive("/student/rewards") ? "active" : ""}><FiGift /><span>獎品商城</span></Link>}</section>}
                    {isStudent && <section className="ae-mobile-section"><span className="ae-mobile-section-title">學習成果</span><Link to="/student/review" onClick={closeMobileMenu} className={isPathActive("/student/review") ? "active" : ""}><FiRefreshCw /><span>智慧複習</span></Link><Link to="/student/weekly-report" onClick={closeMobileMenu} className={isPathActive("/student/weekly-report") ? "active" : ""}><FiBarChart2 /><span>每週報告</span></Link><Link to="/student/leaderboard" onClick={closeMobileMenu} className={isPathActive("/student/leaderboard") ? "active" : ""}><FiTrendingUp /><span>學習排行榜</span></Link>{hasRewardsAccess && <Link to="/student/rewards" onClick={closeMobileMenu} className={isPathActive("/student/rewards") ? "active" : ""}><FiGift /><span>獎品商城</span></Link>}</section>}
                    {isTeacher && <section className="ae-mobile-section"><span className="ae-mobile-section-title">教材管理</span><Link to="/teacher/music/manage" onClick={closeMobileMenu}><FiSettings /><span>音檔管理</span></Link><Link to={classMaterialsPath} onClick={closeMobileMenu}><FiBookOpen /><span>班級教材設定</span></Link>{isAdmin && <Link to="/admin/catalog" onClick={closeMobileMenu}><FiBookOpen /><span>教材導覽管理</span></Link>}{isAdmin && <Link to="/admin/speaking-content" onClick={closeMobileMenu}><FiMic /><span>口說題庫</span></Link>}{hasPronunciationAccess && <Link to="/student/speaking-challenges" onClick={closeMobileMenu}><FiMic /><span>口說大挑戰預覽</span></Link>}{hasPronunciationAccess && <Link to="/student/pronunciation" onClick={closeMobileMenu}><FiMic /><span>發音教練示範</span></Link>}<Link to="/student/ai-generator" onClick={closeMobileMenu}><FiStar /><span>AI 教材</span></Link></section>}
                    {!isStudent && <section className="ae-mobile-section ae-mobile-materials ae-staff-materials" data-tour="materials"><span className="ae-mobile-section-title">{isTeacher ? "教材清單" : "我的教材"} · {loading ? "載入中" : `共 ${materialCategories.reduce((total, category) => total + category.books.length, 0)} 本`}</span><MaterialsNavigator categories={materialCategories} loading={loading} navError={navError} onNavigate={closeMobileMenu} resetToken={`${mobileOpen}-${location.pathname}`} variant="staff-mobile" /></section>}
                    {isAdmin && <section className="ae-mobile-section"><span className="ae-mobile-section-title">設定</span><Link to="/admin/membership" onClick={closeMobileMenu}><FiCreditCard /><span>會員與啟用碼</span></Link><Link to="/admin/support" onClick={closeMobileMenu}><FiHelpCircle /><span>客服案件</span></Link><Link to="/admin/api-usage" onClick={closeMobileMenu}><FiBarChart2 /><span>網站成本</span></Link></section>}
                    <section className="ae-mobile-section ae-mobile-other"><span className="ae-mobile-section-title">其他</span><button type="button" onClick={openTour} data-tour="help"><FiHelpCircle /><span>使用教學</span></button>{isStudent && <Link to="/student/membership" onClick={closeMobileMenu} className={isPathActive("/student/membership") ? "active" : ""}><FiCreditCard /><span>方案與功能</span></Link>}{isStudent && <Link to="/student/settings" onClick={closeMobileMenu}><FiSettings /><span>我的進度</span></Link>}{isAuthenticated && <Link to="/account/security" onClick={closeMobileMenu}><FiLock /><span>帳號與密碼</span></Link>}<Link to="/support" onClick={closeMobileMenu}><FiHelpCircle /><span>聯絡客服</span></Link><Link to="/showcase" onClick={closeMobileMenu}><FiBookOpen /><span>關於 AE</span></Link></section>
                    {isAuthenticated && <button type="button" className="ae-mobile-logout" onClick={handleLogout} disabled={loggingOut}><FiLogOut /><span>{loggingOut ? "登出中..." : "登出"}</span></button>}
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
}

export default MainNavbar;
