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
        { label: "關於 AE", href: nav1 },
        { label: "學習方式", href: nav2 },
        { label: "平台特色", href: nav3 },
        { label: "開始學習", href: nav4 }
    ];

    return (
        <Navbar
            expand="xl"
            className={`showcase-navbar ${scrolled ? "is-scrolled" : ""}`}
        >
            <Container className="showcase-navbar-container">
                <Navbar.Brand className="showcase-navbar-brand" as={Link} to="/showcase">
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
                >
                    <Offcanvas.Header closeButton>
                        <Offcanvas.Title
                            className="showcase-navbar-offcanvas-title"
                            id="showcase-navbar-offcanvas-label"
                        >
                            <Brand />
                        </Offcanvas.Title>
                    </Offcanvas.Header>

                    <Offcanvas.Body>
                        <Nav className="showcase-navbar-links ms-auto">
                            {navItems.map((item) => (
                                <Nav.Link
                                    key={item.label}
                                    className="showcase-navbar-link"
                                    href={item.href}
                                >
                                    {item.label}
                                </Nav.Link>
                            ))}
                        </Nav>

                        <div className="showcase-navbar-actions">
                            <Link className="showcase-navbar-login" to="/">
                                <BiLogIn />
                                登入
                            </Link>
                            <Link className="showcase-navbar-trial" to="/freetrial">
                                開通帳號
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
