import React from 'react';
import './Home.scss';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Homepage from '../Images/Homepage.PNG'
import Musicpage from '../Images/Music.PNG'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import Navbar from '../Components/Navbar';

const Home = () => {
    const color = `rgb(255, 53, 99)`;
    return (
        <>
            <Navbar />
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
                        <Button className='d-flex justify-content-center gap-1' as={Link} to="https://www.alanenglish.com.tw/" target="_blank" variant="danger">Get Started <ArrowForwardIcon /> </Button>
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
            </div>
        </>
    );
};

export default Home;
