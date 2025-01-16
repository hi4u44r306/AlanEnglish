import React, { useEffect, useState } from "react";
import 'firebase/firestore';
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Offcanvas from 'react-bootstrap/Offcanvas';
import '../assets/scss/Navigation.scss';
// import SearchBar from "./SearchBar";
import 'react-circular-progressbar/dist/styles.css';
import BlueBook from '../assets/img/blue book.png';
import Books from '../assets/img/books.png';
import Search from '../assets/img/search.png';
import File from '../assets/img/file.png';
// import Mail from '../assets/img/mail.png';
// import Trophy from '../assets/img/trophy.png';
import Menu from '../assets/img/menu.png';
import Setting from '../assets/img/setting.png';
import Goldflower from '../assets/img/goldflower.png';
import { Link } from "react-router-dom";
import Brand from "./Brand";
// import { FcApproval } from "react-icons/fc";


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
    { name: '習作本1', path: '習作本1' },
    { name: '習作本2', path: '習作本2' },
    { name: '習作本3', path: '習作本3' },
    { name: '習作本4', path: '習作本4' },
    { name: '習作本5', path: '習作本5' },
    { name: '習作本6 建構中...', path: '習作本6' },
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

  const ListeningBooks = [
    { name: '聽力本1', path: 'Listeningbook_1' },
    { name: '聽力本2', path: 'Listeningbook_2' },
    { name: '聽力本3', path: 'Listeningbook_3' },
    { name: '聽力本4', path: 'Listeningbook_4' },
    { name: '聽力本5', path: 'Listeningbook_5' },
    { name: '聽力本6 建構中...', path: 'Listeningbook_6' },
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
                <Offcanvas.Title className="brand" as={Link} to="/home/playlist/userinfo" href="/home/playlist/userinfo" id={`offcanvasNavbarLabel-expand-${expand}`}>
                  <Brand />
                </Offcanvas.Title>
              </Offcanvas.Header>

              <Offcanvas.Body className={`navbackground ${scrolled ? 'scrolled' : ''}`} >
                <Nav className="studentnavbar">




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

                  {/* 聽力本 */}

                  <NavDropdown
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                    title={
                      <div className="d-flex align-items-center">
                        <img style={{ width: 18, marginRight: 4 }} src={BlueBook} alt="bluebook" />
                        聽力本
                      </div>
                    }
                    className="navlink"
                  >
                    {ListeningBooks.map((workbook, index) => (
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

                  {/* 習作本 */}
                  {
                    localStorage.getItem('ae-plan') === 'listeningonly' ?
                      ''
                      :
                      <NavDropdown
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
                  }

                  {/* 課本 */}
                  {
                    localStorage.getItem('ae-plan') === 'listeningonly' ?
                      ''
                      :
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
                  }

                  <Nav.Link as={Link} to="/home/playlist/userinfo" href="/home/playlist/userinfo" className="navlinkscoreboard">
                    <div className="username">
                      <img style={{ width: 18, marginRight: 4 }}
                        src={File}
                        alt="bluebook"
                      /> 學生檔案
                    </div>
                  </Nav.Link>

                  <Nav.Link as={Link} to="/home/playlist/about" href="/home/playlist/about" className="navlinkscoreboard">
                    <div className="username">
                      <img style={{ width: 18, marginRight: 4 }}
                        src={Search}
                        alt="bluebook"
                      />  關於AE
                    </div>
                  </Nav.Link>

                  {/* 用戶資料 */}
                  <Nav.Link className="navlinkscoreboard">
                    <div className="username">
                      {navusername || '----'}
                    </div>
                  </Nav.Link>
                </Nav>


                {/* <div className="justify-content-center d-flex align-items-center ">
                  <SearchBar />
                </div> */}

              </Offcanvas.Body>
            </Navbar.Offcanvas>
          </Container>
        </Navbar>
      ))}
    </div>
  );
}

export default StudentNavigationBar;