import React from "react";

// Pictures for the free lesson: Microsoft Fluent Emoji (3D), MIT licensed — see
// public/trial/LICENSE-fluent-emoji.txt. They are image files, so every device shows the same.
const image = name => `${process.env.PUBLIC_URL || ""}/trial/${name}.png`;
const SINGLE = ["apple", "banana", "forest", "eggplant", "coffee", "hair"];

export const TRIAL_PICTURE_IDS = [...SINGLE, "sky", "cloud"];

export default function TrialPicture({ id }) {
    if (SINGLE.includes(id)) return <img className="trial-lesson__drawing" src={image(id)} alt="" width="256" height="256" />;
    // White and blue need something behind them: the sky is the blue panel itself, and the
    // cloud sits on one so that its white shows.
    if (id === "sky") return <span className="trial-lesson__drawing is-panel is-sky"><img src={image("sun")} alt="" /><img src={image("cloud")} alt="" /></span>;
    if (id === "cloud") return <span className="trial-lesson__drawing is-panel"><img src={image("cloud")} alt="" /></span>;
    return null;
}
