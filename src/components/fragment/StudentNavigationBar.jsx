import React, { useEffect, useState } from "react";
import 'firebase/firestore';
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Offcanvas from 'react-bootstrap/Offcanvas';
import '../assets/scss/Navigation.scss';
import SearchBar from "./SearchBar";
import 'react-circular-progressbar/dist/styles.css';
import BlueBook from '../assets/img/blue book.png';
import Books from '../assets/img/books.png';
import ThumbUp from '../assets/img/thumbup.png';
import Search from '../assets/img/search.png';
import File from '../assets/img/file.png';
import Mail from '../assets/img/mail.png';
import Trophy from '../assets/img/trophy.png';
import Menu from '../assets/img/menu.png';
import Setting from '../assets/img/setting.png';
import Goldflower from '../assets/img/goldflower.png';
import { Link } from "react-router-dom";
import Brand from "./Brand";


function StudentNavigationBar() {

  const navusername = localStorage.getItem('ae-username');
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

  const workbooks = [
    { name: '習作本1', path: 'Workbook_1' },
    { name: '習作本2', path: 'Workbook_2' },
    { name: '習作本3', path: 'Workbook_3' },
    { name: '習作本4', path: 'Workbook_4' },
    { name: '習作本5', path: 'Workbook_5' },
    { name: '習作本6 建構中...', path: 'Workbook_6' },
  ];

  const ReadingBooks = [
    {
      title: 'Super Easy Reading',
      items: [
        { name: 'Super Easy Reading 3e 1', path: 'SER1', icon: Goldflower },
        { name: 'Super Easy Reading 3e 2', path: 'SER2', icon: Goldflower },
        { name: 'Super Easy Reading 3e 3', path: 'SER3', icon: Goldflower },
      ],
    },
    {
      title: 'Steam Reading',
      items: [
        { name: 'Steam Reading E1', path: 'STEAM1', icon: Goldflower },
        { name: 'Steam Reading E2', path: 'STEAM2', icon: Goldflower },
        { name: 'Steam Reading E3', path: 'STEAM3', icon: Goldflower },
      ],
    },
    {
      title: 'Reading Lamp',
      items: [
        { name: 'Reading Lamp 1 Reading', path: 'RL1Reading', icon: Goldflower },
        { name: 'Reading Lamp 2 Reading', path: 'RL2Reading', icon: Goldflower },
        { name: 'Reading Lamp 3 Reading', path: 'RL3Reading', icon: Goldflower },
      ],
    },
    {
      title: 'Skyline',
      items: [
        { name: 'Skyline 1', path: 'Skyline1', icon: Goldflower },
        { name: 'Skyline 2', path: 'Skyline2', icon: Goldflower },
        { name: 'Skyline 3', path: 'Skyline3', icon: Goldflower },
      ],
    },
    {
      title: 'Reading Table',
      items: [
        { name: 'Reading Table 1', path: 'ReadingTable1', icon: Goldflower },
        { name: 'Reading Table 2', path: 'ReadingTable2', icon: Goldflower },
        { name: 'Reading Table 3', path: 'ReadingTable3', icon: Goldflower },
      ],
    },
    {
      title: 'Short Articles Reading',
      items: [
        { name: 'Short Articles Reading 1', path: 'SARC1', icon: Goldflower },
      ],
    },
  ];


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
                <Offcanvas.Title className="brand" as={Link} to="/home/playlist/SER1" href="/home/playlist/SER1" id={`offcanvasNavbarLabel-expand-${expand}`}>
                  <Brand />
                </Offcanvas.Title>
              </Offcanvas.Header>

              <Offcanvas.Body className={`navbackground ${scrolled ? 'scrolled' : ''}`} >
                <Nav className="studentnavbar">

                  {/* 用戶資料 */}
                  <Nav.Link as={Link} to="/home/playlist/userinfo" href="/home/playlist/userinfo" className="navlinkscoreboard">
                    <div className="usernavlink">
                      <div className="username">
                        {navusername || '----'}
                      </div>
                    </div>
                  </Nav.Link>


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
                        <NavDropdown.Item as={Link} to="/home/playlist/signup" href="/home/playlist/signup" className="subnavlink">
                          <img style={{ width: 18, marginRight: 4 }}
                            src={Setting}
                            alt="setting"
                          />新增學生帳號
                        </NavDropdown.Item>

                        {/* 排行榜 */}
                        <NavDropdown.Item as={Link} to="/home/playlist/leaderboard" href="/home/playlist/leaderboard" className="subnavlink">
                          <img style={{ width: 18, marginRight: 4 }}
                            src={Trophy}
                            alt="bluebook"
                          />排行榜
                        </NavDropdown.Item>
                      </NavDropdown>
                  }

                  {/* 習作本 */}

                  <NavDropdown
                    key={'end'}
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                    title={
                      <div className="d-flex align-items-center">
                        <img style={{ width: 18, marginRight: 4 }} src={BlueBook} alt="bluebook" />
                        習作本
                      </div>
                    }
                    className="navlink"
                  >
                    {workbooks.map((workbook, index) => (
                      <NavDropdown.Item
                        key={index}
                        as={Link}
                        to={`/home/playlist/${workbook.path}`}
                        href={`/home/playlist/${workbook.path}`}
                        className="subnavlink"
                      >
                        <img style={{ width: 18, marginRight: 4 }} src={BlueBook} alt="bluebook" /> {workbook.name}
                      </NavDropdown.Item>
                    ))}
                  </NavDropdown>

                  {/* 課本 */}
                  <NavDropdown
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                    title={
                      <div className="d-flex align-items-center">
                        <img style={{ width: 18, marginRight: 4 }} src={Books} alt="books" />
                        課本
                      </div>
                    }
                    className="navlink"
                  >
                    {ReadingBooks.map((category, index) => (
                      <NavDropdown
                        key={index}
                        className="navlink"
                        title={
                          <div className="d-flex align-items-center">
                            <img style={{ width: 18, marginRight: 4 }} src={Books} alt="books" />
                            {category.title}
                          </div>
                        }
                      >
                        {category.items.map((item, idx) => (
                          <NavDropdown.Item
                            key={idx}
                            as={Link}
                            to={`/home/playlist/${item.path}`}
                            href={`/home/playlist/${item.path}`}
                            className="subnavlink"
                          >
                            <img style={{ width: 18, marginRight: 4 }} src={item.icon || Books} alt="book" /> {item.name}
                          </NavDropdown.Item>
                        ))}
                      </NavDropdown>
                    ))}
                  </NavDropdown>

                  {/* 更多 */}
                  <NavDropdown
                    title=
                    {
                      <div className="d-flex align-items-center">
                        <img style={{ width: 18, marginRight: 4 }}
                          src={ThumbUp}
                          alt="bluebook"
                        />
                        更多
                      </div>
                    }
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                    className="navlink"
                  >
                    <NavDropdown.Item as={Link} to="/home/playlist/about" href="/home/playlist/about" className="subnavlink">
                      <img style={{ width: 18, marginRight: 4 }}
                        src={Search}
                        alt="bluebook"
                      /> 關於</NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/home/playlist/userinfo" href="/home/playlist/userinfo" className="subnavlink">
                      <img style={{ width: 18, marginRight: 4 }}
                        src={File}
                        alt="bluebook"
                      /> 學生檔案</NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/home/playlist/contact" href="/home/playlist/contact" className="subnavlink">
                      <img style={{ width: 18, marginRight: 4 }}
                        src={Mail}
                        alt="bluebook"
                      /> 聯絡我們</NavDropdown.Item>
                  </NavDropdown>
                </Nav>

                <div className="justify-content-center d-flex align-items-center ">
                  <SearchBar />
                </div>

              </Offcanvas.Body>
            </Navbar.Offcanvas>
          </Container>
        </Navbar>
      ))}
    </div>
  );
}

export default StudentNavigationBar;