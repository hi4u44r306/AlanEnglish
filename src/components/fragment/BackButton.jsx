import React from "react";
import { Link } from "react-router-dom";
import { FiChevronLeft } from "react-icons/fi";
import "../assets/scss/BackButton.scss";

// 全站統一的返回鈕：白色圓形加箭頭（和冒險地圖左上角那顆同款）。給 label 時變成「箭頭＋文字」的膠囊。
// 傳 to 會是連結，傳 onClick 會是按鈕；沒有文字時一定要有 ariaLabel 給讀屏使用者。
const BackButton = ({ to, onClick, label, ariaLabel, className = "" }) => {
    const classes = `ae-back-button${label ? " ae-back-button--labeled" : ""} ${className}`.trim();
    const content = <><FiChevronLeft aria-hidden="true" />{label && <span>{label}</span>}</>;
    return to
        ? <Link className={classes} to={to} aria-label={ariaLabel || label}>{content}</Link>
        : <button className={classes} type="button" onClick={onClick} aria-label={ariaLabel || label}>{content}</button>;
};

export default BackButton;
