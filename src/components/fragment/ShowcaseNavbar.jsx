import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useEffect, useState } from 'react';
import { Container, Nav, NavLink, Navbar, Offcanvas } from 'react-bootstrap';
import Brand from './Brand';
import Menu from '../assets/img/menu.png';
import '../assets/scss/ShowcaseNavbar.scss';
import { BiLogIn } from 'react-icons/bi'
import { Link } from 'react-router-dom/cjs/react-router-dom.min';

function ShowcaseNavbar({ nav1, nav2, nav3, nav4 }) {
    const [scrolled, setScrolled] = useState(false);

    // Function to handle the scroll event
    const handleScroll = () => {
        if (window.scrollY > 100) {
            setScrolled(true);
        } else {
            setScrolled(false);
        }
    };

    useEffect(() => {
        // Add a scroll event listener when the component mounts
        window.addEventListener('scroll', handleScroll);

        // Remove the scroll event listener when the component unmounts
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <>
            {['xl'].map((expand) => (
                <Navbar collapseOnSelect={true} key={expand} expand={expand} className={`showcasenavbar ${scrolled ? 'scrolled' : ''}`}>
                    <Container>
                        <Navbar.Brand className="brand">
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
                            <Offcanvas.Header closeButton>
                                <Offcanvas.Title className="brand" id={`offcanvasNavbarLabel-expand-${expand}`}>
                                    <Brand />
                                </Offcanvas.Title>
                            </Offcanvas.Header>
                            <Offcanvas.Body className="navbackground">
                                <Nav className={`showcasenavbar ${scrolled ? 'scrolled' : ''}`}>
                                    <NavLink className='showcasenavlink' href={nav1}>{nav1.slice(1)}</NavLink>
                                    <NavLink className='showcasenavlink' href={nav2}>{nav2.slice(1)}</NavLink>
                                    <NavLink className='showcasenavlink' href={nav3}>{nav3.slice(1)}</NavLink>
                                    <NavLink className='showcasenavlink' href={nav4}>{nav4.slice(1)}</NavLink>
                                    <NavLink className='showcase-loginbtn' as={Link} href="/" to="/">
                                        <BiLogIn />
                                        Login
                                    </NavLink>
                                    <NavLink className='showcase-tryforfreebtn' as={Link} href="/freetrial" to="/freetrial">
                                        開通帳號
                                    </NavLink>
                                </Nav>
                            </Offcanvas.Body>
                        </Navbar.Offcanvas>
                    </Container>
                </Navbar>
            ))}
        </>
    );
}

export default ShowcaseNavbar;
