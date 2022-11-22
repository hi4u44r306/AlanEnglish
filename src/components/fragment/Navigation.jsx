// import React, {useState} from "react";
// import { Link } from "react-router-dom";
// import firebase from 'firebase/app';
// import 'firebase/firestore';
// import Logout from "./Logout";
// import 'bootstrap/dist/css/bootstrap.min.css';
// import Container from 'react-bootstrap/Container';
// import Nav from 'react-bootstrap/Nav';
// import Navbar from 'react-bootstrap/Navbar';
// import NavDropdown from 'react-bootstrap/NavDropdown';
// import Offcanvas from 'react-bootstrap/Offcanvas';
// import '../assets/scss/Navigation.scss';
// import SearchBar from "./SearchBar";
// import { buildStyles, CircularProgressbarWithChildren } from 'react-circular-progressbar';
// import 'react-circular-progressbar/dist/styles.css';
// import Star from '../assets/img/star.png';






// function Navigation(user) {

//     const db = firebase.firestore();
//     const [navusername, setnavUsername] = useState();//避免使用innerHTML, textContext 所以用useState();
//     // const [updated, setUpdated] = useState();
//     const currentDate = new Date().toJSON().slice(0, 10);
//     const currentMonth = new Date().toJSON().slice(0, 7);
//     const [dailytimeplayed, setDailyTimeplayed] = useState();
//     const percentage = dailytimeplayed*100/20;
//     const custompathColor = `#89aae6`
//     const getUserInfo = (user) =>{  //從firestore取得 student 集合中選取符合user.uid的資訊
//         if(user){
//             db.collection('student').doc(user.uid).get().then( doc => {
//                 setnavUsername(doc.data().name)
//                 // if(doc.data().Resetallmusic === currentMonth+'alreadyupdated'){
//                   // setUpdated(`${currentMonth}'月次數已歸零'`)
//                 // }else{
//                   // setUpdated('尚未歸零')
//                 // }
//             }, err =>{
//                 console.log(err.message);
//             });
//             db.collection('student').doc(user.uid).collection('Logfile').doc(currentMonth).collection(currentMonth).doc(currentDate).get().then((doc)=>{
//               setDailyTimeplayed(doc.data().todaytotaltimeplayed);
//             }).catch(()=>{
//                 setDailyTimeplayed("0")
//             })
//         }else{
    
//         }
//       }    
    
//         firebase.auth().onAuthStateChanged(user => {
//             if(user){
//                 db.collection('student').onSnapshot(snapshot =>{
//                     getUserInfo(user);
//                 }, err =>{
//                     console.log(err.message);
//                 });
//             }else{
//                 getUserInfo();
//             }
//         })
    
//   return (
//     <div>
//         <Navbar collapseOnSelect className="navbackground">
//           <Container fluid>
//                 <Navbar.Brand as={Link} to="/home/leaderboard" className="brand">
//                     <span>A</span>
//                     <span>L</span>
//                     <span>A</span>
//                     <span>N</span>
//                     <span> </span>
//                     <span>E</span>
//                     <span>N</span>
//                     <span>G</span>
//                     <span>L</span>
//                     <span>I</span>
//                     <span>S</span>
//                     <span>H</span>
//                 </Navbar.Brand>
                
//             <Navbar.Toggle className="toggle" aria-controls={`offcanvasNavbar-expand`} />
//             <Navbar.Offcanvas
//               id={`offcanvasNavbar-expand`}
//               aria-labelledby={`offcanvasNavbarLabel-expand`}
//               placement="end"
//             >
//               <Offcanvas.Header closeButton>
//                 <Offcanvas.Title id={`offcanvasNavbarLabel-expand`} className="brand" as={Link} to="/home">
//                     <span>A</span>
//                     <span>L</span>
//                     <span>A</span>
//                     <span>N</span>
//                     <span> </span>
//                     <span>E</span>
//                     <span>N</span>
//                     <span>G</span>
//                     <span>L</span>
//                     <span>I</span>
//                     <span>S</span>
//                     <span>H</span>
//                 </Offcanvas.Title>
//               </Offcanvas.Header>
//               <Offcanvas.Body className="navbackground">
//                 <Nav className="justify-content-end mx-3 flex-grow-1 d-flex align-items-center">
//                 Web
//                 <div className='navcurrentdaycircle'>
//                   <CircularProgressbarWithChildren value={percentage || 'Loading...'} 
//                       background
//                       styles={buildStyles({
//                           backgroundColor: 'white',
//                           textColor: "red",
//                           pathColor: "gold",
//                           trailColor: `${custompathColor}`
//                           })}
//                       >
//                       <img
//                       style={{ width: 20, marginTop: -5 }}
//                       src={Star}
//                       alt="star"
//                       />
//                       <div className={dailytimeplayed >= 20?'navdailycircletextcomplete':'navdailycircletextnotcomplete'}> X {dailytimeplayed || '0'} </div>
//                   </CircularProgressbarWithChildren>
//                 </div>
//                     <Nav.Link href="/home/userinfo" className="navlink">
//                     <div className="d-flex flex-column align-items-center">
//                       <p>
//                        {navusername || '----'} 
//                       </p>
//                     </div>
//                   </Nav.Link>
                  
//                   <Nav.Link as={Link} to="/home/leaderboard" className="navlinkscoreboard">
//                   🏆排行榜
//                   </Nav.Link>

//                   {/*                                    習作本                                   */}
//                   <NavDropdown 
//                     title="📘 習作本"
//                     id={`offcanvasNavbarDropdown-expand`}
//                     className="navlink"
//                   >
//                         <NavDropdown.Item as={Link} to="/home/playlist/Workbook_1" className="subnavlink">📘 習作本1</NavDropdown.Item>
//                         <NavDropdown.Item as={Link} to="/home/playlist/Workbook_2" className="subnavlink">📘 習作本2</NavDropdown.Item>
//                         <NavDropdown.Item as={Link} to="/home/playlist/Workbook_3" className="subnavlink">📘 習作本3</NavDropdown.Item>
//                         <NavDropdown.Item as={Link} to="/home/playlist/Workbook_4" className="subnavlink">📘 習作本4 建構中...</NavDropdown.Item>
//                         <NavDropdown.Item as={Link} to="/home/playlist/Workbook_5" className="subnavlink">📘 習作本5 建構中...</NavDropdown.Item>
//                         <NavDropdown.Item as={Link} to="/home/playlist/Workbook_6" className="subnavlink">📘 習作本6 建構中...</NavDropdown.Item>
//                   </NavDropdown>



//                   {/*                                    聽力本                                     */}
//                   <NavDropdown
//                     title="📗 聽力本"
//                     id={`offcanvasNavbarDropdown-expand`}
//                     className="navlink"
//                   >
//                     {/*                              習作本 1                                   */}
//                     {['end'].map((direction) => (
//                             <NavDropdown 
//                               className="navlink"
//                               key={direction}
//                               // id={`dropdown-button-drop-${direction}`}
//                               drop={direction}
//                               // variant="secondary"
//                               title={` 📗 習作本1專用聽力本 `}
//                             >
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_1" className="subnavlink">📙 聽力本1 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_2" className="subnavlink">📙 聽力本2 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_3" className="subnavlink">📙 聽力本3 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_4" className="subnavlink">📙 聽力本4 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_5" className="subnavlink">📙 聽力本5 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_6" className="subnavlink">📙 聽力本6 建構中...</NavDropdown.Item>
                        
//                             </NavDropdown>
                            

                            
//                           ))}
//                    {/*                             習作本 2                                  */}
//                    {['end'].map((direction) => (
//                             <NavDropdown 
//                               className="navlink"
//                               key={direction}
//                               // id={`dropdown-button-drop-${direction}`}
//                               drop={direction}
//                               // variant="secondary"
//                               title={` 📗 習作本2專用聽力本 `}
//                             >
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_1" className="subnavlink">📙 聽力本1 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_2" className="subnavlink">📙 聽力本2 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_3" className="subnavlink">📙 聽力本3 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_4" className="subnavlink">📙 聽力本4 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_5" className="subnavlink">📙 聽力本5 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_6" className="subnavlink">📙 聽力本6 建構中...</NavDropdown.Item>
                        
//                             </NavDropdown>
                            

                            
//                           ))}

//                    {/*                             習作本 3                                  */}
//                    {['end'].map((direction) => (
//                             <NavDropdown 
//                               className="navlink"
//                               key={direction}
//                               // id={`dropdown-button-drop-${direction}`}
//                               drop={direction}
//                               // variant="secondary"
//                               title={` 📗 習作本3專用聽力本 `}
//                             >
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_1" className="subnavlink">📙 聽力本1 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_2" className="subnavlink">📙 聽力本2 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_3" className="subnavlink">📙 聽力本3 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_4" className="subnavlink">📙 聽力本4 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_5" className="subnavlink">📙 聽力本5 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_6" className="subnavlink">📙 聽力本6 建構中...</NavDropdown.Item>
                        
//                             </NavDropdown>
                            

                            
//                           ))}

//                   {/*                              習作本 4                                  */}
//                   {['end'].map((direction) => (
//                             <NavDropdown 
//                               className="navlink"
//                               key={direction}
//                               // id={`dropdown-button-drop-${direction}`}
//                               drop={direction}
//                               // variant="secondary"
//                               title={` 📗 習作本4專用聽力本 `}
//                             >
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_1" className="subnavlink">📙 聽力本1 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_2" className="subnavlink">📙 聽力本2 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_3" className="subnavlink">📙 聽力本3 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_4" className="subnavlink">📙 聽力本4 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_5" className="subnavlink">📙 聽力本5 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_6" className="subnavlink">📙 聽力本6 建構中...</NavDropdown.Item>
                        
//                             </NavDropdown>
                            

                            
//                           ))}
//                   {/*                              習作本 5                                  */}
//                   {['end'].map((direction) => (
//                             <NavDropdown 
//                               className="navlink"
//                               key={direction}
//                               // id={`dropdown-button-drop-${direction}`}
//                               drop={direction}
//                               // variant="secondary"
//                               title={` 📗 習作本5專用聽力本 `}
//                             >
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_1" className="subnavlink">📙 聽力本1 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_2" className="subnavlink">📙 聽力本2 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_3" className="subnavlink">📙 聽力本3 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_4" className="subnavlink">📙 聽力本4 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_5" className="subnavlink">📙 聽力本5 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_6" className="subnavlink">📙 聽力本6 建構中...</NavDropdown.Item>
                        
//                             </NavDropdown>
                            

                            
//                           ))}
//                   {/*                              習作本 6                                  */}
//                   {['end'].map((direction) => (
//                             <NavDropdown 
//                               className="navlink"
//                               key={direction}
//                               // id={`dropdown-button-drop-${direction}`}
//                               drop={direction}
//                               // variant="secondary"
//                               title={` 📗 習作本6專用聽力本 `}
//                             >
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_1" className="subnavlink">📙 聽力本1 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_2" className="subnavlink">📙 聽力本2 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_3" className="subnavlink">📙 聽力本3 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_4" className="subnavlink">📙 聽力本4 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_5" className="subnavlink">📙 聽力本5 建構中...</NavDropdown.Item>
//                              <NavDropdown.Item as={Link} to="/home/playlist/Listening_6" className="subnavlink">📙 聽力本6 建構中...</NavDropdown.Item>
                        
//                             </NavDropdown>
                            

                            
//                           ))}
                  
//                   </NavDropdown>
                  

//                   {/*                                    閱讀聽力                                     */}
//                   <NavDropdown
//                     title="📚 閱讀&聽力"
//                     id={`offcanvasNavbarDropdown-expand`}
//                     className="navlink"
//                   >
//                     <NavDropdown.Item as={Link} to="/home/playlist/SER1" className="subnavlink">📚 Super Easy Reading 3e 1</NavDropdown.Item>
//                     <NavDropdown.Item as={Link} to="/home/playlist/STEAM1" className="subnavlink">📚 Steam Reading E1</NavDropdown.Item>
//                     <NavDropdown.Item as={Link} to="/home/playlist/SARC1" className="subnavlink">📚 Short Articles Reading 1"</NavDropdown.Item>
//                     <NavDropdown.Item as={Link} to="/home/playlist/RL2" className="subnavlink">📚 Reading Lamp 2</NavDropdown.Item>
//                     <NavDropdown.Item as={Link} to="/home/playlist/Skyline1" className="subnavlink">📚 Skyline1</NavDropdown.Item>
//                     <NavDropdown.Item as={Link} to="/home/playlist/Skyline2" className="subnavlink">📚 Skyline2</NavDropdown.Item>
//                     <NavDropdown.Item as={Link} to="/home/playlist/Skyline3" className="subnavlink">📚 Skyline3</NavDropdown.Item>
//                   </NavDropdown>

//                     {/*                                    更多                                   */}
//                   <NavDropdown 
//                     title="👍 更多"
//                     id={`offcanvasNavbarDropdown-expand`}
//                     className="navlink"
//                   >
//                       <NavDropdown.Item as={Link} to="/home/about" className="subnavlink">🔎 關於</NavDropdown.Item>
//                       <NavDropdown.Item as={Link} to="/home/userinfo" className="subnavlink">📁 學生檔案</NavDropdown.Item>
//                       <NavDropdown.Item as={Link} to="/home/contact" className="subnavlink">📩 聯絡我們</NavDropdown.Item>
//                   </NavDropdown>

//                 </Nav>
                
//                 {/*                                     搜尋欄位                         */}
//                 <div className="justify-content-center d-flex align-items-center">
//                    <SearchBar/>
//                 </div> 
//                 {/*                                     登出                         */}
//                 <Logout/>

//               </Offcanvas.Body>
//             </Navbar.Offcanvas>
//           </Container>
//         </Navbar>
//     </div>
//   );
// }

// export default Navigation;