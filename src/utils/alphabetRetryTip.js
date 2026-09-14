const ALPHABET_RETRY_TIPS = {
    B: "B 要先把嘴唇閉起來，再說 bee。",
    C: "C 是 see，開頭要有輕輕的 s 聲。",
    D: "D 要讓舌尖輕碰上排牙齒後面，再說 dee。",
    E: "E 要拉長說 ee。",
    F: "F 是 ef，上排牙齒輕碰下唇。",
    G: "G 是 gee，開頭像 J，但尾巴是 ee。",
    I: "I 是 eye，像眼睛的 eye。",
    J: "J 是 jay，尾巴像 ay。",
    L: "L 是 el，舌尖輕碰上排牙齒後面。",
    M: "M 是 em，先閉起嘴唇再發 m 音。",
    N: "N 是 en，舌尖輕碰上排牙齒後面。",
    O: "O 是 oh，嘴巴圓圓地慢慢說。",
    P: "P 要先輕輕送氣，再說 pee。",
    Q: "Q 是 cue，像 kyoo。",
    R: "R 是 are，嘴巴微微圓起來。",
    S: "S 是 ess，先有輕輕的 s 聲。",
    T: "T 要讓舌尖輕碰上排牙齒後面，再說 tee。",
    U: "U 是 you，先說 y 再拉長 oo。",
    V: "V 是 vee，上排牙齒輕碰下唇並發出震動。",
    W: "W 是 double u，慢慢唸三個音。",
    Z: "Z 是 zee，不是 C 的 see。"
};

export const alphabetRetryTip = expectedLetter => (
    ALPHABET_RETRY_TIPS[String(expectedLetter || "").trim().toUpperCase()]
    || "慢慢說出字母名稱，開頭和結尾的聲音都要清楚。"
);
