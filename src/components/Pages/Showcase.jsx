import React from "react";
import { Link } from "react-router-dom";
import {
    BiBarChartAlt2,
    BiBookOpen,
    BiChevronRight,
    BiHeadphone,
    BiPlayCircle,
    BiShieldQuarter,
    BiTimeFive,
    BiTrendingUp
} from "react-icons/bi";
import ShowcaseNavbar from "../fragment/ShowcaseNavbar";
import SeoHead from "../fragment/SeoHead";
import "./css/Showcase.scss";

const features = [
{
        icon: <BiHeadphone />,
        title: "英文班教材與聽力音檔",
        text: "課堂使用的 Workbook、Basic Reading 與分級教材音檔集中在同一處，依教材與頁次快速找到。"
    },
{
        icon: <BiBookOpen />,
        title: "老師發布的班級作業",
        text: "英文班學生接收自己班級的作業，老師可以掌握完成狀態與學習進度。"
    },
{
        icon: <BiPlayCircle />,
        title: "口說大挑戰",
        text: "跟著教材關卡開口回答，從示範、收音到結果回饋，把課堂句型真正說出來。"
    }
];



const faqs = [
    {
        question: "Alan English 適合什麼年齡？",
        answer: "平台主要為國小學生設計，教材依 E1、E3、E5、E7 不同英文程度安排，老師也會依學生實際程度調整班級與學習內容。"
    },
    {
        question: "手機和平板可以使用嗎？",
        answer: "可以。Alan English 支援電腦、平板與手機瀏覽器，學習紀錄會跟著同一個帳號保存。"
    }
];

const Showcase = () => {
    return (
        <div className="showcase">
            <SeoHead path="/" />

            <ShowcaseNavbar
                nav1="#features"
                nav2="#learning-paths"
                nav4="#faq"
            />

            <main>
                <section className="showcase-hero">
                    <div className="showcase-shell showcase-hero-grid">
                        <div className="showcase-hero-copy">
                            <div className="showcase-eyebrow">
                                <span className="showcase-eyebrow-dot" />
                                專為國小生打造的英文學習平台
                            </div>
                            <h1>
                                每天聽一點，
                                <span>讓孩子聽懂英文，</span>
                                <br />
                                也更有自信說出來。
                            </h1>
                            <p className="showcase-hero-description">
                                把教材聽力、班級作業、口說闖關與學習紀錄放在同一個平台，
                                每一次有效聆聽、答題與通關都留下紀錄，讓孩子知道下一步，也讓家長與老師看見真正完成的內容。
                            </p>
                            <div className="showcase-hero-actions">
                                <Link className="showcase-primary-btn" to="/login">學生登入 <BiChevronRight /></Link>
                                <a className="showcase-secondary-btn" href="#features">
                                    看看平台特色
                                    <BiChevronRight />
                                </a>
                            </div>
                            <div className="showcase-trust-row">
                                <span><BiShieldQuarter /> 教材與練習集中管理</span>
                                <span><BiTimeFive /> 每天短時間練習</span>
                                <span><BiTrendingUp /> 進度自動保存</span>
                            </div>
                        </div>

                        <div className="ae-dashboard-demo" aria-label="Alan English 學習平台介面示意">
                            <div className="ae-demo-browser">
                                <div className="ae-demo-browser-bar">
                                    <div className="ae-demo-dots"><span /><span /><span /></div>
                                    <span>alanenglish.com.tw</span>
                                </div>
                                <div className="ae-demo-layout">
                                    <aside className="ae-demo-sidebar" aria-hidden="true">
                                        <div className="ae-demo-mini-logo">AE</div>
                                        <span className="active"><BiBookOpen /></span>
                                        <span><BiHeadphone /></span>
                                        <span><BiBarChartAlt2 /></span>
                                    </aside>
                                    <div className="ae-demo-main">
                                        <header className="ae-demo-header">
                                            <div>
                                                <small>GOOD AFTERNOON</small>
                                                <strong>今天也來完成一小步！</strong>
                                            </div>
                                            <div className="ae-demo-avatar">A</div>
                                        </header>
                                        <div className="ae-demo-progress-card">
                                            <div>
                                                <span>本週學習進度</span>
                                                <strong>4 / 5 天</strong>
                                            </div>
                                            <div className="ae-demo-progress-track"><span /></div>
                                        </div>
                                        <div className="ae-demo-learning-grid">
                                            <article className="ae-demo-lesson-card">
                                                <div className="ae-demo-lesson-icon"><BiHeadphone /></div>
                                                <span>CONTINUE LISTENING</span>
                                                <h3>E3 · Unit 6</h3>
                                                <p>At the supermarket</p>
                                                <div className="ae-demo-player">
                                                    <BiPlayCircle />
                                                    <span><i /></span>
                                                    <time>02:18</time>
                                                </div>
                                            </article>
                                            <article className="ae-demo-score-card">
                                                <span>本週完成率</span>
                                                <strong>80%</strong>
                                                <div className="ae-demo-ring"><span>4</span><small>天</small></div>
                                            </article>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="ae-demo-float ae-demo-float-streak">
                                <strong>🔥 連續 6 天</strong>
                                <span>穩定練習正在累積</span>
                            </div>
                            <div className="ae-demo-float ae-demo-float-result">
                                <span className="ae-demo-check">✓</span>
                                <div><strong>本課已完成</strong><span>Great work!</span></div>
                            </div>
                        </div>
                    </div>
                </section>



                <section id="features" className="showcase-section showcase-features-section">
                    <div className="showcase-shell">
                        <div className="showcase-section-heading showcase-section-heading-center">
                            <span className="showcase-kicker">LEARNING THAT CONTINUES</span>
                            <h2>找到教材，完成今天的小目標。</h2>
                            <p>從今天的教材開始，聽一聽、試著回答，再查看自己的進步。</p>
                        </div>
                        <div className="showcase-feature-grid">
                            {features.map((feature, index) => (
                                <article className={"showcase-feature-card tone-" + ((index % 3) + 1)} key={feature.title}>
                                    <div className="showcase-feature-icon">{feature.icon}</div>
                                    {feature.status && <span className="showcase-feature-status">{feature.status}</span>}
                                    <h3>{feature.title}</h3>
                                    <p>{feature.text}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                <div id="product-preview" className="showcase-section showcase-product-section">
                    <div className="showcase-shell showcase-product-grid">
                        <div className="ae-quiz-demo" aria-label="教材作答介面示意">
                            <div className="ae-quiz-top">
                                <div><small>教材練習</small><strong>閱讀理解 · Question 3</strong></div>
                                <span>3 / 5</span>
                            </div>
                            <div className="ae-quiz-progress"><span /></div>
                            <p className="ae-quiz-passage">Amy goes to the library every Saturday. She likes reading stories about animals.</p>
                            <h3>Where does Amy go every Saturday?</h3>
                            <div className="ae-answer-list">
                                <div><span>A</span>The park</div>
                                <div className="selected"><span>B</span>The library <b>✓</b></div>
                                <div><span>C</span>The supermarket</div>
                                <div><span>D</span>The school</div>
                            </div>
                            <div className="ae-quiz-feedback"><strong>答對了！</strong><span>你已經理解文章中的時間與地點。</span></div>
                        </div>

                        <div className="showcase-product-copy">
                            <span className="showcase-kicker">MORE THAN LISTENING</span>
                            <h2>聽完之後，孩子還能真正回答與運用。</h2>
                            <p>
                                老師可安排教材題目，孩子完成作答後再查看回饋。
                                達到學習標準後留下紀錄，之後也能回到智慧複習中心再次練習。
                            </p>

                        </div>
                    </div>
                </div>
                </section>



                <section id="learning-paths" className="showcase-section showcase-paths-section">
                    <div className="showcase-shell">
                        <div className="showcase-section-heading">
                            <span className="showcase-kicker">TWO LEARNING PATHS</span>
                            <h2>課堂延伸到家裡，進步看得見。</h2>
                            <p>老師與家長可查看有效聆聽、作業進度與每週紀錄；孩子從自己的下一個小目標繼續。</p>
                        </div>
                        <div className="showcase-path-grid">
                            <article className="showcase-path-card academy">
                                <div className="showcase-path-label">ALAN ENGLISH CLASS</div>
                                <div className="showcase-path-icon"><BiShieldQuarter /></div>
                                <h3>英文班學生</h3>
                                <p>依老師提供的登入卡或邀請啟用帳號，接續 E1、E3、E5、E7 班級教材與指定作業。</p>
                                <ul>
                                    <li><span>✓</span> Workbook、Basic Reading 與課堂聽力集中使用</li>
                                    <li><span>✓</span> 接收老師發布的班級作業</li>
                                    <li><span>✓</span> 口說大挑戰與發音練習</li>
                                    <li><span>✓</span> 老師可以追蹤學習歷程與完成狀態</li>
                                </ul>
                                <Link to="/login">我是英文班學生 <BiChevronRight /></Link>
                            </article>
                            <article className="showcase-path-card self-study">
                                <div className="showcase-path-label">SELF-PACED LEARNING</div>
                                <div className="showcase-path-icon"><BiBookOpen /></div>
                                <h3>課後自主複習</h3>
                                <p>依孩子的時間安排短時間聽力、答題與口說練習，把課堂內容延伸成每天都能持續的小目標。</p>
                                <ul>
                                    <li><span>✓</span> 教材音檔與練習集中管理</li>
                                    <li><span>✓</span> 每天短時間自主練習</li>
                                    <li><span>✓</span> 進度與練習紀錄自動保存</li>
                                    <li><span>✓</span> 依學習結果回到需要加強的內容</li>
                                </ul>
                                <a href="#product-preview">了解學習功能 <BiChevronRight /></a>
                            </article>
                        </div>
                    </div>
                </section>





                <section id="faq" className="showcase-section showcase-faq-section">
                    <div className="showcase-shell showcase-faq-layout">
                        <div className="showcase-section-heading">
                            <span className="showcase-kicker">QUESTIONS & ANSWERS</span>
                            <h2>家長最常問的問題。</h2>
                            <p>了解適用年齡、學習方式與支援的裝置。</p>
                            <Link className="showcase-primary-btn" to="/login">已有帳號，前往登入</Link>
                        </div>
                        <div className="showcase-faq-list">
                            {faqs.map((faq, index) => (
                                <details key={faq.question} open={index === 0}>
                                    <summary>{faq.question}<span>＋</span></summary>
                                    <p>{faq.answer}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>


            </main>

            <footer className="showcase-footer">
                <div className="showcase-shell showcase-footer-inner">
                    <div><strong>ALAN ENGLISH</strong><span>Listen. Practice. Progress.</span></div>
                    <div className="showcase-footer-links"><Link to="/login">登入</Link></div>
                    <p>© {new Date().getFullYear()} Alan English. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Showcase;
