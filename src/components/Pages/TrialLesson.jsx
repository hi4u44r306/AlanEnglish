import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCheck, FiHeadphones, FiMic, FiPlayCircle, FiVolume2 } from "react-icons/fi";
import "./css/TrialLesson.scss";

// One free lesson, open to anyone: Workbook 1, page 28, colours. Everything on this page is
// self-contained — no account, no paid speech scoring, nothing sent to the server.
const VIDEO_ID = "IgMCnPvCHyI";
const VIDEO_START = 886;
export const SAMPLE_AUDIO = "/samples/workbook-1-p28.mp3";

export const COLOUR_QUESTIONS = [
    { id: "apple", thing: "apple", zh: "蘋果", answer: "red", swatch: "#e53935" },
    { id: "banana", thing: "banana", zh: "香蕉", answer: "yellow", swatch: "#fdd835" },
    { id: "forest", thing: "forest", zh: "森林", answer: "green", swatch: "#43a047" },
    { id: "sky", thing: "sky", zh: "天空", answer: "blue", swatch: "#1e88e5" },
    { id: "eggplant", thing: "eggplant", zh: "茄子", answer: "purple", swatch: "#8e24aa" },
    { id: "cloud", thing: "cloud", zh: "雲", answer: "white", swatch: "#ffffff" },
    { id: "coffee", thing: "coffee", zh: "咖啡", answer: "brown", swatch: "#6d4c41" },
    { id: "hair", thing: "hair", zh: "頭髮", answer: "black", swatch: "#212121", your: true }
];

const questionText = item => `What color is ${item.your ? "your" : "the"} ${item.thing}?`;
const answerText = item => `It's ${item.answer}.`;

const speak = text => {
    if (typeof window === "undefined" || !window.speechSynthesis) return false;
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
};

export default function TrialLesson() {
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [done, setDone] = useState(() => new Set());
    const [audioMissing, setAudioMissing] = useState(false);
    const [videoOpen, setVideoOpen] = useState(false);
    const canSpeak = typeof window !== "undefined" && Boolean(window.speechSynthesis);
    const cardRef = useRef(null);
    const item = COLOUR_QUESTIONS[index];
    const finished = done.size === COLOUR_QUESTIONS.length;

    useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

    const reveal = () => {
        setRevealed(true);
        setDone(current => new Set(current).add(item.id));
    };
    const next = () => {
        setRevealed(false);
        setIndex(current => (current + 1) % COLOUR_QUESTIONS.length);
        cardRef.current?.focus({ preventScroll: true });
    };

    return (
        <main className="trial-lesson">
            <Helmet>
                <title>免費試聽一課：顏色｜Alan English</title>
                <meta name="description" content="不用登入，免費試聽 Alan English Workbook 1 第 28 頁「顏色」：看老師教、聽課本音檔、自己開口說。" />
            </Helmet>

            <header className="trial-lesson__hero">
                <span className="trial-lesson__tag">免費試聽 · 不用登入</span>
                <h1>顏色</h1>
                <p>Workbook 1 · 第 28 頁</p>
                <ol className="trial-lesson__path" aria-label="這一課怎麼學">
                    <li><a href="#trial-watch"><FiPlayCircle aria-hidden="true" />看老師教</a></li>
                    <li><a href="#trial-listen"><FiHeadphones aria-hidden="true" />聽課本</a></li>
                    <li><a href="#trial-speak"><FiMic aria-hidden="true" />自己說</a></li>
                </ol>
            </header>

            <section className="trial-lesson__step" id="trial-watch" aria-labelledby="trial-watch-title">
                <h2 id="trial-watch-title"><span>1</span>看老師教</h2>
                <div className="trial-lesson__video">
                    {videoOpen
                        ? <iframe
                            title="Workbook 1 第 28 頁教學影片"
                            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?start=${VIDEO_START}&autoplay=1&rel=0`}
                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                        : <button type="button" onClick={() => setVideoOpen(true)} aria-label="播放第 28 頁教學影片">
                            <img src={`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`} alt="" loading="lazy" />
                            <span><FiPlayCircle aria-hidden="true" />播放影片</span>
                        </button>}
                </div>
            </section>

            <section className="trial-lesson__step" id="trial-listen" aria-labelledby="trial-listen-title">
                <h2 id="trial-listen-title"><span>2</span>聽課本</h2>
                {audioMissing
                    ? <p className="trial-lesson__notice" role="status">這一頁的試聽音檔正在準備中。</p>
                    : <audio className="trial-lesson__audio" controls preload="none" src={SAMPLE_AUDIO} onError={() => setAudioMissing(true)}>你的瀏覽器不支援播放音檔。</audio>}
            </section>

            <section className="trial-lesson__step" id="trial-speak" aria-labelledby="trial-speak-title">
                <h2 id="trial-speak-title"><span>3</span>自己說</h2>
                <div className="trial-lesson__card" ref={cardRef} tabIndex={-1} aria-live="polite">
                    <span className="trial-lesson__count">{index + 1} / {COLOUR_QUESTIONS.length}</span>
                    <span className="trial-lesson__swatch" style={{ background: item.swatch }} aria-hidden="true" />
                    <p className="trial-lesson__question">{questionText(item)}</p>
                    <p className="trial-lesson__answer">
                        It&apos;s <b className={revealed ? "is-shown" : ""}>{revealed ? item.answer : item.zh.replace(/./g, "＿")}</b>.
                    </p>
                    <p className="trial-lesson__hint">{item.zh}是什麼顏色？先自己大聲說一次。</p>
                    <div className="trial-lesson__actions">
                        {canSpeak && <button type="button" className="is-quiet" onClick={() => speak(revealed ? `${questionText(item)} ${answerText(item)}` : questionText(item))}><FiVolume2 aria-hidden="true" />聽一次</button>}
                        {revealed
                            ? <button type="button" className="is-primary" onClick={next}>下一題<FiArrowRight aria-hidden="true" /></button>
                            : <button type="button" className="is-primary" onClick={reveal}><FiCheck aria-hidden="true" />我說完了，看答案</button>}
                    </div>
                </div>
                {finished && <p className="trial-lesson__notice is-done" role="status">8 題都說過了，很棒！</p>}
            </section>

            <footer className="trial-lesson__next">
                <h2>課本、聽力、口說、影片是一套的</h2>
                <p>每一頁都像這樣學。登入後，口說還可以錄音、看分數。</p>
                <div>
                    <Link className="is-primary" to="/support">想了解教材</Link>
                    <Link to="/login">已經有帳號，登入</Link>
                </div>
            </footer>
        </main>
    );
}
