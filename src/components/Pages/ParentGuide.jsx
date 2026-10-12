import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { FiBookOpen, FiHeadphones, FiMail, FiMic, FiPlayCircle, FiSmartphone } from "react-icons/fi";
import "./css/TrialLesson.scss";
import "./css/ParentGuide.scss";

// A plain explanation for a parent who has never seen the books: what the site is, what comes
// with the textbooks, and how it helps. Every statement here describes something the site
// actually does — no promised results, no prices.
const DAILY = [
    { icon: FiPlayCircle, title: "看老師教", text: "老師的教學影片，從這一頁開始播。" },
    { icon: FiHeadphones, title: "聽課本", text: "課本這一頁的音檔，想聽幾次就聽幾次。" },
    { icon: FiMic, title: "自己說", text: "一次一句，說對了再往下。" }
];

const INCLUDED = [
    { icon: FiBookOpen, title: "課本", text: "Workbook 與 Basic Reading 系列，一頁一個小主題。" },
    { icon: FiHeadphones, title: "每一頁的聽力", text: "翻到第幾頁，網站上就是第幾頁的音檔。" },
    { icon: FiMic, title: "每一頁的口說練習", text: "照著課本的句子開口說，有即時回饋。" },
    { icon: FiPlayCircle, title: "老師的教學影片", text: "Workbook 1–4 的大部分頁面，都能直接跳到老師講解那一頁的地方。" },
    { icon: FiMail, title: "給家長的每週報告", text: "每週一封 Email：這週聽了幾次、口說過了幾關。" }
];

const HELPS = [
    { title: "跟著課本走", text: "孩子在網站上練的，就是手上課本的那一頁，不會東學一點、西學一點。" },
    { title: "真的有聽才算", text: "同一頁可以反覆聽；要實際聽了大部分才算一次，直接拖到最後不算。" },
    { title: "敢開口", text: "一次只說一句，說對了才往下一句，孩子不用一次面對一大段。" },
    { title: "家長看得到", text: "不用盯著孩子，也能從每週報告知道這週練了多少。" }
];

const FAQ = [
    { q: "適合幾歲的孩子？", a: "這套教材與網站是為國小學生設計的。" },
    { q: "需要什麼設備？", a: "手機、平板或電腦的瀏覽器都可以，不用另外安裝。也可以把網站加到手機桌面，像 App 一樣點開。", link: { to: "/install", label: "看怎麼加到手機桌面" } },
    { q: "沒有課本可以用嗎？", a: "可以先免費試一課，看看課本、聽力、口說和影片是怎麼搭配的。", link: { to: "/try", label: "免費試一課" } }
];

export default function ParentGuide() {
    return (
        <main className="trial-lesson parent-guide">
            <Helmet>
                <title>給家長：Alan English 是什麼｜Alan English</title>
                <meta name="description" content="Alan English 是配合課本的英文練習網站：課本翻到哪一頁，就有那一頁的老師教學影片、聽力與口說練習，家長每週收到學習報告。" />
            </Helmet>

            <header className="trial-lesson__hero">
                <span className="trial-lesson__tag">給家長</span>
                <h1 className="parent-guide__title">課本翻到哪一頁，<br />網站就練哪一頁</h1>
                <p>Alan English 是配合課本的英文練習網站。</p>
            </header>

            <section className="parent-guide__section" aria-labelledby="parent-daily">
                <h2 id="parent-daily">孩子每天做三件事</h2>
                <ol className="parent-guide__steps">
                    {DAILY.map((step, index) => <li key={step.title}>
                        <span className="parent-guide__number">{index + 1}</span>
                        <step.icon aria-hidden="true" />
                        <div><strong>{step.title}</strong><p>{step.text}</p></div>
                    </li>)}
                </ol>
                <Link className="parent-guide__try" to="/try">免費試一課：顏色</Link>
            </section>

            <section className="parent-guide__section" aria-labelledby="parent-included">
                <h2 id="parent-included">一套教材裡有什麼</h2>
                <ul className="parent-guide__list">
                    {INCLUDED.map(item => <li key={item.title}>
                        <item.icon aria-hidden="true" />
                        <div><strong>{item.title}</strong><p>{item.text}</p></div>
                    </li>)}
                </ul>
            </section>

            <section className="parent-guide__section" aria-labelledby="parent-helps">
                <h2 id="parent-helps">對孩子有什麼幫助</h2>
                <ul className="parent-guide__cards">
                    {HELPS.map(item => <li key={item.title}><strong>{item.title}</strong><p>{item.text}</p></li>)}
                </ul>
            </section>

            <section className="parent-guide__section" aria-labelledby="parent-faq">
                <h2 id="parent-faq">常見問題</h2>
                <div className="parent-guide__faq">
                    {FAQ.map(item => <details key={item.q}>
                        <summary>{item.q}</summary>
                        <p>{item.a}{item.link && <> <Link to={item.link.to}>{item.link.label}</Link></>}</p>
                    </details>)}
                </div>
            </section>

            <footer className="trial-lesson__next">
                <h2>想知道教材怎麼買？</h2>
                <p>告訴我們孩子的年級，我們會回覆適合的教材與購買方式。</p>
                <div>
                    <Link className="is-primary" to="/support"><FiSmartphone aria-hidden="true" />聯絡我們</Link>
                    <Link to="/try">先免費試一課</Link>
                </div>
            </footer>
        </main>
    );
}
