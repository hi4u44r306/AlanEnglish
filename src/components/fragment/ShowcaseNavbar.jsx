import "bootstrap/dist/css/bootstrap.min.css";
import React, { useEffect, useState } from "react";
import { Container, Nav, Navbar, Offcanvas } from "react-bootstrap";
import { BiChevronRight, BiLogIn } from "react-icons/bi";
import { Link } from "react-router-dom";
import Brand from "./Brand";
import Menu from "../assets/img/menu.png";
import "../assets/scss/ShowcaseNavbar.scss";

function ShowcaseNavbar({ nav1, nav2, nav3, nav4 }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    const navItems = [
        { label: "功能特色", hint: "孩子每天會使用的核心功能", href: nav1 },
        { label: "學習方式", hint: "從試用、教材到持續練習", href: nav2 },
        { label: "會員方案", hint: "選擇最適合孩子的使用方式", href: nav3 },
        { label: "常見問題", hint: "費用、教材與使用期限說明", href: nav4 },
        { label: "教材商城", hint: "選購實體教材、查看購物車與訂單", href: "/shop" }
    ];

    const closeMobileMenu = () => setMobileOpen(false);

    return (
        <Navbar
            expand="xl"
            expanded={mobileOpen}
            onToggle={setMobileOpen}
            className={`showcase-navbar ${scrolled ? "is-scrolled" : ""}`}
        >
            <Container className="showcase-navbar-container">
                <Navbar.Brand className="showcase-navbar-brand" as={Link} to="/">
                    <Brand />
                </Navbar.Brand>

                <Navbar.Toggle
                    className="showcase-navbar-toggle"
                    aria-controls="showcase-navbar-offcanvas"
                >
                    <img src={Menu} alt="開啟選單" />
                </Navbar.Toggle>

                <Navbar.Offcanvas
                    id="showcase-navbar-offcanvas"
                    aria-labelledby="showcase-navbar-offcanvas-label"
                    placement="end"
                    onHide={closeMobileMenu}
                >
                    <Offcanvas.Header closeButton>
                        <div className="showcase-mobile-brand" id="showcase-navbar-offcanvas-label">
                            <span className="showcase-mobile-brand-mark">AE</span>
                            <div>
                                <strong>ALAN ENGLISH</strong>
                                <small>LEARNING STARTS HERE</small>
                            </div>
                        </div>
                    </Offcanvas.Header>

                    <Offcanvas.Body>
                        <div className="showcase-mobile-intro">
                            <span>7-DAY GUIDED TRIAL</span>
                            <strong>先讓孩子找到每天願意持續的學習節奏。</strong>
                            <p>不需信用卡，也不會自動扣款。</p>
                        </div>

                        <Nav className="showcase-navbar-links ms-auto">
                            {navItems.map((item, index) => (
                                <Nav.Link
                                    key={item.label}
                                    className="showcase-navbar-link"
                                    href={item.href}
                                    onClick={closeMobileMenu}
                                >
                                    <span className="showcase-navbar-link-index">{String(index + 1).padStart(2, "0")}</span>
                                    <span className="showcase-navbar-link-copy">
                                        <strong>{item.label}</strong>
                                        <small>{item.hint}</small>
                                    </span>
                                    <BiChevronRight className="showcase-navbar-link-arrow" />
                                </Nav.Link>
                            ))}
                        </Nav>

                        <div className="showcase-navbar-actions">
                            <Link className="showcase-navbar-login" to="/login" onClick={closeMobileMenu}>
                                <BiLogIn />
                                登入
                            </Link>
                            <Link className="showcase-navbar-trial" to="/freetrial" onClick={closeMobileMenu}>
                                免費試用 7 天
                                <BiChevronRight />
                            </Link>
                        </div>
                    </Offcanvas.Body>
                </Navbar.Offcanvas>
            </Container>
        </Navbar>
    );
}

export default ShowcaseNavbar;
