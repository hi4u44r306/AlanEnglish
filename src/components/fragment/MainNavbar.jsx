import React, { useEffect, useMemo, useState } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Offcanvas from 'react-bootstrap/Offcanvas';
import '../assets/scss/Navigation.scss';
import 'react-circular-progressbar/dist/styles.css';
import BlueBook from '../assets/img/blue book.png';
import Menu from '../assets/img/menu.png';
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiBarChart2, FiBookOpen, FiHelpCircle, FiHome, FiLogOut, FiMessageCircle, FiRefreshCw, FiSettings, FiStar, FiUsers } from "react-icons/fi";
import Brand from "./Brand";
import { supabase } from "../Pages/supabase-config";
import { useAuth } from "../../auth/AuthContext";
import { getRoleHome } from "../../auth/RoleHomeRedirect";

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
    const navigate = useNavigate();
    const location = useLocation();
    const { role, isAuthenticated, logout, studentProfile } = useAuth();
    const isTeacher = role === "teacher" || role === "admin";
    const isAdmin = role === "admin";
    const isStudent = role === "student";
    const homePath = isAuthenticated ? getRoleHome(role) : "/";
    const accountManagementPath = isAdmin ? "/admin/accounts" : "/teacher/accounts";
    const reportPath = isAdmin ? "/admin/reports" : "/teacher/reports";

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
        const timer = window.setTimeout(() => restoreDocumentScroll(), 420);
        return () => window.clearTimeout(timer);
    }, [location.pathname]);

    useEffect(() => () => restoreDocumentScroll(), []);

    useEffect(() => {
        const fetchNavbarData = async () => {
            try {
                setLoading(true);
                setNavError(null);
                const { data: categoryData, error: categoryError } = await supabase.from('book_categories').select('id,name,code,sort_order,enabled').eq('enabled', true).order('sort_order', { ascending: true });
                if (categoryError) throw categoryError;
                const { data: bookData, error: bookError } = await supabase.from('books').select('id,category_id,name,code,sort_order,enabled').eq('enabled', true).order('sort_order', { ascending: true });
                if (bookError) throw bookError;
                setCategories((categoryData || []).map(category => ({ ...category, books: (bookData || []).filter(book => book.category_id === category.id).sort((a, b) => a.sort_order - b.sort_order) })));
            } catch (error) {
                console.error("MainNavbar 載入失敗:", error);
                setNavError("Navbar 載入失敗");
            } finally {
                setLoading(false);
            }
        };
        fetchNavbarData();
    }, []);

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
    const isPathActive = path => location.pathname === path || (path !== "/" && location.pathname.startsWith(`${path}/`));
    const renderDesktopCategory = (category, index) => (
        <NavDropdown id={`desktop-category-${category.id}`} key={category.id} title={<span className="ae-nav-inline"><FiBookOpen />{category.name}</span>} className="ae-desktop-dropdown" data-tour={index === 0 ? "materials" : undefined} align="end">
            {category.books?.length > 0 ? category.books.map(book => <NavDropdown.Item key={book.id} as={Link} to={`/student/books/${book.code}`} className="ae-dropdown-item"><img src={BlueBook} alt="" /><span>{book.name}</span></NavDropdown.Item>) : <NavDropdown.Item disabled>尚無教材</NavDropdown.Item>}
        </NavDropdown>
    );
    const renderMobileCategories = () => {
        if (loading) return <div className="ae-mobile-status">教材載入中...</div>;
        if (navError) return <div className="ae-mobile-status error">{navError}</div>;
        return categories.map((category, index) => (
            <details className="ae-mobile-category" key={category.id} data-tour={index === 0 ? "materials" : undefined}>
                <summary><span><FiBookOpen />{category.name}</span><span className="ae-mobile-chevron">⌄</span></summary>
                <div className="ae-mobile-book-list">{category.books?.length > 0 ? category.books.map(book => <Link key={book.id} to={`/student/books/${book.code}`} onClick={closeMobileMenu}><img src={BlueBook} alt="" /><span>{book.name}</span></Link>) : <span className="ae-mobile-empty">尚無教材</span>}</div>
            </details>
        ));
    };

    return (
        <>
            <Navbar className={`ae-navbar ${scrolled ? "scrolled" : ""}`}>
                <Container fluid className="ae-navbar-container">
                    <Navbar.Brand as={Link} to={homePath} className="ae-brand" data-tour="home"><Brand /></Navbar.Brand>
                    <Nav className="ae-desktop-nav d-none d-xl-flex">
                        {isAuthenticated && <Nav.Link as={Link} to={homePath} className={isPathActive(homePath) ? "active" : ""} data-tour="home"><span className="ae-nav-inline"><FiHome />{isTeacher ? "管理首頁" : "我的首頁"}</span></Nav.Link>}
                        {isStudent && <Nav.Link as={Link} to="/student/review" className={isPathActive("/student/review") ? "active" : ""}><span className="ae-nav-inline"><FiRefreshCw />智慧複習</span></Nav.Link>}
                        {isStudent && <Nav.Link as={Link} to="/student/weekly-report" className={isPathActive("/student/weekly-report") ? "active" : ""}><span className="ae-nav-inline"><FiBarChart2 />每週報告</span></Nav.Link>}
                        {isAuthenticated && <Nav.Link as={Link} to="/student/conversation" className={isPathActive("/student/conversation") ? "active" : ""} data-tour="conversation"><span className="ae-nav-inline"><FiMessageCircle />{isTeacher ? "英文對話示範" : "英文對話"}</span></Nav.Link>}
                        {isAuthenticated && <Nav.Link as={Link} to="/student/ai-generator" className={isPathActive("/student/ai-generator") ? "active" : ""}><span className="ae-nav-inline"><FiStar />AI 教材</span></Nav.Link>}
                        {loading ? <Nav.Link disabled>教材載入中...</Nav.Link> : navError ? <Nav.Link disabled>教材載入失敗</Nav.Link> : categories.map(renderDesktopCategory)}
                        {isTeacher && <NavDropdown id="desktop-account-management" title={<span className="ae-nav-inline"><FiUsers />管理</span>} className="ae-desktop-dropdown" align="end" data-tour="accounts"><NavDropdown.Item as={Link} to={reportPath} className="ae-dropdown-item"><FiBarChart2 />每週學習報告</NavDropdown.Item><NavDropdown.Item as={Link} to={accountManagementPath} className="ae-dropdown-item"><FiUsers />帳號管理</NavDropdown.Item><NavDropdown.Item as={Link} to="/teacher/accounts/create" className="ae-dropdown-item"><FiUsers />建立帳號</NavDropdown.Item></NavDropdown>}
                        {isTeacher && <NavDropdown id="desktop-music-management" title={<span className="ae-nav-inline"><FiBookOpen />音檔</span>} className="ae-desktop-dropdown" align="end"><NavDropdown.Item as={Link} to="/teacher/music/create" className="ae-dropdown-item"><FiBookOpen />建立音檔</NavDropdown.Item><NavDropdown.Item as={Link} to="/teacher/music/manage" className="ae-dropdown-item"><FiSettings />管理音檔</NavDropdown.Item></NavDropdown>}
                        {isAdmin && <NavDropdown id="desktop-system-tools" title={<span className="ae-nav-inline"><FiSettings />系統</span>} className="ae-desktop-dropdown" align="end"><NavDropdown.Item as={Link} to="/admin/navbar" className="ae-dropdown-item"><FiSettings />編輯 Navbar</NavDropdown.Item></NavDropdown>}
                        <button type="button" className="ae-desktop-help" onClick={openTour} data-tour="help"><FiHelpCircle />使用教學</button>
                        {isAuthenticated && <NavDropdown id="desktop-user-menu" title={<span className="ae-user-chip"><span>{studentProfile?.name?.slice(0, 1) || "A"}</span>{studentProfile?.name || displayRole}</span>} className="ae-user-dropdown" align="end"><NavDropdown.Item as={Link} to={homePath} className="ae-dropdown-item"><FiHome />{isTeacher ? "管理首頁" : "我的帳號"}</NavDropdown.Item><NavDropdown.Item as="button" onClick={handleLogout} disabled={loggingOut} className="ae-dropdown-item"><FiLogOut />{loggingOut ? "登出中..." : "登出"}</NavDropdown.Item></NavDropdown>}
                    </Nav>
                    <button type="button" className="ae-mobile-toggle d-xl-none" onClick={() => setMobileOpen(true)} aria-label="開啟選單"><img src={Menu} alt="" /></button>
                </Container>
            </Navbar>
            <Offcanvas show={mobileOpen} onHide={closeMobileMenu} onExited={restoreDocumentScroll} placement="end" className="ae-mobile-offcanvas d-xl-none" backdrop scroll={false}>
                <Offcanvas.Header closeButton><div className="ae-mobile-brand"><Brand /></div></Offcanvas.Header>
                <Offcanvas.Body>
                    {isAuthenticated && <div className="ae-mobile-profile"><div className="ae-mobile-avatar">{studentProfile?.name?.slice(0, 1) || "A"}</div><div><strong>{studentProfile?.name || "Alan English User"}</strong><span>{displayRole}{studentProfile?.class ? ` · ${studentProfile.class} 班` : ""}</span></div></div>}
                    <section className="ae-mobile-section"><span className="ae-mobile-section-title">主要功能</span><Link to={homePath} onClick={closeMobileMenu} className={isPathActive(homePath) ? "active" : ""} data-tour="home"><FiHome /><span>{isTeacher ? "管理首頁" : "我的首頁"}</span></Link>{isStudent && <Link to="/student/review" onClick={closeMobileMenu} className={isPathActive("/student/review") ? "active" : ""}><FiRefreshCw /><span>智慧複習</span></Link>}{isStudent && <Link to="/student/weekly-report" onClick={closeMobileMenu} className={isPathActive("/student/weekly-report") ? "active" : ""}><FiBarChart2 /><span>每週報告</span></Link>}<Link to="/student/conversation" onClick={closeMobileMenu} className={isPathActive("/student/conversation") ? "active" : ""} data-tour="conversation"><FiMessageCircle /><span>{isTeacher ? "英文對話示範" : "英文對話"}</span></Link>{isAuthenticated && <Link to="/student/ai-generator" onClick={closeMobileMenu} className={isPathActive("/student/ai-generator") ? "active" : ""}><FiStar /><span>AI 教材</span></Link>}</section>
                    <section className="ae-mobile-section"><span className="ae-mobile-section-title">教材</span>{renderMobileCategories()}</section>
                    {isTeacher && <section className="ae-mobile-section" data-tour="accounts"><span className="ae-mobile-section-title">管理</span><Link to={reportPath} onClick={closeMobileMenu}><FiBarChart2 /><span>每週學習報告</span></Link><Link to={accountManagementPath} onClick={closeMobileMenu}><FiUsers /><span>帳號管理</span></Link><Link to="/teacher/accounts/create" onClick={closeMobileMenu}><FiUsers /><span>建立帳號</span></Link></section>}
                    {isTeacher && <section className="ae-mobile-section"><span className="ae-mobile-section-title">音檔</span><Link to="/teacher/music/create" onClick={closeMobileMenu}><FiBookOpen /><span>建立音檔</span></Link><Link to="/teacher/music/manage" onClick={closeMobileMenu}><FiSettings /><span>管理音檔</span></Link></section>}
                    {isAdmin && <section className="ae-mobile-section"><span className="ae-mobile-section-title">系統</span><Link to="/admin/navbar" onClick={closeMobileMenu}><FiSettings /><span>編輯 Navbar</span></Link></section>}
                    <section className="ae-mobile-section ae-mobile-other"><span className="ae-mobile-section-title">其他</span><button type="button" onClick={openTour} data-tour="help"><FiHelpCircle /><span>使用教學</span></button><Link to="/showcase" onClick={closeMobileMenu}><FiBookOpen /><span>關於 AE</span></Link></section>
                    {isAuthenticated && <button type="button" className="ae-mobile-logout" onClick={handleLogout} disabled={loggingOut}><FiLogOut /><span>{loggingOut ? "登出中..." : "登出"}</span></button>}
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
}

export default MainNavbar;
