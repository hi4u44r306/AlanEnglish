import React from "react";

// Print letters drawn on four-line handwriting paper, the way they are taught in class:
// the three spaces are equal, capitals and tall letters fill the top two, small letters fill the
// middle one, and tails hang into the bottom one. No font has these proportions, so each letter
// is a few lines and arcs on a grid where the lines sit at y = 0, 10, 20 (the base line) and 30.
// Each entry is [width, path, dots]; a dot is [x, y].
const GLYPHS = {
    A: [14, "M0 20 L7 0 L14 20 M2.5 13 H11.5"],
    B: [11.3, "M0 0 V20 M0 0 H5.5 A4.75 4.75 0 0 1 5.5 9.5 H0 M5.5 9.5 H6 A5.25 5.25 0 0 1 6 20 H0"],
    C: [18, "M17.66 3.57 A10 10 0 1 0 17.66 16.43"],
    D: [15, "M0 0 V20 H5 A10 10 0 0 0 5 0 H0"],
    E: [10, "M10 0 H0 V20 H10 M0 10 H8.5"],
    F: [10, "M10 0 H0 V20 M0 10 H8"],
    G: [20, "M17.66 3.57 A10 10 0 1 0 20 10.5 H11.5"],
    H: [12, "M0 0 V20 M12 0 V20 M0 10 H12"],
    I: [2, "M1 0 V20"],
    J: [8, "M8 0 V15.5 A4 4.5 0 0 1 0 15.5"],
    K: [12, "M0 0 V20 M11 0 L0 12 M4 8 L12 20"],
    L: [9, "M0 0 V20 H9"],
    M: [16, "M0 20 V0 L8 16 L16 0 V20"],
    N: [12, "M0 20 V0 L12 20 V0"],
    O: [20, "M0 10 A10 10 0 1 0 20 10 A10 10 0 1 0 0 10"],
    P: [10.75, "M0 20 V0 H5.5 A5.25 5.25 0 0 1 5.5 10.5 H0"],
    Q: [20.5, "M0 10 A10 10 0 1 0 20 10 A10 10 0 1 0 0 10 M12 13 L20.5 21"],
    R: [11.5, "M0 20 V0 H5.5 A5.25 5.25 0 0 1 5.5 10.5 H0 M5.5 10.5 L11.5 20"],
    S: [12, "M10.8 3 A5.3 5 0 1 0 6 10 A5.5 5 0 1 1 1 17.2"],
    T: [13, "M0 0 H13 M6.5 0 V20"],
    U: [12, "M0 0 V14 A6 6 0 0 0 12 14 V0"],
    V: [14, "M0 0 L7 20 L14 0"],
    W: [20, "M0 0 L5 20 L10 0 L15 20 L20 0"],
    X: [12, "M0 0 L12 20 M12 0 L0 20"],
    Y: [13, "M0 0 L6.5 10 L13 0 M6.5 10 V20"],
    Z: [12.5, "M0.5 0 H12 L0.5 20 H12.5"],
    a: [10, "M0 15 A5 5 0 1 0 10 15 A5 5 0 1 0 0 15 M10 10 V20"],
    b: [10, "M0 0 V20 M0 15 A5 5 0 1 0 10 15 A5 5 0 1 0 0 15"],
    c: [9, "M8.83 11.79 A5 5 0 1 0 8.83 18.21"],
    d: [10, "M0 15 A5 5 0 1 0 10 15 A5 5 0 1 0 0 15 M10 0 V20"],
    e: [10, "M0 15 H10 A5 5 0 1 0 8.54 18.54"],
    f: [7, "M7 0.8 Q3 -0.2 3 4 V20 M0 10 H6.5"],
    g: [10, "M0 15 A5 5 0 1 0 10 15 A5 5 0 1 0 0 15 M10 10 V25 Q10 30 5 30 Q2.5 30 1 28.5"],
    h: [9, "M0 0 V20 M0 14.5 A4.5 4.5 0 0 1 9 14.5 V20"],
    i: [2, "M1 10 V20", [[1, 5.5]]],
    j: [5, "M4 10 V26.5 Q4 30 0.8 29.6", [[4, 5.5]]],
    k: [8, "M0 0 V20 M7.5 10 L0 16.5 M2.8 14 L8 20"],
    l: [2, "M1 0 V20"],
    m: [15, "M0 10 V20 M0 14 A3.75 4 0 0 1 7.5 14 V20 M7.5 14 A3.75 4 0 0 1 15 14 V20"],
    n: [9, "M0 10 V20 M0 14.5 A4.5 4.5 0 0 1 9 14.5 V20"],
    o: [10, "M0 15 A5 5 0 1 0 10 15 A5 5 0 1 0 0 15"],
    p: [10, "M0 10 V30 M0 15 A5 5 0 1 0 10 15 A5 5 0 1 0 0 15"],
    q: [10, "M0 15 A5 5 0 1 0 10 15 A5 5 0 1 0 0 15 M10 10 V30"],
    r: [6.5, "M0 10 V20 M0 14.5 Q0.5 10.2 6.5 10.6"],
    s: [7, "M6.3 11.5 A3.2 2.5 0 1 0 3.5 15 A3.2 2.5 0 1 1 0.7 18.5"],
    t: [6.5, "M3 3.5 V20 M0 10 H6.5"],
    u: [9, "M0 10 V15.5 A4.5 4.5 0 0 0 9 15.5 M9 10 V20"],
    v: [9, "M0 10 L4.5 20 L9 10"],
    w: [14, "M0 10 L3.5 20 L7 10 L10.5 20 L14 10"],
    x: [8, "M0 10 L8 20 M8 10 L0 20"],
    y: [9.5, "M0.5 10 L5.5 20 M9.5 10 L1.5 30"],
    z: [8.5, "M0.5 10 H8 L0.5 20 H8"]
};

const PAD = 1.4;

function Letter({ character }) {
    const [width, path, dots = []] = GLYPHS[character];
    return <svg className="handwriting-letter" viewBox={`${-PAD} -2 ${width + PAD * 2} 34`} aria-hidden="true" focusable="false">
        <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        {dots.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.05" fill="currentColor" />)}
    </svg>;
}

// The capital and the small letter side by side on one strip of four-line paper. The strip is an <i>
// because the tile styles every <span> inside the list.
export default function HandwritingPair({ upper, lower }) {
    if (!GLYPHS[upper] || !GLYPHS[lower]) return <>{upper}<small>{lower}</small></>;
    return <i className="handwriting-paper"><Letter character={upper} /><Letter character={lower} /></i>;
}
