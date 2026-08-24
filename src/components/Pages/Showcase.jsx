import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
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
import "./css/Showcase.scss";

const features = [
    {
        icon: <BiHeadphone />,
        title: "分級聽力教材",
        text: "依程度整理教材與音檔，孩子打開網站就知道今天要聽什麼。"
    },
    {
        icon: <BiBookOpen />,
        title: "AI 選擇題練習",
        text: "依主題產生適合程度的短文與選擇題，答題後立即查看結果。"
    },
    {
        icon: <BiPlayCircle />,
        title: "情境英文會話",
        text: "從問路、家庭到校園生活，練習孩子真正可能遇到的英文對話。"
    },
    {
        icon: <BiBarChartAlt2 />,
        title: "看得見的進度",
        text: "播放次數、教材完成率與學習紀錄自動保存，不再只憑感覺判斷。"
    },
    {
        icon: <BiTrendingUp />,
        title: "智慧複習",
        text: "從已學內容回到需要加強的地方，讓每一次練習都更有方向。"
    },
    {
        icon: <BiShieldQuarter />,
        title: "班級作業分流",
        text: "英文班學生接收老師安排的作業；網購會員則按照自己的速度學習。"
    }
];

const learningSteps = [
    { number: "01", title: "免費體驗", text: "先用 7 天體驗聽力、AI 教材與自主學習流程。" },
    { number: "02", title: "選擇教材", text: "依孩子目前程度選擇 E1、E3、E5 或 E7 教材。" },
    { number: "03", title: "開通三個月", text: "購買教材後輸入專屬開通碼，從開通日開始使用 90 天。" },
    { number: "04", title: "決定是否續訂", text: "三個月到期後，可選擇每月 NT$399 繼續自主學習。" }
];

const plans = [
    {
        label: "先體驗看看",
        name: "7 天免費試用",
        price: "免費",
        period: "使用 7 天",
        description: "適合第一次認識 Alan English 的學生與家長，不需要先購買教材。",
        points: ["不需信用卡", "7 天內可生成 AI 教材共 7 次", "體驗聽力與自主學習功能"],
        action: "立即免費試用",
        href: "/freetrial",
        badge: "",
        featured: false
    },
    {
        label: "線上購買實體教材",
        name: "教材＋3 個月權限",
        price: "依教材組合",
        period: "一次購買",
        description: "購買適合孩子程度的教材，免費取得對應線上內容三個月。",
        points: ["從開通當天起算 90 天", "解鎖所購買教材與音檔", "包含 AI 教材、進度與智慧複習"],
        action: "先免費體驗",
        href: "/freetrial",
        badge: "最推薦",
        featured: true
    },
    {
        label: "教材權限到期後",
        name: "一般自主學習會員",
        price: "NT$399",
        period: "／月",
        description: "適合教材三個月權限結束後，希望繼續固定學習的家庭。",
        points: ["完整自主學習功能", "AI 教材與情境會話", "個人進度與智慧複習"],
        action: "先免費體驗",
        href: "/freetrial",
        badge: "",
        featured: false
    },
    {
        label: "Alan English 英文班",
        name: "在校／離校方案",
        price: "在校免費",
        period: "離校後 NT$299／月",
        description: "英文班學生在校期間免費使用；離校後仍可用優惠價繼續自主學習。",
        points: ["在校期間包含班級作業", "離校後保留原有學習紀錄", "離校後不再收到新班級作業"],
        action: "學生登入",
        href: "/login",
        badge: "英文班專屬",
        featured: false
    }
];

const planComparison = [
    {
        label: "費用",
        trial: "免費",
        textbook: "教材售價內含",
        regular: "NT$399／月",
        academy: "在校免費／離校 NT$299"
    },
    {
        label: "使用期限",
        trial: "7 天",
        textbook: "開通後 90 天",
        regular: "按月續訂",
        academy: "依在校或訂閱狀態"
    },
    {
        label: "教材範圍",
        trial: "體驗內容",
        textbook: "已購買教材",
        regular: "已開通教材",
        academy: "依班級與個人權限"
    },
    {
        label: "班級作業",
        trial: "不包含",
        textbook: "不包含",
        regular: "不包含",
        academy: "僅在校生包含"
    },
    {
        label: "學習方式",
        trial: "體驗",
        textbook: "自主安排",
        regular: "自主安排",
        academy: "老師安排＋自主練習"
    }
];

const faqs = [
    {
        question: "Alan English 適合什麼年齡？",
        answer: "平台主要為國小學生設計，教材依 E1、E3、E5、E7 不同英文程度安排。家長可以先使用 7 天免費試用，再選擇適合孩子的教材。"
    },
    {
        question: "免費試用需要先付款或綁信用卡嗎？",
        answer: "不需要。完成 Email 驗證後即可開始 7 天免費試用，可生成 AI 教材共 7 次、每天最多 2 次；試用結束後也不會自動扣款。"
    },
    {
        question: "購買教材為什麼會送三個月網站權限？",
        answer: "購買實體教材後輸入專屬開通碼，即可從開通當天開始使用對應教材、音檔、AI 練習、進度與智慧複習功能 90 天。"
    },
    {
        question: "教材三個月權限到期後會自動扣款嗎？",
        answer: "不會。到期後家長可以自行決定是否以每月 NT$399 訂閱。只有家長完成訂閱與付款授權後，系統才會按月扣款。"
    },
    {
        question: "英文班學生也需要購買會員嗎？",
        answer: "不需要。Alan English 英文班學生在校期間免費使用，並可收到老師安排的班級作業。"
    },
    {
        question: "英文班學生離校後還能繼續使用嗎？",
        answer: "可以。離校後會保留原有學習紀錄，家長可選擇每月 NT$299 的離校生方案繼續自主學習，但不會再收到新的班級作業。"
    },
    {
        question: "手機和平板可以使用嗎？",
        answer: "可以。Alan English 支援電腦、平板與手機瀏覽器，學習紀錄會跟著同一個帳號保存。"
    }
];

const Showcase = () => {
    return (
        <div className="showcase">
            <Helmet>
                <title>Alan English｜兒童英文聽力與 AI 英語學習平台</title>
                <meta
                    name="description"
                    content="Alan English 結合教材音檔、AI 英文教材、情境會話與學習進度，幫助國小學生養成每天主動學英文的習慣。"
                />
                <link rel="canonical" href="https://alanenglish.com.tw/home" />
                <meta property="og:title" content="Alan English｜每天聽一點，英文進步一點" />
                <meta
                    property="og:description"
                    content="專為國小學生設計的英文聽力與 AI 學習平台，免費體驗 7 天。"
                />
                <meta property="og:url" content="https://alanenglish.com.tw/home" />
                <meta property="og:type" content="website" />
            </Helmet>

            <ShowcaseNavbar
                nav1="#features"
                nav2="#learning-paths"
                nav3="#plans"
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
                                結合教材音檔、AI 選擇題、情境會話與學習進度，
                                讓孩子每天知道要學什麼，也讓家長看見持續累積的成果。
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
                        <span>系統化教材</span><i /><span>聽力導向</span><i /><span>口語情境</span><i /><span>成果可追蹤</span>
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
                                <div><span><BiBookOpen /></span><div><strong>回答後才看答案</strong><p>透過實際答題確認孩子是否理解。</p></div></div>
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
                                <p>由老師建立邀請並安排 E1、E3、E5、E7 班級，學生或家長自行設定密碼與驗證 Email。</p>
                                <ul>
                                    <li><span>✓</span> 在學期間免費使用</li>
                                    <li><span>✓</span> 接收老師發布的班級作業</li>
                                    <li><span>✓</span> 老師可以追蹤完成狀態</li>
                                </ul>
                                <Link to="/login">我是英文班學生 <BiChevronRight /></Link>
                            </article>
                            <article className="showcase-path-card self-study">
                                <div className="showcase-path-label">SELF-PACED LEARNING</div>
                                <div className="showcase-path-icon"><BiBookOpen /></div>
                                <h3>網購教材／自主學習</h3>
                                <p>先免費體驗，再購買適合程度的教材；開通後按照孩子自己的時間安排進度。</p>
                                <ul>
                                    <li><span>✓</span> 購買教材免費使用網站三個月</li>
                                    <li><span>✓</span> 只顯示已購買或已開通的教材</li>
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
                            <p>播放次數、完成狀態與學習進度都會保存，幫助孩子建立成就感，也讓家長與老師更容易掌握狀況。</p>
                        </div>
                        <div className="showcase-stat-grid">
                            <div className="showcase-stat-card"><span>LISTENING</span><strong>7×</strong><p>重複練習目標</p></div>
                            <div className="showcase-stat-card"><span>PROGRESS</span><strong>100%</strong><p>教材完成狀態</p></div>
                            <div className="showcase-stat-card"><span>HISTORY</span><strong>24/7</strong><p>隨時查看紀錄</p></div>
                        </div>
                    </div>
                </section>

                <section id="plans" className="showcase-section showcase-plans-section">
                    <span id="pricing" className="showcase-pricing-anchor" aria-hidden="true" />
                    <div className="showcase-shell">
                        <div className="showcase-section-heading showcase-section-heading-center">
                            <span className="showcase-kicker">CHOOSE YOUR PLAN</span>
                            <h2>先免費體驗，再購買適合孩子的教材。</h2>
                            <p>購買教材免費取得三個月網站權限；到期後再決定是否以每月 NT$399 繼續使用。</p>
                        </div>
                        <div className="showcase-trial-banner">
                            <div className="showcase-trial-copy">
                                <span className="showcase-trial-label">7-DAY GUIDED TRIAL</span>
                                <h3>先讓孩子試學 7 天，再決定適合哪一套教材。</h3>
                                <p>不需信用卡、不會自動扣款。試用期間會提供獨立引導內容，不需要先準備實體教材。</p>
                            </div>

                            <ul>
                                {plans[0].points.map((point) => (
                                    <li key={point}>
                                        <span>✓</span>
                                        {point}
                                    </li>
                                ))}
                            </ul>

                            <Link
                                className="showcase-primary-btn"
                                to={plans[0].href}
                            >
                                {plans[0].action}
                                <BiChevronRight />
                            </Link>
                        </div>

                        <div className="showcase-plan-grid">
                            {plans.slice(1).map((plan) => (
                                <article
                                    className={
                                        "showcase-plan-card" +
                                        (plan.featured ? " featured" : "")
                                    }
                                    key={plan.name}
                                >
                                    {plan.badge && (
                                        <span className="showcase-plan-popular">
                                            {plan.badge}
                                        </span>
                                    )}

                                    <small>{plan.label}</small>

                                    <h3>{plan.name}</h3>

                                    <div className="showcase-plan-price">
                                        <strong>{plan.price}</strong>
                                        <span>{plan.period}</span>
                                    </div>

                                    <p>{plan.description}</p>

                                    <ul>
                                        {plan.points.map((point) => (
                                            <li key={point}>
                                                <span>✓</span>
                                                {point}
                                            </li>
                                        ))}
                                    </ul>

                                    <Link
                                        className={
                                            plan.featured
                                                ? "showcase-primary-btn"
                                                : "showcase-secondary-btn"
                                        }
                                        to={plan.href}
                                    >
                                        {plan.action}
                                        <BiChevronRight />
                                    </Link>
                                </article>
                            ))}
                        </div>

                        <div className="showcase-plan-comparison" aria-label="Alan English 方案比較">
                            <div className="showcase-plan-comparison-heading">
                                <span className="showcase-kicker">PLAN COMPARISON</span>
                                <h3>每一種身分，都有清楚的使用方式。</h3>
                            </div>
                            <p className="showcase-plan-scroll-hint" aria-hidden="true">← 左右滑動查看完整方案 →</p>
                            <div className="showcase-plan-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>比較項目</th>
                                            <th>7 天試用</th>
                                            <th>教材方案</th>
                                            <th>一般會員</th>
                                            <th>英文班學生</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {planComparison.map((row) => (
                                            <tr key={row.label}>
                                                <th scope="row">{row.label}</th>
                                                <td>{row.trial}</td>
                                                <td>{row.textbook}</td>
                                                <td>{row.regular}</td>
                                                <td>{row.academy}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <p className="showcase-plan-note">教材售價將依程度與教材組合顯示，結帳前會清楚列出教材內容、運費與使用期限。</p>
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
                            <p>先免費體驗 7 天，再選擇適合程度的教材，免費取得三個月完整學習權限。</p>
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
                    <div className="showcase-footer-links"><Link to="/">教材音檔</Link><Link to="/login">登入</Link><Link to="/freetrial">免費試用</Link></div>
                    <p>© {new Date().getFullYear()} Alan English. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Showcase;
