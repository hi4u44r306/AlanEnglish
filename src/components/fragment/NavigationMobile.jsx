import React, {useState} from "react";
import firebase from 'firebase/app';
import 'firebase/firestore';
import Logout from "./Logout";
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Offcanvas from 'react-bootstrap/Offcanvas';
import '../assets/scss/Navigation.scss';
import SearchBar from "./SearchBar";
// import { buildStyles, CircularProgressbarWithChildren } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
// import Star from '../assets/img/star.png';
// import GreenBook from '../assets/img/green book.png';
import BlueBook from '../assets/img/blue book.png';
import OrangeBook from '../assets/img/orange book.png';
import Books from '../assets/img/books.png';
import ThumbUp from '../assets/img/thumbup.png';
import Search from '../assets/img/search.png';
import File from '../assets/img/file.png';
import Mail from '../assets/img/mail.png';
import Trophy from '../assets/img/trophy.png';
import Menu from '../assets/img/menu.png';
import { Link } from "react-router-dom";
import Brand from "./Brand";




function NavigationMobile() {

  const db = firebase.firestore();
  const [navusername, setnavUsername] = useState();//避免使用innerHTML, textContext 所以用useState();
  // const [updated, setUpdated] = useState();
  // const currentDate = new Date().toJSON().slice(0, 10);
  // const currentMonth = new Date().toJSON().slice(0, 7);
  // const [dailytimeplayed, setDailyTimeplayed] = useState();
  // const percentage = dailytimeplayed*100/20;
  // const custompathColor = `#89aae6`

  const getUserInfo = (user) =>{  //從firestore取得 student 集合中選取符合user.uid的資訊
    if(user){
        db.collection('student').doc(user.uid).get().then( doc => {
            setnavUsername(doc.data().name)
            // if(doc.data().Resetallmusic === currentMonth+'alreadyupdated'){
              // setUpdated(`${currentMonth}'月次數已歸零'`)
            // }else{
              // setUpdated('尚未歸零')
            // }
        }, err =>{
            console.log(err.message);
        });
        // db.collection('student').doc(user.uid).collection('Logfile').doc(currentMonth).collection(currentMonth).doc(currentDate).get().then((doc)=>{
        //   setDailyTimeplayed(doc.data().todaytotaltimeplayed);
        // }).catch(()=>{
        //     setDailyTimeplayed("0")
        // })
    }else{

    }
  }    

    firebase.auth().onAuthStateChanged(user => {
        if(user){
            db.collection('student').onSnapshot(snapshot =>{
                getUserInfo(user);
            }, err =>{
                console.log(err.message);
            });
        }else{
            getUserInfo();
        }
    })

    
  return (
    <div>
      {['xl'].map((expand) => (
        <Navbar collapseOnSelect={true} key={expand} expand={expand} className="navbackground">
          <Container fluid className="containerfluid">

            <Navbar.Brand as={Link} to="/home/leaderboard" href="/home/leaderboard" className="brand">
             <Brand/>
            </Navbar.Brand>

            <Navbar.Toggle className="toggle" aria-controls={`offcanvasNavbar-expand-${expand}`}>
              <img style={{width: 40, height: 40}} src={Menu} alt="menu"/>
            </Navbar.Toggle>

            <Navbar.Offcanvas
              id={`offcanvasNavbar-expand-${expand}`}
              aria-labelledby={`offcanvasNavbarLabel-expand-${expand}`}
              placement="end"
            >
              <Offcanvas.Header closeButton>
                <Offcanvas.Title className="brand" as={Link} to="/home/leaderboard" href="/home/leaderboard" id={`offcanvasNavbarLabel-expand-${expand}`}>
                  <Brand/>
                </Offcanvas.Title>
              </Offcanvas.Header>

              <Offcanvas.Body className="navbackground">
                <Nav className="d-flex align-items-center justify-content-end flex-grow-1">

                  {/* 星星圓形 */}
                  {/* <div className='navcurrentdaycircle'>
                    <CircularProgressbarWithChildren value={percentage || 'Loading...'} 
                        background
                        styles={buildStyles({
                            backgroundColor: 'white',
                            textColor: "red",
                            pathColor: "gold",
                            trailColor: `${custompathColor}`
                            })}
                        >
                        <img
                        style={{ width: 20, marginTop: -5 }}
                        src={Star}
                        alt="star"
                        />
                        <div className={dailytimeplayed >= 20?'navdailycircletextcomplete':'navdailycircletextnotcomplete'}> X {dailytimeplayed || '0'} </div>
                    </CircularProgressbarWithChildren>
                  </div> */}

                  {/* 用戶資料 */}
                  <Nav.Link as={Link} to="/home/userinfo" href="/home/userinfo" className="navlinkscoreboard">
                    <div className="username">
                      <p>
                       {navusername || '----'} 
                      </p>
                    </div>
                  </Nav.Link>

                  {/* 排行榜 */}
                  <Nav.Link as={Link} to="/home/leaderboard" href="/home/leaderboard" className="navlinkscoreboard">
                  <img style={{ width: 18, marginRight: 4 }} 
                      src={Trophy} 
                      alt="bluebook"
                  />排行榜
                  </Nav.Link>
                  
                  {/* 聽力本 */}
                  <NavDropdown
                    title=
                    {
                    <div className="d-flex align-items-center">
                      <img style={{ width: 18, marginRight: 4 }} 
                          src={OrangeBook} 
                          alt="bluebook"
                      />
                      聽力本
                    </div>
                    } 
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                    className="navlink"
                  >
                  {/*                             聽力本習作本 1                                   */}
                    {['down'].map((direction) => (
                      <NavDropdown 
                        className="navlink"
                        key={direction}
                        drop={direction}
                        title=
                        {
                        <div className="d-flex align-items-center">
                          <img style={{ width: 18, marginRight: 4 }} 
                              src={OrangeBook} 
                              alt="bluebook"
                          />
                          習作本1專用聽力本
                        </div>
                        } 
                      >
                        <NavDropdown.Item as={Link} to="/home/playlist/Listening_1" href="/home/playlist/Listening_1" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                          src={OrangeBook} 
                          alt="bluebook"
                        />聽力本1 建構中...</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/Listening_2" href="/home/playlist/Listening_2" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                          src={OrangeBook} 
                          alt="bluebook"
                        /> 聽力本2 建構中...</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/Listening_3" href="/home/playlist/Listening_3" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                          src={OrangeBook} 
                          alt="bluebook"
                        /> 聽力本3 建構中...</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/Listening_4" href="/home/playlist/Listening_4" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                          src={OrangeBook} 
                          alt="bluebook"
                        /> 聽力本4 建構中...</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/Listening_5" href="/home/playlist/Listening_5" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                          src={OrangeBook} 
                          alt="bluebook"
                        /> 聽力本5 建構中...</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/Listening_6" href="/home/playlist/Listening_6"  className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                          src={OrangeBook} 
                          alt="bluebook"
                        /> 聽力本6 建構中...</NavDropdown.Item>
                  
                      </NavDropdown>
                    ))}
                  </NavDropdown>

                  {/* 習作本 */}
                  <NavDropdown
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                    title=
                    {
                    <div className="d-flex align-items-center">
                      <img style={{ width: 18, marginRight: 4 }} 
                          src={BlueBook} 
                          alt="bluebook"
                      />
                      習作本
                    </div>
                    } 
                    className="navlink"
                  >
                    <NavDropdown.Item as={Link} to="/home/playlist/Workbook_1" href="/home/playlist/Workbook_1" className="subnavlink">
                    <img
                    style={{ width: 18, marginRight: 4 }}
                    src={BlueBook}
                    alt="greenbook"
                    /> 習作本1
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/home/playlist/Workbook_2" href="/home/playlist/Workbook_2" className="subnavlink">
                    <img
                    style={{ width: 18, marginRight: 4 }}
                    src={BlueBook}
                    alt="greenbook"
                    />  習作本2</NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/home/playlist/Workbook_3" href="/home/playlist/Workbook_3" className="subnavlink">
                    <img
                    style={{ width: 18, marginRight: 4 }}
                    src={BlueBook}
                    alt="greenbook"
                    />  習作本3</NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/home/playlist/Workbook_4" href="/home/playlist/Workbook_4" className="subnavlink">
                    <img
                    style={{ width: 18, marginRight: 4 }}
                    src={BlueBook}
                    alt="greenbook"
                    />  習作本4 建構中...</NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/home/playlist/Workbook_5" href="/home/playlist/Workbook_5" className="subnavlink">
                    <img
                    style={{ width: 18, marginRight: 4 }}
                    src={BlueBook}
                    alt="greenbook"
                    />  習作本5 建構中...</NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/home/playlist/Workbook_6" href="/home/playlist/Workbook_6" className="subnavlink">
                    <img
                    style={{ width: 18, marginRight: 4 }}
                    src={BlueBook}
                    alt="greenbook"
                    />  習作本6 建構中...</NavDropdown.Item>
                  </NavDropdown>

                  {/* 課外聽力 */}
                  <NavDropdown
                    title=
                    {
                    <div className="d-flex align-items-center">
                      <img style={{ width: 18, marginRight: 4 }} 
                          src={Books} 
                          alt="bluebook"
                      />
                      課外聽力
                    </div>
                    } 
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                    className="navlink"
                  >
                    {/*                             Super Easy Reading 3e                                   */}
                    {['down'].map((direction) => (
                      <NavDropdown 
                        className="navlink"
                        key={direction}
                        drop={direction}
                        title=
                        {
                        <div className="d-flex align-items-center">
                          <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          />
                          Super Easy Reading
                        </div>
                        } 
                      >
                        <NavDropdown.Item as={Link} to="/home/playlist/SER1" href="/home/playlist/SER1" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Super Easy Reading 3e 1</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/SER2" href="/home/playlist/SER2" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          />Super Easy Reading 3e 2</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/SER3" href="/home/playlist/SER3" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Super Easy Reading 3e 3</NavDropdown.Item>
                  
                      </NavDropdown>
                    ))}

                    {/*                             Steam Reading                                   */}
                    {['down'].map((direction) => (
                      <NavDropdown 
                        className="navlink"
                        key={direction}
                        drop={direction}
                        title=
                        {
                        <div className="d-flex align-items-center">
                          <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          />
                          Steam Reading
                        </div>
                        } 
                      >
                        <NavDropdown.Item as={Link} to="/home/playlist/STEAM1" href="/home/playlist/STEAM1" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Steam Reading E1</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/STEAM2" href="/home/playlist/STEAM2" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Steam Reading E2</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/STEAM3" href="/home/playlist/STEAM3" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Steam Reading E3</NavDropdown.Item>
                  
                      </NavDropdown>
                    ))}

                    {/*                             Reading Lamp                                   */}
                    {['down'].map((direction) => (
                      <NavDropdown 
                        className="navlink"
                        key={direction}
                        drop={direction}
                        title=
                        {
                        <div className="d-flex align-items-center">
                          <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          />
                          Reading Lamp
                        </div>
                        } 
                      >
                        <NavDropdown.Item as={Link} to="/home/playlist/RL1Reading" href="/home/playlist/RL1Reading" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Reading Lamp 1 Reading</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/RL2Reading" href="/home/playlist/RL2Reading" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Reading Lamp 2 Reading</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/RL3Reading" href="/home/playlist/RL3Reading" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Reading Lamp 3 Reading</NavDropdown.Item>
                  
                      </NavDropdown>
                    ))}

                    {/*                             Skyline                                   */}
                    {['down'].map((direction) => (
                      <NavDropdown 
                        className="navlink"
                        key={direction}
                        drop={direction}
                        title=
                        {
                        <div className="d-flex align-items-center">
                          <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          />
                          Skyline
                        </div>
                        } 
                      >
                        <NavDropdown.Item as={Link} to="/home/playlist/Skyline1" href="/home/playlist/Skyline1" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Skyline1</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/Skyline2" href="/home/playlist/Skyline2" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Skyline2</NavDropdown.Item>
                        <NavDropdown.Item as={Link} to="/home/playlist/Skyline3" href="/home/playlist/Skyline3" className="subnavlink">
                        <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Skyline3</NavDropdown.Item>
                  
                      </NavDropdown>
                    ))}
                    
                    <NavDropdown.Item as={Link} to="/home/playlist/SARC1" className="subnavlink">
                    <img style={{ width: 18, marginRight: 4 }} 
                              src={Books} 
                              alt="bluebook"
                          /> Short Articles Reading 1</NavDropdown.Item>
                    
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
                      <NavDropdown.Item as={Link} to="/home/about" href="/home/about" className="subnavlink">
                      <img style={{ width: 18, marginRight: 4 }} 
                          src={Search} 
                          alt="bluebook"
                      /> 關於</NavDropdown.Item>
                      <NavDropdown.Item as={Link} to="/home/userinfo" href="/home/userinfo" className="subnavlink">
                      <img style={{ width: 18, marginRight: 4 }} 
                          src={File} 
                          alt="bluebook"
                      /> 學生檔案</NavDropdown.Item>
                      <NavDropdown.Item as={Link} to="/home/contact" href="/home/contact" className="subnavlink">
                      <img style={{ width: 18, marginRight: 4 }} 
                          src={Mail} 
                          alt="bluebook"
                      /> 聯絡我們</NavDropdown.Item>
                  </NavDropdown>

                </Nav>

                 {/*                                     搜尋欄位                         */}
                <div className="justify-content-center d-flex align-items-center">
                   <SearchBar/>
                </div> 
                {/*                                     登出                         */}
                <Logout/>
              </Offcanvas.Body>
            </Navbar.Offcanvas>
          </Container>
        </Navbar>
      ))}
    </div>
  );
}

export default NavigationMobile;