import React from "react";

// A vector coin keeps the A legible in both the compact header and wallet detail.
export default function AEPointCoin() {
    return <svg className="ae-point-coin" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="13" r="10" fill="#c99224" />
        <circle cx="12" cy="11" r="10" fill="#ffd45a" stroke="#b98618" strokeWidth=".8" />
        <circle cx="12" cy="11" r="7.2" fill="#ffeaa1" stroke="#e9bd4e" strokeWidth="1.2" />
        <path d="M5 8.5A8 8 0 0 1 15 3.6" fill="none" stroke="#fff8d1" strokeWidth="1.2" strokeLinecap="round" />
        <path d="m8.5 15 3.5-7.5 3.5 7.5M10 12.5h4" fill="none" stroke="#906318" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>;
}
