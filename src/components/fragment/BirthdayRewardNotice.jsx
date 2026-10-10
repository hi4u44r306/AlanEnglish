import React, { useRef, useState } from "react";
import { FiX } from "react-icons/fi";

const preferenceKey = ownerUid => `ae-birthday-notice-hidden-v1:${encodeURIComponent(ownerUid)}`;
const readHidden = ownerUid => {
    if (!ownerUid) return false;
    try { return window.localStorage.getItem(preferenceKey(ownerUid)) === "1"; }
    catch { return false; }
};

// Remount preferences when the signed-in account changes, even without a route change.
export default function BirthdayRewardNotice(props) {
    return <BirthdayNotice key={props.ownerUid || "anonymous"} {...props} />;
}

function BirthdayNotice({ birthday, ownerUid, onDismiss }) {
    const [hidden, setHidden] = useState(() => readHidden(ownerUid));
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [saveError, setSaveError] = useState("");
    const closeButton = useRef(null);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (hidden || !birthday?.enabled || !birthday.is_birthday_month || birthday.evaluated_on !== today) return null;
    const dismiss = permanent => {
        if (permanent) {
            try { window.localStorage.setItem(preferenceKey(ownerUid), "1"); }
            catch { setSaveError("這個瀏覽器無法記住設定，請先選擇暫時關閉。"); return; }
        }
        setHidden(true);
        onDismiss?.();
    };
    const cancelOptions = event => {
        if (event.key !== "Escape" || !optionsOpen) return;
        event.stopPropagation();
        setOptionsOpen(false);
        setSaveError("");
        closeButton.current?.focus();
    };
    return <section className="birthday-notice" aria-labelledby="birthday-notice-heading" onKeyDown={cancelOptions}>
        <div className="birthday-notice__heading">
            <h2 id="birthday-notice-heading">生日月快樂！</h2>
            {ownerUid && <button ref={closeButton} type="button" className="birthday-notice__close" aria-label="關閉生日月祝福" aria-expanded={optionsOpen} aria-controls="birthday-notice-options" onClick={() => { setOptionsOpen(!optionsOpen); setSaveError(""); }}><FiX aria-hidden="true" /></button>}
        </div>
        {birthday.xp_multiplier === 2 && <p>這個月有效學習獲得的經驗值 ×2，活動至 {birthday.ends_on?.slice(5).replace("-", "/")}。</p>}
        {birthday.gift_status === "received" && <p>今年的生日禮 <strong>{Number(birthday.gift_points).toLocaleString("zh-TW")} AE Points</strong> 已入帳，祝你學習冒險愉快！</p>}
        {birthday.gift_status === "not_eligible" && <p>AE Points 生日禮限有效在校英文班學生領取。</p>}
        {ownerUid && optionsOpen && <div id="birthday-notice-options" className="birthday-notice__options" role="group" aria-label="生日月祝福顯示選項">
            <p>關閉祝福不影響生日月獎勵。</p>
            <div className="birthday-notice__choices">
                <button type="button" onClick={() => dismiss(false)}><strong>暫時關閉</strong><span>下次開啟今日學習時再顯示</span></button>
                <button type="button" onClick={() => dismiss(true)}><strong>不再顯示</strong><span>在這個瀏覽器記住此帳號的選擇</span></button>
            </div>
            {saveError && <p className="birthday-notice__error" role="alert">{saveError}</p>}
        </div>}
    </section>;
}
