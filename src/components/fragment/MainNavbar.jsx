import React, { useEffect, useState } from "react";
import 'firebase/firestore';
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
// import Goldflower from '../assets/img/goldflower.png';
import { Link } from "react-router-dom";
import Brand from "./Brand";


function MainNavbar() {

  // const navusername = localStorage.getItem('ae-username');
  const [scrolled, setScrolled] = useState(false);

  // const [navData, setNavData] = useState({});
  const navItems = JSON.parse(localStorage.getItem('ae-NavItems'));
  const navData = JSON.parse(localStorage.getItem('ae-navData'));
  // const [navItems, setNavItems] = useState([]);



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

  const renderNavDropdown = (type) => {
    return (
      <NavDropdown
        id={`${type}Dropdown`}
        key={`${type}Dropdown`}
        title={
          <div className="d-flex align-items-center">
            <img style={{ width: 18, marginRight: 4 }} src={Books} alt="books" />
            {type}
          </div>
        }
        className="navlink"
        align="end" // 新增這行，讓下拉選單對齊右側，避免手機消失
      >
        {/* Check if navData[type] is defined before mapping */}
        {navData[type] && navData[type].map((category, index) => (
          // Check if `category.items` exists and render either directly or in a nested dropdown
          category.items && category.items.length > 0 ? (
            <NavDropdown
              key={index}
              title={
                <div className="d-flex align-items-center">
                  <img style={{ width: 18, marginRight: 4 }}
                    src={Books}
                    alt="books"
                  />
                  {category.title}
                </div>
              }
            >
              {category.items.map((item, idx) => (
                <NavDropdown.Item
                  key={idx}
                  as={Link}
                  to={`/home/playlist/${item.path}`}
                  className="subnavlink"
                >
                  <img style={{ width: 18, marginRight: 4 }}
                    src={BlueBook}
                    alt="BlueBook"
                  />
                  {item.name}
                </NavDropdown.Item>
              ))}
            </NavDropdown>
          ) : (
            <NavDropdown.Item
              key={index}
              as={Link}
              to={`/home/playlist/${category.path}`}
              className="subnavlink"
            >
              <img style={{ width: 18, marginRight: 4 }}
                src={BlueBook}
                alt="BlueBook"
              />
              {category.name}
            </NavDropdown.Item>
          )
        ))}
      </NavDropdown>
    );
  };


  return (
    <div>
      {['xl'].map((expand) => (
        <Navbar collapseOnSelect={true} key={expand} expand={expand} className={`navbackground ${scrolled ? 'scrolled' : ''}`}>

          <Container fluid className="containerfluid">

            <Navbar.Brand as={Link} to="/home/playlist/userinfo" href="/home/playlist/userinfo">
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
                {/* <Offcanvas.Title className="brand" as={Link} to="/home/playlist/userinfo" href="/home/playlist/userinfo" id={`offcanvasNavbarLabel-expand-${expand}`}>
                  <Brand />
                </Offcanvas.Title> */}
              </Offcanvas.Header>

              <Offcanvas.Body className={`navbackground ${scrolled ? 'scrolled' : ''} d-flex flex-column align-items-center justify-content-center`}>

                <Nav>


                  {/* 教師主控台 */}
                  {
                    localStorage.getItem('ae-class') !== 'Teacher' ?
                      ''
                      :
                      <NavDropdown
                        title=
                        {
                          <div className="d-flex align-items-center">
                            <img style={{ width: 18, marginRight: 4 }}
                              src={Books}
                              alt="bluebook"
                            />
                            教師用
                          </div>
                        }
                        id={`offcanvasNavbarDropdown-expand-${expand}`}
                        className="navlink"
                      >
                        <NavDropdown.Item as={Link} to="/home/playlist/editnavbar" href="/home/playlist/editnavbar" className="subnavlink">
                          <img style={{ width: 18, marginRight: 4 }}
                            src={Setting}
                            alt="setting"
                          />編輯Navbar
                        </NavDropdown.Item>

                        <NavDropdown.Item as={Link} to="/home/playlist/addmusic" href="/home/playlist/addmusic" className="subnavlink">
                          <img style={{ width: 18, marginRight: 4 }}
                            src={Setting}
                            alt="setting"
                          />新增音檔
                        </NavDropdown.Item>

                        <NavDropdown.Item as={Link} to="/home/playlist/controlpanel" href="/home/playlist/controlpanel" className="subnavlink">
                          <img style={{ width: 18, marginRight: 4 }}
                            src={Setting}
                            alt="setting"
                          />控制台
                        </NavDropdown.Item>

                        <NavDropdown.Item as={Link} to="/home/playlist/signup" href="/home/playlist/signup" className="subnavlink">
                          <img style={{ width: 18, marginRight: 4 }}
                            src={Setting}
                            alt="setting"
                          />新增學生帳號
                        </NavDropdown.Item>

                        {/* 排行榜 */}
                        {/* <NavDropdown.Item as={Link} to="/home/playlist/leaderboard" href="/home/playlist/leaderboard" className="subnavlink">
                          <img style={{ width: 18, marginRight: 4 }}
                            src={Trophy}
                            alt="bluebook"
                          />排行榜
                        </NavDropdown.Item> */}
                      </NavDropdown>
                  }

                  {/* 測試 */}
                  {
                    navItems.map((item) =>
                      renderNavDropdown(item)
                    )
                  }

                  <Nav.Link as={Link} to="/home/playlist/userinfo" href="/home/playlist/userinfo" className="navlink nav-item dropdown">
                    <div className="username">
                      <img style={{ width: 18, marginRight: 4 }}
                        src={File}
                        alt="bluebook"
                      /> 學生檔案
                    </div>
                  </Nav.Link>

                  <Nav.Link as={Link} to="/home/playlist/about" href="/home/playlist/about" className="navlink nav-item dropdown">
                    <div className="username">
                      <img style={{ width: 18, marginRight: 4 }}
                        src={Search}
                        alt="bluebook"
                      />  關於AE
                    </div>
                  </Nav.Link>

                  {/* 用戶資料 */}
                  {/* <Nav.Link className="navlinkscoreboard">
                    <div className="username">
                      {navusername || '----'}
                    </div>
                  </Nav.Link> */}
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


