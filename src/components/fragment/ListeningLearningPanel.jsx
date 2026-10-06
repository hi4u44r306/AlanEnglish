import React from "react";
import { FiHeadphones, FiMessageCircle } from "react-icons/fi";

function ListeningLearningPanel({ currentTrack, playingStatus, speakingPreparation }) {
    return <aside className="listening-learning-panel" aria-label="目前學習區">
        <div className="listening-learning-panel__top"><span aria-hidden="true"><FiHeadphones /></span><h2>{currentTrack ? "這次正在練習" : "準備好耳朵了嗎？"}</h2></div>
        {currentTrack ? <div className="listening-learning-panel__track" aria-live="polite">
            <span className={`listening-learning-panel__status${playingStatus ? " is-playing" : ""}`}>{playingStatus ? "正在聆聽" : "已暫停"}</span>
            <h3>{currentTrack.title || currentTrack.music_name || currentTrack.musicName || currentTrack.page || "教材音檔"}</h3>
            {currentTrack.page && <p>{currentTrack.page}</p>}
            <a href={`#listening-track-${currentTrack.id}`}>在清單中找到這個音檔</a>
        </div> : <p className="listening-learning-panel__intro">從清單選一個音檔，按黃色「播放」按鈕開始。</p>}
        {currentTrack && <p className="listening-learning-panel__hint"><FiMessageCircle aria-hidden="true" />{speakingPreparation ? "先聽清楚，再回口說關卡試著自己回答。" : "先專心聽，再試著跟讀一句英文。"}</p>}
        <details className="listening-learning-panel__help"><summary>聽力怎麼練？</summary><ol><li>先聽懂聲音與句子。</li><li>跟著音檔開口練習。</li><li>想再聽一次，使用播放器的重複播放。</li></ol><p>學生以原速或較慢速度真正聽滿 80%，經系統確認後才計一次；拖到結尾不會增加有效聆聽。</p><p>有字幕的音檔，可在播放器切換英文、中文提示或逐字稿；手機先點音檔名稱展開播放器。</p></details>
    </aside>;
}

export default ListeningLearningPanel;
