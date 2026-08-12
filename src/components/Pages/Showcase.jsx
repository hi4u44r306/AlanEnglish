import React from "react";
import { Link } from "react-router-dom";
import {
    BiBarChartAlt2,
    BiBookOpen,
    BiChevronRight,
    BiHeadphone,
    BiLockAlt,
    BiPlayCircle,
    BiShieldQuarter,
    BiTimeFive,
    BiTrendingUp
} from "react-icons/bi";
import Homepage from "../assets/img/Homepage.PNG";
import Musicpage from "../assets/img/Music.PNG";
import ShowcaseNavbar from "../fragment/ShowcaseNavbar";
import "./css/Showcase.scss";

const learningSteps = [
    { number: "01", title: "選擇教材", text: "依照目前程度進入適合的英文教材。" },
    { number: "02", title: "反覆聆聽", text: "透過聽力播放器建立穩定的英文輸入。" },
    { number: "03", title: "完成練習", text: "持續累積播放次數，養成固定學習習慣。" },
    { number: "04", title: "追蹤進度", text: "學生與老師都能掌握學習成果與完成狀態。" }
];

const features = [
    {
        icon: <BiHeadphone />,
        title: "聽力訓練",
        text: "把英文聽力變成每天都能完成的小任務，讓學生透過穩定輸入建立語感。"
    },
    {
        icon: <BiBookOpen />,
        title: "分級教材",
        text: "依不同教材與程度整理學習內容，學生可以快速找到現在該學的單元。"
    },
    {
        icon: <BiBarChartAlt2 />,
        title: "學習紀錄",
        text: "記錄播放次數、完成狀態與學習時間，讓努力不再只靠感覺。"
    }
];

const Showcase = () => {
    return (
        <div className="showcase">
            <ShowcaseNavbar
                nav1="#about-ae"
                nav2="#learning-system"
                nav3="#features"
                nav4="#contact"
            />

            <main>
                <section className="showcase-hero">
                    <div className="showcase-shell showcase-hero-grid">
                        <div className="showcase-hero-copy">
                            <div className="showcase-eyebrow">
                                <span className="showcase-eyebrow-dot" />
                                Alan English Listening
                            </div>
                            <h1>
                                讓孩子真正
                                <span>聽懂英文，</span>
                                <br />
                                而不只是寫完題目。
                            </h1>
                            <p className="showcase-hero-description">
                                專為學生設計的英文聽力學習平台。從教材、播放、重複練習到學習紀錄，
                                把每天的英文練習變得更清楚、更簡單，也更容易持續。
                            </p>
                            <div className="showcase-hero-actions">
                                <Link className="showcase-primary-btn" to="/">
                                    開始學習
                                    <BiChevronRight />
                                </Link>
                                <a className="showcase-secondary-btn" href="#about-ae">
                                    了解 Alan English
                                </a>
                            </div>
                            <div className="showcase-trust-row">
                                <span><BiShieldQuarter /> 學習進度保存</span>
                                <span><BiTimeFive /> 隨時開始練習</span>
                                <span><BiTrendingUp /> 看得見的進步</span>
                            </div>
                        </div>

                        <div className="showcase-hero-visual" aria-label="Alan English platform preview">
                            <div className="showcase-window">
                                <div className="showcase-window-bar">
                                    <span />
                                    <span />
                                    <span />
                                    <div className="showcase-window-title">alanenglish.com.tw</div>
                                </div>
                                <img src={Homepage} alt="Alan English 學習平台首頁" />
                            </div>
                            <div className="showcase-floating-card showcase-floating-card-top">
                                <div className="showcase-floating-icon"><BiHeadphone /></div>
                                <div>
                                    <strong>Listening</strong>
                                    <span>每天累積一點進步</span>
                                </div>
                            </div>
                            <div className="showcase-floating-card showcase-floating-card-bottom">
                                <div className="showcase-progress-ring">7×</div>
                                <div>
                                    <strong>重複聆聽</strong>
                                    <span>建立穩定學習習慣</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="about-ae" className="showcase-section showcase-intro-section">
                    <div className="showcase-shell">
                        <div className="showcase-section-heading showcase-section-heading-center">
                            <span className="showcase-kicker">ABOUT ALAN ENGLISH</span>
                            <h2>英文學習，不該只剩下背單字與寫考卷。</h2>
                            <p>
                                Alan English 把「聽」放回英文學習的核心，讓學生有明確教材、有固定練習方式，
                                也能知道自己到底完成了多少。
                            </p>
                        </div>

                        <div className="showcase-feature-grid">
                            {features.map((feature) => (
                                <article className="showcase-feature-card" key={feature.title}>
                                    <div className="showcase-feature-icon">{feature.icon}</div>
                                    <h3>{feature.title}</h3>
                                    <p>{feature.text}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="learning-system" className="showcase-section showcase-product-section">
                    <div className="showcase-shell showcase-product-grid">
                        <div className="showcase-product-visual">
                            <div className="showcase-window showcase-window-dark">
                                <div className="showcase-window-bar">
                                    <span />
                                    <span />
                                    <span />
                                    <div className="showcase-window-title">Listening Player</div>
                                </div>
                                <img src={Musicpage} alt="Alan English 聽力播放器" />
                            </div>
                            <div className="showcase-mini-player">
                                <BiPlayCircle />
                                <div>
                                    <strong>Continue Listening</strong>
                                    <span>從上次的進度繼續</span>
                                </div>
                            </div>
                        </div>

                        <div className="showcase-product-copy">
                            <span className="showcase-kicker">BUILT FOR DAILY LEARNING</span>
                            <h2>學生打開網站，就知道下一步要做什麼。</h2>
                            <p>
                                不需要在複雜功能裡找教材。選擇內容、播放音檔、完成聆聽、留下紀錄，
                                整個流程都圍繞學生每天真正會使用的動作設計。
                            </p>
                            <div className="showcase-product-points">
                                <div>
                                    <span><BiHeadphone /></span>
                                    <div>
                                        <strong>專注聽力</strong>
                                        <p>減少不必要干擾，把注意力留給教材與聲音。</p>
                                    </div>
                                </div>
                                <div>
                                    <span><BiBarChartAlt2 /></span>
                                    <div>
                                        <strong>自動留下紀錄</strong>
                                        <p>完成狀態與練習次數都能持續累積。</p>
                                    </div>
                                </div>
                                <div>
                                    <span><BiLockAlt /></span>
                                    <div>
                                        <strong>循序漸進</strong>
                                        <p>未來可依學生程度與學習成果逐步開放進階教材。</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="features" className="showcase-section showcase-process-section">
                    <div className="showcase-shell">
                        <div className="showcase-section-heading">
                            <span className="showcase-kicker">HOW IT WORKS</span>
                            <h2>四個步驟，把英文聽力變成每天可以完成的習慣。</h2>
                        </div>

                        <div className="showcase-process-grid">
                            {learningSteps.map((step, index) => (
                                <article className="showcase-process-card" key={step.number}>
                                    <div className="showcase-process-number">{step.number}</div>
                                    <h3>{step.title}</h3>
                                    <p>{step.text}</p>
                                    {index < learningSteps.length - 1 && (
                                        <BiChevronRight className="showcase-process-arrow" />
                                    )}
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="showcase-section showcase-data-section">
                    <div className="showcase-shell showcase-data-card">
                        <div className="showcase-data-copy">
                            <span className="showcase-kicker showcase-kicker-light">LEARNING PROGRESS</span>
                            <h2>讓每一次練習，都留下看得見的成果。</h2>
                            <p>
                                學習不是只有「有沒有登入」。Alan English 會把學生真正的聆聽行為轉成可以追蹤的進度，
                                幫助學生建立成就感，也讓老師更容易掌握學習狀況。
                            </p>
                        </div>
                        <div className="showcase-stat-grid">
                            <div className="showcase-stat-card">
                                <span>LISTENING</span>
                                <strong>7×</strong>
                                <p>重複練習目標</p>
                            </div>
                            <div className="showcase-stat-card">
                                <span>PROGRESS</span>
                                <strong>100%</strong>
                                <p>教材完成狀態</p>
                            </div>
                            <div className="showcase-stat-card">
                                <span>HISTORY</span>
                                <strong>24/7</strong>
                                <p>隨時查看紀錄</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="contact" className="showcase-section showcase-cta-section">
                    <div className="showcase-shell showcase-cta-card">
                        <div>
                            <span className="showcase-kicker">START LEARNING</span>
                            <h2>今天，就從第一段英文聽力開始。</h2>
                            <p>登入 Alan English，讓英文練習成為每天都做得到的事。</p>
                        </div>
                        <div className="showcase-cta-actions">
                            <Link className="showcase-primary-btn" to="/">
                                前往登入
                                <BiChevronRight />
                            </Link>
                            <Link className="showcase-secondary-btn" to="/freetrial">
                                開通帳號
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="showcase-footer">
                <div className="showcase-shell showcase-footer-inner">
                    <div>
                        <strong>ALAN ENGLISH</strong>
                        <span>Listen. Practice. Progress.</span>
                    </div>
                    <p>© {new Date().getFullYear()} Alan English. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Showcase;
