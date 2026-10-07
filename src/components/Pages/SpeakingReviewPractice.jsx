import React, { useEffect, useRef, useState } from "react";
import SpeakingPronunciationRecorder from "./SpeakingPronunciationRecorder";
import SpeakingVisualAid from "./SpeakingVisualAid";
import { FiChevronLeft } from "react-icons/fi";
import "./css/SpeakingReviewPractice.scss";

export default function SpeakingReviewPractice({ challenge, onExit }) {
    const [index, setIndex] = useState(0);
    const [audioError, setAudioError] = useState("");
    const [recorderPhase, setRecorderPhase] = useState("ready");
    const audioRef = useRef(null);
    const questions = challenge.speaking_questions || [];
    const question = questions[index];
    const alphabet = challenge.generation_metadata?.interaction_type === "alphabet_round";
    const segment = challenge.alphabet_audio?.segments?.find(item => Number(item.question_id) === Number(question?.id));
    const audioUrl = alphabet ? challenge.alphabet_audio?.audio_url : question?.model_audio_url || question?.picture_interaction?.sentence_audio_url;
    const stopAudio = () => { audioRef.current?.pause(); audioRef.current = null; };
    useEffect(() => stopAudio, [index]); // eslint-disable-line react-hooks/exhaustive-deps
    const play = () => {
        stopAudio(); setAudioError("");
        const audio = new Audio(audioUrl); audioRef.current = audio;
        if (segment) {
            audio.onloadedmetadata = () => { audio.currentTime = Number(segment.start_ms) / 1000; };
            audio.ontimeupdate = () => { if (audio.currentTime >= Number(segment.end_ms) / 1000) audio.pause(); };
        }
        audio.onerror = () => setAudioError("示範暫時無法播放，請稍後再試。");
        Promise.resolve(audio.play()).catch(() => setAudioError("請再按一次播放示範。"));
    };
    return <main className="speaking-challenge-page speaking-challenge-detail speaking-review-practice">
        <header className="speaking-lesson-header"><button type="button" className="speaking-back" aria-label="返回地圖，換一關" onClick={onExit}><FiChevronLeft aria-hidden="true" /><span>返回地圖，換一關</span></button><div className="speaking-lesson-heading"><span>錄音回聽練習</span><h1>{challenge.title}</h1></div></header>
        <p className="speaking-review-notice" role="status">{challenge.practice_reason || "這一關今天已完成，明天可以再挑戰。"}現在可以聽示範、錄音回聽，或返回地圖換一關。</p>
        {question && <section className="speaking-question-stage"><article className="speaking-focus-card">
            <p>第 {index + 1} / {questions.length} 題 · 練習不送評、不計通關</p>
            <SpeakingVisualAid aid={question.visual_aid} showCaption={false} />
            <h2 className={alphabet ? "speaking-review-letter" : ""}>{alphabet ? question.model_answer || question.question_text : question.question_text}</h2>
            {!alphabet && question.model_answer && <p>示範答案：{question.model_answer}</p>}
            {audioUrl && <button type="button" onClick={play} disabled={["recording", "preparing", "assessing"].includes(recorderPhase)}>聽示範</button>}
            {audioError && <p role="alert">{audioError}</p>}
            <SpeakingPronunciationRecorder key={question.id} question={question} interactionType={alphabet ? "alphabet_round" : question.interaction_type || challenge.generation_metadata?.interaction_type} onPhaseChange={setRecorderPhase} onRetry={stopAudio} practiceOnly />
        </article></section>}
        <nav className="speaking-question-navigation" aria-label="練習題目切換"><button type="button" disabled={index === 0} onClick={() => setIndex(value => value - 1)}>上一題</button><button type="button" disabled={index >= questions.length - 1} onClick={() => setIndex(value => value + 1)}>下一題</button></nav>
    </main>;
}
