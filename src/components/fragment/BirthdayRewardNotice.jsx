import React from "react";

export default function BirthdayRewardNotice({ birthday }) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (!birthday?.enabled || !birthday.is_birthday_month || birthday.evaluated_on !== today) return null;
    return <section className="birthday-notice" aria-labelledby="birthday-notice-heading">
        <h2 id="birthday-notice-heading">生日月快樂！</h2>
        {birthday.xp_multiplier === 2 && <p>這個月有效學習獲得的經驗值 ×2，活動至 {birthday.ends_on?.slice(5).replace("-", "/")}。</p>}
        {birthday.gift_status === "received" && <p>今年的生日禮 <strong>{Number(birthday.gift_points).toLocaleString("zh-TW")} AE Points</strong> 已入帳，祝你學習冒險愉快！</p>}
        {birthday.gift_status === "not_eligible" && <p>AE Points 生日禮限有效在校英文班學生領取。</p>}
    </section>;
}
