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
    const nav1 = '#關於AE';
    const nav2 = '#精選教材&計費方式';
    const nav3 = '#用戶回饋';
    const nav4 = '#聯絡我們';

    return (
        <div className='showcase'>
            <ShowcaseNavbar nav1={nav1} nav2={nav2} nav3={nav3} nav4={nav4} />
            <div className="product-section-container">
                <div className="product-section">
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
                </div>
                <div className="product-section">
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
                </div>
                <div id='關於AE' className='product-section-column'>
                    <h2>
                        歡迎來到 AlanEnglish - 專業國小英文教學
                    </h2>
                    <p>
                        在AlanEnglish，我們熱切追求一個目標 - 幫助國小學生輕鬆、自信地掌握英語。
                        聆聽．表達．流暢
                        我們的教學理念基於三個關鍵元素：聆聽、表達和流暢。這些元素是英語學習的基礎，也是孩子們建立自信的關鍵。
                    </p>
                </div>
                <div id='精選教材&計費方式' className='product-section-column'>
                    <h2>
                        為什麼選擇 AlanEnglish？
                    </h2>
                    <p>
                        專業的師資團隊：我們擁有專業、經驗豐富的老師，他們了解如何啟發孩子對英語的興趣。
                        互動學習體驗：我們注重學生的參與，通過互動課程使學習變得有趣。
                        個別化教學：每個孩子都不同，我們提供個別化的教學，以滿足每位學生的需求。
                        強調聽力和口說：我們深知聽力和口說是學習英語的關鍵。我們的課程專注於這兩個技能的培養。
                    </p>
                </div>
                <div id='用戶回饋' className='product-section-column'>EnglishMethod</div>
                <div id='聯絡我們' className='product-section-column'>
                    <h2>
                        與我們聯繫
                    </h2>
                    <p>
                        如果您想讓您的孩子開始一個令人興奮的英語學習旅程，請與我們聯繫。我們期待與您一起協助孩子們取得英語的成功。
                        加入 AlanEnglish，開啟未來無限的可能性。
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Showcase;
