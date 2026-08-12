import React, { useEffect, useState } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Offcanvas from 'react-bootstrap/Offcanvas';
import '../assets/scss/Navigation.scss';
import 'react-circular-progressbar/dist/styles.css';
import BlueBook from '../assets/img/blue book.png';
import Books from '../assets/img/books.png';
import Search from '../assets/img/search.png';
import File from '../assets/img/file.png';
import Menu from '../assets/img/menu.png';
import Setting from '../assets/img/setting.png';
import { Link } from "react-router-dom";
import Brand from "./Brand";
import { supabase } from "../Pages/supabase-config";
import { useAuth } from "../../auth/AuthContext";
import { getRoleHome } from "../../auth/RoleHomeRedirect";

function MainNavbar() {
    const [scrolled, setScrolled] = useState(false);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [navError, setNavError] = useState(null);
    const { role, isAuthenticated } = useAuth();
    const isTeacher = role === "teacher" || role === "admin";
    const isAdmin = role === "admin";
    const homePath = isAuthenticated ? getRoleHome(role) : "/";

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 100);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const fetchNavbarData = async () => {
            try {
                setLoading(true);
                setNavError(null);

                const { data: categoryData, error: categoryError } = await supabase
                    .from('book_categories')
                    .select('id,name,code,sort_order,enabled')
                    .eq('enabled', true)
                    .order('sort_order', { ascending: true });

                if (categoryError) throw categoryError;

                const { data: bookData, error: bookError } = await supabase
                    .from('books')
                    .select('id,category_id,name,code,sort_order,enabled')
                    .eq('enabled', true)
                    .order('sort_order', { ascending: true });

                if (bookError) throw bookError;

                const convertedCategories = (categoryData || []).map((category) => ({
                    ...category,
                    books: (bookData || [])
                        .filter((book) => book.category_id === category.id)
                        .sort((a, b) => a.sort_order - b.sort_order)
                }));

                setCategories(convertedCategories);
            } catch (error) {
                console.error("MainNavbar 載入失敗:", error);
                setNavError("Navbar 載入失敗");
            } finally {
                setLoading(false);
            }
        };

        fetchNavbarData();
    }, []);

    const renderCategoryDropdown = (category) => (
        <NavDropdown
            id={`category-${category.id}`}
            key={category.id}
            title={
                <div className="d-flex align-items-center">
                    <img style={{ width: 18, marginRight: 4 }} src={Books} alt="books" />
                    {category.name}
                </div>
            }
            className="navlink"
            align="end"
        >
            {category.books?.length > 0 ? category.books.map((book) => (
                <NavDropdown.Item
                    key={book.id}
                    as={Link}
                    to={`/student/books/${book.code}`}
                    className="subnavlink"
                >
                    <img style={{ width: 18, marginRight: 4 }} src={BlueBook} alt={book.name} />
                    {book.name}
                </NavDropdown.Item>
            )) : (
                <NavDropdown.Item disabled>尚無教材</NavDropdown.Item>
            )}
        </NavDropdown>
    );

    return (
        <div>
            {['xl'].map((expand) => (
                <Navbar
                    collapseOnSelect
                    key={expand}
                    expand={expand}
                    className={`navbackground ${scrolled ? 'scrolled' : ''}`}
                >
                    <Container fluid className="containerfluid">
                        <Navbar.Brand as={Link} to={homePath}>
                            <Brand />
                        </Navbar.Brand>

                        <Navbar.Toggle className="toggle" aria-controls={`offcanvasNavbar-expand-${expand}`}>
                            <img style={{ width: 30, height: 30 }} src={Menu} alt="menu" />
                        </Navbar.Toggle>

                        <Navbar.Offcanvas
                            id={`offcanvasNavbar-expand-${expand}`}
                            aria-labelledby={`offcanvasNavbarLabel-expand-${expand}`}
                            placement="end"
                        >
                            <Offcanvas.Header closeButton />
                            <Offcanvas.Body className={`navbackground ${scrolled ? 'scrolled' : ''} d-flex flex-column align-items-center justify-content-center`}>
                                <Nav>
                                    {isTeacher && (
                                        <NavDropdown
                                            title={
                                                <div className="d-flex align-items-center">
                                                    <img style={{ width: 18, marginRight: 4 }} src={Books} alt="teacher" />
                                                    教師用
                                                </div>
                                            }
                                            id={`offcanvasNavbarDropdown-expand-${expand}`}
                                            className="navlink"
                                        >
                                            <NavDropdown.Item as={Link} to="/teacher/navbar" className="subnavlink">
                                                <img style={{ width: 18, marginRight: 4 }} src={Setting} alt="setting" />
                                                編輯 Navbar
                                            </NavDropdown.Item>
                                            <NavDropdown.Item as={Link} to="/teacher/add-music" className="subnavlink">
                                                <img style={{ width: 18, marginRight: 4 }} src={Setting} alt="setting" />
                                                新增音檔
                                            </NavDropdown.Item>
                                            <NavDropdown.Item as={Link} to="/teacher/students" className="subnavlink">
                                                <img style={{ width: 18, marginRight: 4 }} src={Setting} alt="setting" />
                                                新增學生帳號
                                            </NavDropdown.Item>
                                            {isAdmin && (
                                                <NavDropdown.Item as={Link} to="/admin/links" className="subnavlink">
                                                    <img style={{ width: 18, marginRight: 4 }} src={Setting} alt="setting" />
                                                    管理員功能
                                                </NavDropdown.Item>
                                            )}
                                        </NavDropdown>
                                    )}

                                    {loading ? (
                                        <Nav.Link className="navlink" disabled>教材載入中...</Nav.Link>
                                    ) : navError ? (
                                        <Nav.Link className="navlink" disabled>教材載入失敗</Nav.Link>
                                    ) : (
                                        categories.map(renderCategoryDropdown)
                                    )}

                                    {isAuthenticated && (
                                        <Nav.Link as={Link} to={homePath} className="navlink nav-item dropdown">
                                            <div className="username">
                                                <img style={{ width: 18, marginRight: 4 }} src={File} alt="profile" />
                                                我的帳號
                                            </div>
                                        </Nav.Link>
                                    )}

                                    <Nav.Link as={Link} to="/showcase" className="navlink nav-item dropdown">
                                        <div className="username">
                                            <img style={{ width: 18, marginRight: 4 }} src={Search} alt="about" />
                                            關於 AE
                                        </div>
                                    </Nav.Link>
                                </Nav>
                            </Offcanvas.Body>
                        </Navbar.Offcanvas>
                    </Container>
                </Navbar>
            ))}
        </div>
    );
}

export default MainNavbar;