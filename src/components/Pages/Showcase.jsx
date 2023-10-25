import React from 'react';
import './css/Showcase.scss';
import { Button } from 'react-bootstrap';
import Homepage from '.././assets/img/Homepage.PNG'
import Musicpage from '.././assets/img/Music.PNG'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import ShowcaseNavbar from '../fragment/ShowcaseNavbar';
import { Link } from "react-router-dom";

const Showcase = () => {
    const color = `rgb(255, 53, 99)`;
    const nav1 = '#關於AlanEnglish';
    const nav2 = '#About';
    const nav3 = '#EnglishMethod';
    const nav4 = '#Contact';
    return (
        <>
            <ShowcaseNavbar nav1={nav1} nav2={nav2} nav3={nav3} nav4={nav4} />
            <div className="product-section-container">
                <section className="product-section">
                    <div className='productdiv'>
                        <h1>
                            <strong>The </strong>
                            <strong style={{ color }}><u>Best</u></strong>
                            <strong> Way To </strong>
                            <strong style={{ color }}><u>Learn English</u></strong>
                        </h1>
                        <p>AI Teacher - Alan English Listening</p>
                        <Button className='d-flex justify-content-center gap-1' as={Link} to="/" href="/" variant="danger">開始試用Alan English <ArrowForwardIcon /> </Button>
                    </div>
                    <img src={Homepage} alt="Product 1" />
                </section>
                <section className="product-section">
                    <img src={Musicpage} alt="Product 2" />
                    <div>
                        <h1>
                            <strong><KeyboardDoubleArrowRightIcon />AI 自動生成測驗問題 </strong>
                        </h1>
                        <h1>
                            <strong><KeyboardDoubleArrowRightIcon />高效學習不死板 </strong>
                        </h1>
                        <h3>
                            <strong style={{ color }}><u>FACT : </u></strong>
                        </h3>
                        <p>自編講義，精準命中學習英文痛點</p>
                        <p>聽完聽力後再做小測驗會讓學習效率大幅增加</p>
                        <h6> <strong style={{ color }}><u>Pricing : 500 NT / Month </u></strong></h6>
                    </div>
                </section>
                <section id='關於AlanEnglish' className='product-section'>關於AlanEnglish</section>
                <div id='About' className='product-section'>About</div>
                <div id='EnglishMethod' className='product-section'>EnglishMethod</div>
                <div id='Contact' className='product-section'>Contact</div>
            </div >
        </>
    );
};

export default Showcase;
