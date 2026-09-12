import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiRefreshCw, FiVolume2 } from "react-icons/fi";
import { createPictureChallengeRound, tokenizeSpeakingSentence } from "../../utils/speakingPictureChallenge";
import SpeakingPracticeSteps from "./SpeakingPracticeSteps";
import SpeakingVisualAid from "./SpeakingVisualAid";

const copyByType = {
    picture_qa: {
        eyebrow: "P21 看圖問答",
        title: "看到圖片，問完再回答",
        instruction: "畫面只會顯示圖片。請把完整英文問句和完整回答連在一起說出來。",
        promptTitle: "輪到你看圖問答",
        promptDetail: "按下麥克風，先說完整問句，再接著說完整回答。"
    },
    picture_gap_sentence: {
        eyebrow: "P22 看圖補句",
        title: "看圖片，說完整句子",
        instruction: "先看圖片和句型。空格要用圖片答案補上，再把整句英文說出來。",
        promptTitle: "輪到你說完整句子",
        promptDetail: "可以點句型中的單字聽發音；空格答案不會播放。"
    }
};

export default function WorkbookOnePictureChallenge({ challenge, firebaseUser, onComplete, onExit }) {
    const interactionType = String(challenge?.generation_metadata?.interaction_type || "");
    const gapMode = interactionType === "picture_gap_sentence";
    const copy = copyByType[interactionType] || copyByType.picture_qa;
    const sourceQuestions = useMemo(() => [...(challenge?.speaking_questions || [])]
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)), [challenge]);
    const [phase, setPhase] = useState("instructions");
    const [round, setRound] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [audioToken, setAudioToken] = useState(null);
    const [audioError, setAudioError] = useState("");
    const audioRef = useRef(null);

    const stopAudio = () => {
        audioRef.current?.pause();
        audioRef.current = null;
        setAudioToken(null);
    };

    useEffect(() => () => stopAudio(), []);
    useEffect(() => {
        stopAudio();
        setPhase("instructions");
        setRound([]);
        setActiveIndex(0);
        setAudioError("");
    }, [challenge?.id, interactionType]);

    const startRound = () => {
        stopAudio();
        setRound(createPictureChallengeRound(sourceQuestions));
        setActiveIndex(0);
        setAudioError("");
        setPhase("challenge");
    };

    const activeQuestion = round[activeIndex];
    const sentenceTokens = useMemo(() => tokenizeSpeakingSentence(
        activeQuestion?.picture_interaction?.sentence_pattern
    ), [activeQuestion]);
    const wordAudioByToken = useMemo(() => new Map(
        (activeQuestion?.picture_interaction?.word_audio || [])
            .map(item => [Number(item.token_index), item])
    ), [activeQuestion]);

    const playWord = token => {
        const item = wordAudioByToken.get(token.tokenIndex);
        if (!item?.audio_url) return;
        stopAudio();
        setAudioError("");
        setAudioToken(token.tokenIndex);
        const audio = new Audio(item.audio_url);
        audioRef.current = audio;
        const clear = () => {
            audioRef.current = null;
            setAudioToken(null);
        };
        audio.onended = clear;
        audio.onerror = () => {
            clear();
            setAudioError("這個單字的發音暫時無法播放，請稍後再試。");
        };
        audio.play().catch(() => {
            clear();
            setAudioError("瀏覽器阻擋了播放，請再按一次單字。");
        });
    };

    const handleCorrect = async result => {
        const saved = await onComplete?.(activeQuestion, result);
        if (saved === false) return;
        stopAudio();
        if (activeIndex >= round.length - 1) setPhase("result");
        else setActiveIndex(index => index + 1);
    };

    if (phase === "instructions") return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page speaking-picture-page">
        <header className="speaking-lesson-header"><button className="speaking-back" type="button" onClick={onExit}><FiChevronLeft />全部大挑戰</button><div className="speaking-lesson-heading"><span>{copy.eyebrow}</span><h1>{challenge.title}</h1><p>{copy.instruction}</p></div></header>
        <section className="speaking-foundation-intro"><FiVolume2 aria-hidden="true" /><h2>{copy.title}</h2><p>{copy.instruction}</p><button type="button" className="primary" onClick={startRound}>開始挑戰</button></section>
    </main>;

    if (phase === "result") return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page speaking-picture-page">
        <section className="speaking-foundation-result"><span aria-hidden="true">★</span><h1>太棒了，全部完成！</h1><p>你已完成這一組看圖口說挑戰。</p><div className="speaking-foundation-actions"><button type="button" className="primary" onClick={startRound}><FiRefreshCw />再玩一次</button><button type="button" className="secondary" onClick={onExit}>回全部大挑戰</button></div></section>
    </main>;

    if (!activeQuestion) return null;
    const progress = Math.round((activeIndex / Math.max(round.length, 1)) * 100);

    return <main className="speaking-challenge-page speaking-challenge-detail speaking-foundation-page speaking-picture-page">
        <header className="speaking-lesson-header">
            <button className="speaking-back" type="button" onClick={onExit}><FiChevronLeft />退出本輪</button>
            <div className="speaking-lesson-heading"><span>{copy.eyebrow}</span><h1>{challenge.title}</h1><p>{copy.instruction}</p></div>
            <div className="speaking-lesson-progress"><div><span>第 {activeIndex + 1} / {round.length} 題</span><strong>{progress}%</strong></div><div className="speaking-progress-track" role="progressbar" aria-label="本輪進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div></div>
        </header>
        <section className="speaking-question-stage"><article key={activeQuestion.id} className="speaking-focus-card speaking-foundation-card speaking-picture-card">
            <span className="speaking-foundation-count">第 {activeIndex + 1} 題，共 {round.length} 題</span>
            <SpeakingVisualAid aid={activeQuestion.visual_aid} showCaption={false} />
            {gapMode && <div className="speaking-gap-sentence" aria-label={activeQuestion.picture_interaction?.sentence_pattern}>
                {sentenceTokens.map(token => token.kind === "word"
                    ? <button type="button" key={token.tokenIndex} onClick={() => playWord(token)} disabled={!wordAudioByToken.get(token.tokenIndex)?.audio_url || audioToken !== null} aria-label={`播放 ${token.text} 的發音`}><FiVolume2 aria-hidden="true" />{token.text}</button>
                    : token.kind === "blank"
                        ? <span key={token.tokenIndex} className="answer-blank" aria-label="請依圖片補上的答案">____</span>
                        : <span key={token.tokenIndex} className="punctuation" aria-hidden="true">{token.text}</span>)}
            </div>}
            {audioError && <p className="speaking-foundation-warning" role="alert">{audioError}</p>}
            <SpeakingPracticeSteps
                key={activeQuestion.id}
                firebaseUser={firebaseUser}
                question={activeQuestion}
                interactionType={interactionType}
                hideHelp
                promptTitle={copy.promptTitle}
                promptDetail={copy.promptDetail}
                onCompleted={handleCorrect}
            />
        </article></section>
    </main>;
}
