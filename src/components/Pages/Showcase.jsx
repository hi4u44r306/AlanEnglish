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
        title: "AI 個人化教材",
        text: "依孩子的程度產生短文與選擇題，作答後立即回饋並保留練習結果。"
    },
    {
        icon: <BiPlayCircle />,
        title: "AI 口說大挑戰",
        text: "跟著教材關卡開口回答，從示範、收音到結果回饋，把課堂句型真正說出來。"
    },
    {
        icon: <BiBarChartAlt2 />,
        title: "智慧複習與每週報告",
        text: "從需要加強的內容繼續練習，並用每週紀錄看見孩子真正完成了什麼。"
    },
    {
        icon: <BiTrendingUp />,
        title: "完整學習歷程與獎勵",
        text: "有效聆聽、答題、口說通關與作業完成狀態持續保存，並累積等級、XP 與學習獎勵。"
    }
];

const learningSteps = [
    { number: "01", title: "開始 7 天試用", text: "不需信用卡，先熟悉教材、聽力與 AI 練習流程。" },
    { number: "02", title: "完成每天的小目標", text: "從教材音檔、老師作業或智慧複習開始，不必一次做很多。" },
    { number: "03", title: "累積真實學習紀錄", text: "有效聆聽、答題與作業完成狀態會跟著帳號保存。" },
    { number: "04", title: "看見下一步", text: "透過排行榜、每週報告與老師安排，知道接下來該加強什麼。" }
];

const faqs = [
    {
        question: "Alan English 適合什麼年齡？",
        answer: "平台主要為國小學生設計，教材依 E1、E3、E5、E7 不同英文程度安排。家長可以先使用 7 天免費試用，再決定是否適合孩子。"
    },
    {
        question: "免費試用需要先付款或綁信用卡嗎？",
        answer: "不需要。完成 Email 驗證後即可開始 7 天免費試用，可生成 AI 教材共 7 次、每天最多 2 次；試用結束後也不會自動扣款。"
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
                                把英文班教材聽力、班級作業、AI 個人化教材、AI 口說大挑戰與智慧複習放在同一個平台，
                                每一次有效聆聽、答題與通關都留下紀錄，讓孩子知道下一步，也讓家長與老師看見真正完成的內容。
                            </p>
                            <div className="showcase-hero-actions">
                                <Link className="showcase-primary-btn" to="/freetrial">
                                    免費試用 7 天
                                    <BiChevronRight />
                                </Link>
                                <a className="showcase-secondary-btn" href="#product-preview">
                                    看看如何學習
                                </a>
                            </div>
                            <div className="showcase-trust-row">
                                <span><BiShieldQuarter /> 不需信用卡</span>
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

                <section className="showcase-value-strip" aria-label="Alan English 核心特色">
                    <div className="showcase-shell">
                        <span>英文班教材聽力</span><i /><span>AI 口說大挑戰</span><i /><span>班級作業</span><i /><span>學習歷程可追蹤</span>
                    </div>
                </section>

                <section id="features" className="showcase-section showcase-features-section">
                    <div className="showcase-shell">
                        <div className="showcase-section-heading showcase-section-heading-center">
                            <span className="showcase-kicker">LEARNING THAT CONTINUES</span>
                            <h2>不是多做一張考卷，<br />而是建立每天都做得到的英文習慣。</h2>
                            <p>從聽力輸入到理解、回答與複習，Alan English 把孩子每天真正需要的學習步驟放在同一個平台。</p>
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
                </section>

                <section id="product-preview" className="showcase-section showcase-product-section">
                    <div className="showcase-shell showcase-product-grid">
                        <div className="ae-quiz-demo" aria-label="AI 英文練習介面示意">
                            <div className="ae-quiz-top">
                                <div><small>AI PRACTICE</small><strong>閱讀理解 · Question 3</strong></div>
                                <span>3 / 5</span>
                            </div>
                            <div className="ae-quiz-progress"><span /></div>
                            <p className="ae-quiz-passage">Amy goes to the library every Saturday. She likes reading stories about animals.</p>
                            <h3>Where does Amy go every Saturday?</h3>
                            <div className="ae-answer-list">
                                <div><span>A</span>The park</div>
                                <div className="selected"><span>B</span>The library <b>✓</b></div>
                                <div><span>C</span>The supermarket</div>
                            </div>
                            <div className="ae-quiz-feedback"><strong>答對了！</strong><span>你已經理解文章中的時間與地點。</span></div>
                        </div>

                        <div className="showcase-product-copy">
                            <span className="showcase-kicker">MORE THAN LISTENING</span>
                            <h2>聽完之後，孩子還能真正回答與運用。</h2>
                            <p>
                                AI 教材不是直接把答案顯示給學生，而是透過選擇題完成練習。
                                達到學習標準後留下紀錄，之後也能回到智慧複習中心再次練習。
                            </p>
                            <div className="showcase-product-points">
                                <div><span><BiHeadphone /></span><div><strong>自然建立語感</strong><p>反覆聆聽單字、句型與完整內容。</p></div></div>
                                <div><span><BiPlayCircle /></span><div><strong>開口回答教材題目</strong><p>用 AI 口說大挑戰練習課堂句型與完整回答。</p></div></div>
                                <div><span><BiBarChartAlt2 /></span><div><strong>學習結果自動保存</strong><p>進度、完成率與練習紀錄持續累積。</p></div></div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="learning-paths" className="showcase-section showcase-paths-section">
                    <div className="showcase-shell">
                        <div className="showcase-section-heading">
                            <span className="showcase-kicker">TWO LEARNING PATHS</span>
                            <h2>上英文班或在家自學，<br />都能使用適合自己的方式。</h2>
                        </div>
                        <div className="showcase-path-grid">
                            <article className="showcase-path-card academy">
                                <div className="showcase-path-label">ALAN ENGLISH CLASS</div>
                                <div className="showcase-path-icon"><BiShieldQuarter /></div>
                                <h3>英文班學生</h3>
                                <p>由老師建立邀請並安排 E1、E3、E5、E7 班級，學生完成帳號啟用後即可使用課堂教材聽力、班級作業與 AI 口說練習。</p>
                                <ul>
                                    <li><span>✓</span> Workbook、Basic Reading 與課堂聽力集中使用</li>
                                    <li><span>✓</span> 接收老師發布的班級作業</li>
                                    <li><span>✓</span> AI 口說大挑戰與發音練習</li>
                                    <li><span>✓</span> 老師可以追蹤學習歷程與完成狀態</li>
                                </ul>
                                <Link to="/login">我是英文班學生 <BiChevronRight /></Link>
                            </article>
                            <article className="showcase-path-card self-study">
                                <div className="showcase-path-label">SELF-PACED LEARNING</div>
                                <div className="showcase-path-icon"><BiBookOpen /></div>
                                <h3>自主學習</h3>
                                <p>先使用 7 天免費試用，依孩子的時間安排短時間聽力與 AI 練習，找到每天願意持續的節奏。</p>
                                <ul>
                                    <li><span>✓</span> 7 天引導式試用內容</li>
                                    <li><span>✓</span> 每天短時間自主練習</li>
                                    <li><span>✓</span> 進度與練習紀錄自動保存</li>
                                    <li><span>✓</span> 自主學習，不會收到英文班作業</li>
                                </ul>
                                <Link to="/freetrial">先免費體驗 <BiChevronRight /></Link>
                            </article>
                        </div>
                    </div>
                </section>

                <section className="showcase-section showcase-process-section">
                    <div className="showcase-shell">
                        <div className="showcase-section-heading showcase-section-heading-center">
                            <span className="showcase-kicker">HOW IT WORKS</span>
                            <h2>四個步驟，開始孩子每天的英文練習。</h2>
                        </div>
                        <div className="showcase-process-grid">
                            {learningSteps.map((step, index) => (
                                <article className="showcase-process-card" key={step.number}>
                                    <div className="showcase-process-number">{step.number}</div>
                                    <h3>{step.title}</h3>
                                    <p>{step.text}</p>
                                    {index < learningSteps.length - 1 && <BiChevronRight className="showcase-process-arrow" />}
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
                            <p>有效聆聽次數、教材進度、AI 答題、口說通關與班級作業都會跟著帳號保存，幫助孩子建立成就感，也讓家長與老師更容易掌握學習過程。</p>
                        </div>
                        <div className="showcase-stat-grid">
                            <div className="showcase-stat-card"><span>LISTENING</span><strong>10×</strong><p>有效聆聽熟練目標</p></div>
                            <div className="showcase-stat-card"><span>PROGRESS</span><strong>100%</strong><p>教材完成狀態</p></div>
                            <div className="showcase-stat-card"><span>HISTORY</span><strong>24/7</strong><p>隨時查看紀錄</p></div>
                        </div>
                    </div>
                </section>

                <section id="faq" className="showcase-section showcase-faq-section">
                    <div className="showcase-shell showcase-faq-layout">
                        <div className="showcase-section-heading">
                            <span className="showcase-kicker">QUESTIONS & ANSWERS</span>
                            <h2>家長最常問的問題。</h2>
                            <p>如果還有其他問題，可以先免費試用，再決定是否適合孩子。</p>
                            <Link className="showcase-secondary-btn" to="/login">已有帳號，前往登入</Link>
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

                <section className="showcase-section showcase-cta-section">
                    <div className="showcase-shell showcase-cta-card">
                        <div>
                            <span className="showcase-kicker">START TODAY</span>
                            <h2>今天，就從第一段英文聽力開始。</h2>
                            <p>先免費體驗 7 天，陪孩子找到每天願意持續的英文學習節奏。</p>
                        </div>
                        <div className="showcase-cta-actions">
                            <Link className="showcase-primary-btn" to="/freetrial">免費試用 7 天 <BiChevronRight /></Link>
                            <Link className="showcase-secondary-btn" to="/login">學生登入</Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="showcase-footer">
                <div className="showcase-shell showcase-footer-inner">
                    <div><strong>ALAN ENGLISH</strong><span>Listen. Practice. Progress.</span></div>
                    <div className="showcase-footer-links"><Link to="/login">登入</Link><Link to="/freetrial">免費試用</Link></div>
                    <p>© {new Date().getFullYear()} Alan English. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Showcase;
