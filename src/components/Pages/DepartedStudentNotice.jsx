import React from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiMessageCircle, FiSlash } from "react-icons/fi";
import { PUBLIC_SELF_SERVICE_BILLING_ENABLED } from "../../constants/commerceAvailability";
import "./css/DepartedStudentNotice.scss";

const KEPT = [
    "你的帳號、登入方式與全部學習紀錄",
    "XP、等級與在校期間累積的進度",
    "在校期間用過的班級教材（永久保留）與自己購買的教材"
];

const STOPPED = [
    "新的班級作業與點名",
    "目前尚未開通的學習功能（見下方「目前可用功能」）"
];

// 離校生登入會員頁時看到的說明：帳號不會被刪除，清楚列出保留什麼、停止什麼、想繼續學習怎麼做。
// 只在「已離校且目前沒有使用中的自主學習會員」時顯示（由 MembershipCenter 判斷）。
function DepartedStudentNotice() {
    return (
        <section className="departed-notice" aria-labelledby="departed-notice-heading">
            <h2 id="departed-notice-heading">你已經離開英文班，帳號會一直保留</h2>
            <p className="departed-notice__lead">謝謝你在 Alan English 的學習！不用擔心，登入後隨時都能回來看自己的紀錄。</p>

            <div className="departed-notice__columns">
                <div className="departed-notice__column is-kept">
                    <h3><FiCheckCircle aria-hidden="true" />會繼續保留</h3>
                    <ul>{KEPT.map(item => <li key={item}>{item}</li>)}</ul>
                </div>
                <div className="departed-notice__column is-stopped">
                    <h3><FiSlash aria-hidden="true" />不會再有</h3>
                    <ul>{STOPPED.map(item => <li key={item}>{item}</li>)}</ul>
                </div>
            </div>

            <div className="departed-notice__continue">
                <strong>想繼續自主學習？</strong>
                <p>
                    可以選擇「基本自主學習會員」（每月 NT$299），恢復全部正式聽力教材、會話與複習功能，不需要重買以前上課的實體書。
                    {PUBLIC_SELF_SERVICE_BILLING_ENABLED
                        ? "請在下方查看可用方案。"
                        : "目前由 Alan English 協助開通，請聯絡客服或請家長與老師聯絡。"}
                </p>
                {!PUBLIC_SELF_SERVICE_BILLING_ENABLED && (
                    <Link className="departed-notice__contact" to="/support"><FiMessageCircle aria-hidden="true" />聯絡客服</Link>
                )}
                <small>是否續用完全由你和家長決定，沒有開通也不影響帳號與已保留的紀錄。</small>
            </div>
        </section>
    );
}

export default DepartedStudentNotice;
