import Logout from "./Logout";
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Offcanvas from 'react-bootstrap/Offcanvas';
import '../assets/scss/Navigation.scss';
import SearchBar from "./SearchBar";



function Navigation() {
    
  return (
    <>
      {['xl'].map((expand) => (
        <Navbar key={expand} expand={expand} className="navbackground">
          <Container fluid>
                <Navbar.Brand href="/home" className="brand">
                    <span>A</span>
                    <span>L</span>
                    <span>A</span>
                    <span>N</span>
                    <span> </span>
                    <span>E</span>
                    <span>N</span>
                    <span>G</span>
                    <span>L</span>
                    <span>I</span>
                    <span>S</span>
                    <span>H</span>
                </Navbar.Brand>
            <Navbar.Toggle className="toggle" aria-controls={`offcanvasNavbar-expand-${expand}`} />
            <Navbar.Offcanvas
              id={`offcanvasNavbar-expand-${expand}`}
              aria-labelledby={`offcanvasNavbarLabel-expand-${expand}`}
              placement="end"
            >
              <Offcanvas.Header closeButton>
                <Offcanvas.Title id={`offcanvasNavbarLabel-expand-${expand}`} className="brand" href="/home">
                    <span>A</span>
                    <span>L</span>
                    <span>A</span>
                    <span>N</span>
                    <span> </span>
                    <span>E</span>
                    <span>N</span>
                    <span>G</span>
                    <span>L</span>
                    <span>I</span>
                    <span>S</span>
                    <span>H</span>
                </Offcanvas.Title>
              </Offcanvas.Header>
              <Offcanvas.Body className="navbackground">
                <Nav className="justify-content-end mx-3 flex-grow-1 d-flex align-items-center">
                
                  <Nav.Link href="/home/about" className="navlink">
                    關於 
                  </Nav.Link>
                  <Nav.Link href="/home/contact" className="navlink">聯絡我們</Nav.Link>  

                  {/*                                    習作本                                   */}
                  <NavDropdown 
                    title="習作本"
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                    className="navlink"
                  >
                        <NavDropdown.Item href="/home/playlist/Workbook_1" className="subnavlink">習作本1 建構中...</NavDropdown.Item>
                        <NavDropdown.Item href="/home/playlist/Workbook_2" className="subnavlink">習作本2</NavDropdown.Item>
                        <NavDropdown.Item href="/home/playlist/Workbook_3" className="subnavlink">習作本3 建構中...</NavDropdown.Item>
                        <NavDropdown.Item href="/home/playlist/Workbook_4" className="subnavlink">習作本4 建構中...</NavDropdown.Item>
                        <NavDropdown.Item href="/home/playlist/Workbook_5" className="subnavlink">習作本5 建構中...</NavDropdown.Item>
                        <NavDropdown.Item href="/home/playlist/Workbook_6" className="subnavlink">習作本6 建構中...</NavDropdown.Item>
                        <NavDropdown.Divider />
                        <NavDropdown.Item href="#" className="navlink">
                            持續編輯中....
                        </NavDropdown.Item>
                  </NavDropdown>



                  {/*                                    聽力本                                     */}
                  <NavDropdown
                    title="聽力本"
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                    className="navlink"
                  >
                    {/*                              習作本 1                                   */}
                    {['end'].map((direction) => (
                            <NavDropdown 
                              className="navlink"
                              key={direction}
                              // id={`dropdown-button-drop-${direction}`}
                              drop={direction}
                              // variant="secondary"
                              title={` 習作本1專用聽力本 `}
                            >
                             <NavDropdown.Item href="/home/playlist/Listening_1" className="subnavlink">聽力本1 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_2" className="subnavlink">聽力本2 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_3" className="subnavlink">聽力本3 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_4" className="subnavlink">聽力本4 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_5" className="subnavlink">聽力本5 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_6" className="subnavlink">聽力本6 建構中...</NavDropdown.Item>
                        
                            </NavDropdown>
                            

                            
                          ))}
                   {/*                             習作本 2                                  */}
                   {['end'].map((direction) => (
                            <NavDropdown 
                              className="navlink"
                              key={direction}
                              // id={`dropdown-button-drop-${direction}`}
                              drop={direction}
                              // variant="secondary"
                              title={` 習作本2專用聽力本 `}
                            >
                             <NavDropdown.Item href="/home/playlist/Listening_1" className="subnavlink">聽力本1 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_2" className="subnavlink">聽力本2 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_3" className="subnavlink">聽力本3 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_4" className="subnavlink">聽力本4 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_5" className="subnavlink">聽力本5 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_6" className="subnavlink">聽力本6 建構中...</NavDropdown.Item>
                        
                            </NavDropdown>
                            

                            
                          ))}

                   {/*                             習作本 3                                  */}
                   {['end'].map((direction) => (
                            <NavDropdown 
                              className="navlink"
                              key={direction}
                              // id={`dropdown-button-drop-${direction}`}
                              drop={direction}
                              // variant="secondary"
                              title={` 習作本3專用聽力本 `}
                            >
                             <NavDropdown.Item href="/home/playlist/Listening_1" className="subnavlink">聽力本1 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_2" className="subnavlink">聽力本2 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_3" className="subnavlink">聽力本3 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_4" className="subnavlink">聽力本4 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_5" className="subnavlink">聽力本5 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_6" className="subnavlink">聽力本6 建構中...</NavDropdown.Item>
                        
                            </NavDropdown>
                            

                            
                          ))}

                  {/*                              習作本 4                                  */}
                  {['end'].map((direction) => (
                            <NavDropdown 
                              className="navlink"
                              key={direction}
                              // id={`dropdown-button-drop-${direction}`}
                              drop={direction}
                              // variant="secondary"
                              title={` 習作本4專用聽力本 `}
                            >
                             <NavDropdown.Item href="/home/playlist/Listening_1" className="subnavlink">聽力本1 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_2" className="subnavlink">聽力本2 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_3" className="subnavlink">聽力本3 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_4" className="subnavlink">聽力本4 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_5" className="subnavlink">聽力本5 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_6" className="subnavlink">聽力本6 建構中...</NavDropdown.Item>
                        
                            </NavDropdown>
                            

                            
                          ))}
                  {/*                              習作本 5                                  */}
                  {['end'].map((direction) => (
                            <NavDropdown 
                              className="navlink"
                              key={direction}
                              // id={`dropdown-button-drop-${direction}`}
                              drop={direction}
                              // variant="secondary"
                              title={` 習作本5專用聽力本 `}
                            >
                             <NavDropdown.Item href="/home/playlist/Listening_1" className="subnavlink">聽力本1 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_2" className="subnavlink">聽力本2 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_3" className="subnavlink">聽力本3 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_4" className="subnavlink">聽力本4 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_5" className="subnavlink">聽力本5 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_6" className="subnavlink">聽力本6 建構中...</NavDropdown.Item>
                        
                            </NavDropdown>
                            

                            
                          ))}
                  {/*                              習作本 6                                  */}
                  {['end'].map((direction) => (
                            <NavDropdown 
                              className="navlink"
                              key={direction}
                              // id={`dropdown-button-drop-${direction}`}
                              drop={direction}
                              // variant="secondary"
                              title={` 習作本6專用聽力本 `}
                            >
                             <NavDropdown.Item href="/home/playlist/Listening_1" className="subnavlink">聽力本1 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_2" className="subnavlink">聽力本2 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_3" className="subnavlink">聽力本3 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_4" className="subnavlink">聽力本4 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_5" className="subnavlink">聽力本5 建構中...</NavDropdown.Item>
                             <NavDropdown.Item href="/home/playlist/Listening_6" className="subnavlink">聽力本6 建構中...</NavDropdown.Item>
                        
                            </NavDropdown>
                            

                            
                          ))}
                  
                  </NavDropdown>
                  

                  {/*                                    閱讀聽力                                     */}
                  <NavDropdown
                    title="閱讀&聽力"
                    id={`offcanvasNavbarDropdown-expand-${expand}`}
                    className="navlink"
                  >
                    <NavDropdown.Item href="/home/playlist/SER1" className="subnavlink">Super Easy Reading 3e 1</NavDropdown.Item>
                    <NavDropdown.Item href="/home/playlist/STEAM1" className="subnavlink">Steam Reading 1</NavDropdown.Item>
                    <NavDropdown.Item href="/home/playlist/SARC1" className="subnavlink">Short Articles Reading 1"</NavDropdown.Item>
                    <NavDropdown.Item href="/home/playlist/RL1" className="subnavlink">Reading Lamp 1</NavDropdown.Item>
                  </NavDropdown>



                </Nav>
                
                {/*                                     搜尋欄位                         */}
                <Form className="justify-content-center d-flex align-items-center">
                   <SearchBar/>
                </Form> 
                {/*                                     登出                         */}
                <Logout/>

              </Offcanvas.Body>
            </Navbar.Offcanvas>
          </Container>
        </Navbar>
      ))}
    </>
  );
}

export default Navigation;