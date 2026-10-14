import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { FiHeadphones, FiMic, FiPlayCircle } from "react-icons/fi";
import StandaloneBackLink from "../../pwa/StandaloneBackLink";
import "./css/TrialLesson.scss";
import "./css/ParentGuide.scss";

// One screen for a parent who has never seen the books: what the site is, what a child does on
// each page, why that helps, and the free lesson. Every line describes something the site
// actually does — no promised results, no prices.
const STEPS = [
    { icon: FiPlayCircle, label: "看老師教" },
    { icon: FiHeadphones, label: "聽課本" },
    { icon: FiMic, label: "自己說" }
];

const REASONS = [
    { title: "跟著課本走", text: "網站上練的，就是手上課本的那一頁。" },
    { title: "真的有聽才算", text: "要實際聽了大部分才算一次。" },
    { title: "家長看得到", text: "每週一份報告：聽了幾次、口說過了幾關。" }
];

export default function ParentGuide() {
    return (
        <main className="trial-lesson parent-guide">
            <StandaloneBackLink />
            <Helmet>
                <title>給家長：Alan English 是什麼｜Alan English</title>
                <meta name="description" content="Alan English 是配合課本的英文練習網站：課本翻到哪一頁，就有那一頁的老師教學影片、聽力與口說練習。" />
            </Helmet>

            <header className="trial-lesson__hero">
                <span className="trial-lesson__tag">給家長</span>
                <h1 className="parent-guide__title">課本翻到哪一頁，<br />網站就練哪一頁</h1>
                <p>每一頁課本，孩子做三件事：</p>
                <ol className="trial-lesson__path parent-guide__steps" aria-label="每一頁課本做的三件事">
                    {STEPS.map(step => <li key={step.label}><span><step.icon aria-hidden="true" />{step.label}</span></li>)}
                </ol>
            </header>

            <ul className="parent-guide__reasons">
                {REASONS.map(item => <li key={item.title}><strong>{item.title}</strong><span>{item.text}</span></li>)}
            </ul>

            <p className="parent-guide__note">國小學生適用。手機、平板、電腦都能用，不用安裝。</p>

            <footer className="trial-lesson__next">
                <h2>先試一課，再決定</h2>
                <div>
                    <Link className="is-primary" to="/try">免費試一課：顏色</Link>
                    <Link to="/support">想買教材，聯絡我們</Link>
                </div>
            </footer>
        </main>
    );
}
