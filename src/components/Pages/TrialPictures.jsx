import React from "react";

// Flat drawings for the free lesson, so every phone shows the same picture. Each one is drawn in
// the colour the child is asked to name.
const INK = "#17365d";
const pictures = {
    apple: <>
        <path d="M60 40c-14-9-34-2-34 22 0 20 14 38 26 38 4 0 6-2 8-2s4 2 8 2c12 0 26-18 26-38 0-24-20-31-34-22z" fill="#e53935" />
        <path d="M44 52c-5 3-8 9-8 16" stroke="#ff8a80" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M60 42c0-8 3-14 8-18" stroke="#6d4c41" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M66 28c8-8 20-6 22 0-8 6-18 6-22 0z" fill="#43a047" />
    </>,
    banana: <>
        <path d="M26 46c4 30 28 50 62 44 6-1 8-6 4-9-26 4-46-12-52-38-2-6-15-4-14 3z" fill="#fdd835" />
        <path d="M30 50c5 24 24 40 50 38" stroke="#f9a825" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M27 44l-3-12 10-3 5 12z" fill="#8d6e63" />
        <path d="M88 92l7 3 1-8z" fill="#6d4c41" />
    </>,
    forest: <>
        <rect x="54" y="74" width="12" height="28" rx="3" fill="#795548" />
        <circle cx="60" cy="50" r="30" fill="#43a047" />
        <circle cx="40" cy="64" r="18" fill="#388e3c" />
        <circle cx="80" cy="64" r="18" fill="#388e3c" />
        <circle cx="52" cy="40" r="8" fill="#66bb6a" />
    </>,
    sky: <>
        <rect x="14" y="18" width="92" height="84" rx="18" fill="#42a5f5" />
        <circle cx="84" cy="40" r="11" fill="#ffd84d" />
        <path d="M30 78a9 9 0 0 1 3-17 13 13 0 0 1 25-2 10 10 0 0 1 6 19z" fill="#e3f2fd" />
    </>,
    eggplant: <>
        <path d="M76 34c18 12 18 44-4 60-16 12-40 6-44-12-4-16 14-22 26-32 8-7 12-20 22-16z" fill="#8e24aa" />
        <path d="M44 74c-4 6-2 14 6 16" stroke="#ce93d8" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M64 30c6-8 18-8 24 0l-6 10c-4-4-10-4-14 0z" fill="#43a047" />
        <path d="M80 24l6-10" stroke="#2e7d32" strokeWidth="6" strokeLinecap="round" />
    </>,
    cloud: <>
        <rect x="14" y="18" width="92" height="84" rx="18" fill="#5c9bd6" />
        <path d="M36 82a15 15 0 0 1 4-29 21 21 0 0 1 40-4 16 16 0 0 1 6 33z" fill="#fff" />
    </>,
    coffee: <>
        <path d="M30 46h52v26c0 16-10 26-26 26S30 88 30 72z" fill="#fff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M82 54h8c12 0 12 22 0 22h-8" fill="none" stroke={INK} strokeWidth="4" />
        <ellipse cx="56" cy="50" rx="24" ry="7" fill="#6d4c41" />
        <path d="M46 34c-5-6 5-9 0-16M62 34c-5-6 5-9 0-16" stroke="#b0bec5" strokeWidth="4" strokeLinecap="round" fill="none" />
    </>,
    hair: <>
        <circle cx="60" cy="62" r="30" fill="#ffd9b3" />
        <path d="M30 60c-4-26 14-40 30-40s34 14 30 40c-6-12-14-18-30-18s-24 6-30 18z" fill="#9e9e9e" />
        <circle cx="49" cy="64" r="3.5" fill={INK} />
        <circle cx="71" cy="64" r="3.5" fill={INK} />
        <path d="M40 76c6 12 34 12 40 0-4 10-10 16-20 16s-16-6-20-16z" fill="#bdbdbd" />
        <path d="M52 78c4 4 12 4 16 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
};

export const TRIAL_PICTURE_IDS = Object.keys(pictures);

export default function TrialPicture({ id }) {
    const picture = pictures[id];
    if (!picture) return null;
    return <svg className="trial-lesson__drawing" viewBox="0 0 120 120" aria-hidden="true" focusable="false">{picture}</svg>;
}
