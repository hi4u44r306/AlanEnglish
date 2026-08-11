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


function MainNavbar() {

  const [scrolled, setScrolled] = useState(false);

  // Supabase Navbar 資料
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);

  const [navError, setNavError] = useState(null);


  // =====================================================
  // Navbar 捲動效果
  // =====================================================

  useEffect(() => {

    const handleScroll = () => {

      if (window.scrollY > 100) {

        setScrolled(true);

      } else {

        setScrolled(false);

      }

    };


    window.addEventListener(
      'scroll',
      handleScroll
    );


    return () => {

      window.removeEventListener(
        'scroll',
        handleScroll
      );

    };

  }, []);


  // =====================================================
  // 從 Supabase 取得教材分類 + 書籍
  // =====================================================

  useEffect(() => {

    const fetchNavbarData = async () => {

      try {

        setLoading(true);

        setNavError(null);


        // -----------------------------
        // 1. 讀取教材分類
        // -----------------------------

        const {
          data: categoryData,
          error: categoryError
        } = await supabase
          .from('book_categories')
          .select(
            `
                        id,
                        name,
                        code,
                        sort_order,
                        enabled
                        `
          )
          .eq('enabled', true)
          .order(
            'sort_order',
            {
              ascending: true
            }
          );


        if (categoryError) {

          console.error(
            "讀取 book_categories 失敗:",
            categoryError
          );

          setNavError(
            "教材分類讀取失敗"
          );

          return;

        }


        // -----------------------------
        // 2. 讀取 books
        // -----------------------------

        const {
          data: bookData,
          error: bookError
        } = await supabase
          .from('books')
          .select(
            `
                        id,
                        category_id,
                        name,
                        code,
                        sort_order,
                        enabled
                        `
          )
          .eq('enabled', true)
          .order(
            'sort_order',
            {
              ascending: true
            }
          );


        if (bookError) {

          console.error(
            "讀取 books 失敗:",
            bookError
          );

          setNavError(
            "教材讀取失敗"
          );

          return;

        }


        // -----------------------------
        // 3. 把 books 放進 category
        // -----------------------------

        const convertedCategories =
          (categoryData || []).map(
            category => {

              const categoryBooks =
                (bookData || [])
                  .filter(
                    book =>
                      book.category_id
                      === category.id
                  )
                  .sort(
                    (a, b) =>
                      a.sort_order
                      - b.sort_order
                  );


              return {

                ...category,

                books:
                  categoryBooks

              };

            }
          );


        console.log(
          "Navbar Supabase categories:",
          convertedCategories
        );


        setCategories(
          convertedCategories
        );


      } catch (error) {

        console.error(
          "MainNavbar 發生錯誤:",
          error
        );

        setNavError(
          "Navbar 載入失敗"
        );

      } finally {

        setLoading(false);

      }

    };


    fetchNavbarData();

  }, []);


  // =====================================================
  // 渲染教材 Dropdown
  // =====================================================

  const renderCategoryDropdown = (
    category
  ) => {

    return (

      <NavDropdown

        id={
          `category-${category.id}`
        }

        key={
          category.id
        }

        title={

          <div
            className=
            "d-flex align-items-center"
          >

            <img
              style={{
                width: 18,
                marginRight: 4
              }}
              src={Books}
              alt="books"
            />

            {category.name}

          </div>

        }

        className="navlink"

        align="end"

      >


        {
          category.books
            && category.books.length > 0
            ?

            category.books.map(
              book => (

                <NavDropdown.Item

                  key={
                    book.id
                  }

                  as={Link}

                  to={
                    `/home/playlist/${book.code}`
                  }

                  className=
                  "subnavlink"

                >

                  <img

                    style={{
                      width: 18,
                      marginRight: 4
                    }}

                    src={
                      BlueBook
                    }

                    alt={
                      book.name
                    }

                  />

                  {book.name}

                </NavDropdown.Item>

              )
            )

            :

            <NavDropdown.Item
              disabled
            >

              尚無教材

            </NavDropdown.Item>
        }


      </NavDropdown>

    );

  };


  // =====================================================
  // Render
  // =====================================================

  return (

    <div>

      {
        ['xl'].map(
          expand => (

            <Navbar

              collapseOnSelect={
                true
              }

              key={
                expand
              }

              expand={
                expand
              }

              className={
                `navbackground ${scrolled
                  ? 'scrolled'
                  : ''
                }`
              }

            >


              <Container

                fluid

                className=
                "containerfluid"

              >


                {/* Logo */}

                <Navbar.Brand

                  as={Link}

                  to="/userinfo"

                >

                  <Brand />

                </Navbar.Brand>


                {/* Mobile Menu */}

                <Navbar.Toggle

                  className="toggle"

                  aria-controls={
                    `offcanvasNavbar-expand-${expand}`
                  }

                >

                  <img

                    style={{
                      width: 30,
                      height: 30
                    }}

                    src={
                      Menu
                    }

                    alt="menu"

                  />

                </Navbar.Toggle>


                <Navbar.Offcanvas

                  id={
                    `offcanvasNavbar-expand-${expand}`
                  }

                  aria-labelledby={
                    `offcanvasNavbarLabel-expand-${expand}`
                  }

                  placement="end"

                >


                  <Offcanvas.Header
                    closeButton
                  />


                  <Offcanvas.Body

                    className={
                      `navbackground ${scrolled
                        ? 'scrolled'
                        : ''
                      } d-flex flex-column align-items-center justify-content-center`
                    }

                  >


                    <Nav>


                      {/* ===================== */}
                      {/* 教師主控台 */}
                      {/* ===================== */}

                      {
                        localStorage.getItem(
                          'ae-class'
                        )
                        === 'Teacher'
                        &&

                        <NavDropdown

                          title={

                            <div
                              className=
                              "d-flex align-items-center"
                            >

                              <img

                                style={{
                                  width: 18,
                                  marginRight: 4
                                }}

                                src={
                                  Books
                                }

                                alt=
                                "teacher"

                              />

                              教師用

                            </div>

                          }

                          id={
                            `offcanvasNavbarDropdown-expand-${expand}`
                          }

                          className=
                          "navlink"

                        >


                          <NavDropdown.Item

                            as={Link}

                            to=
                            "/editnavbar"

                            className=
                            "subnavlink"

                          >

                            <img

                              style={{
                                width: 18,
                                marginRight: 4
                              }}

                              src={
                                Setting
                              }

                              alt=
                              "setting"

                            />

                            編輯Navbar

                          </NavDropdown.Item>


                          <NavDropdown.Item

                            as={Link}

                            to=
                            "/home/playlist/addmusic"

                            className=
                            "subnavlink"

                          >

                            <img

                              style={{
                                width: 18,
                                marginRight: 4
                              }}

                              src={
                                Setting
                              }

                              alt=
                              "setting"

                            />

                            新增音檔

                          </NavDropdown.Item>


                          <NavDropdown.Item

                            as={Link}

                            to=
                            "/home/playlist/controlpanel"

                            className=
                            "subnavlink"

                          >

                            <img

                              style={{
                                width: 18,
                                marginRight: 4
                              }}

                              src={
                                Setting
                              }

                              alt=
                              "setting"

                            />

                            控制台

                          </NavDropdown.Item>


                          <NavDropdown.Item

                            as={Link}

                            to=
                            "/home/playlist/signup"

                            className=
                            "subnavlink"

                          >

                            <img

                              style={{
                                width: 18,
                                marginRight: 4
                              }}

                              src={
                                Setting
                              }

                              alt=
                              "setting"

                            />

                            新增學生帳號

                          </NavDropdown.Item>


                        </NavDropdown>
                      }


                      {/* ===================== */}
                      {/* Supabase 教材 Navbar */}
                      {/* ===================== */}

                      {
                        loading
                          ?

                          <Nav.Link
                            className=
                            "navlink"
                            disabled
                          >

                            教材載入中...

                          </Nav.Link>

                          :

                          navError
                            ?

                            <Nav.Link
                              className=
                              "navlink"
                              disabled
                            >

                              教材載入失敗

                            </Nav.Link>

                            :

                            categories.map(
                              category =>
                                renderCategoryDropdown(
                                  category
                                )
                            )
                      }


                      {/* ===================== */}
                      {/* 學生檔案 */}
                      {/* ===================== */}

                      <Nav.Link

                        as={Link}

                        to="/userinfo"

                        className=
                        "navlink nav-item dropdown"

                      >

                        <div
                          className=
                          "username"
                        >

                          <img

                            style={{
                              width: 18,
                              marginRight: 4
                            }}

                            src={
                              File
                            }

                            alt=
                            "student"

                          />

                          學生檔案

                        </div>

                      </Nav.Link>


                      {/* ===================== */}
                      {/* About */}
                      {/* ===================== */}

                      <Nav.Link

                        as={Link}

                        to=
                        "/home/playlist/about"

                        className=
                        "navlink nav-item dropdown"

                      >

                        <div
                          className=
                          "username"
                        >

                          <img

                            style={{
                              width: 18,
                              marginRight: 4
                            }}

                            src={
                              Search
                            }

                            alt=
                            "about"

                          />

                          關於AE

                        </div>

                      </Nav.Link>


                    </Nav>


                  </Offcanvas.Body>


                </Navbar.Offcanvas>


              </Container>


            </Navbar>

          )
        )
      }

    </div>

  );

}


export default MainNavbar;