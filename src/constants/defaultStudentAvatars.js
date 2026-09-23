export const DEFAULT_STUDENT_AVATARS = [
    { id: "cat", name: "勇氣貓咪", path: "/default-avatars/alan-cat.png" },
    { id: "fox", name: "機智狐狸", path: "/default-avatars/alan-fox.png" },
    { id: "rabbit", name: "活力兔子", path: "/default-avatars/alan-rabbit.png" },
    { id: "bear", name: "穩重小熊", path: "/default-avatars/alan-bear.png" },
    { id: "owl", name: "智慧貓頭鷹", path: "/default-avatars/alan-owl.png" },
    { id: "explorer", name: "勇敢探險家", path: "/default-avatars/alan-explorer.jpg" },
    { id: "scientist", name: "好奇科學家", path: "/default-avatars/alan-scientist.jpg" },
    { id: "artist", name: "創意藝術家", path: "/default-avatars/alan-artist.jpg" },
    { id: "footballer", name: "足球小將", path: "/default-avatars/alan-footballer.jpg" },
    { id: "astronaut", name: "星際太空人", path: "/default-avatars/alan-astronaut.jpg" },
    { id: "musician", name: "快樂音樂家", path: "/default-avatars/alan-musician.jpg" },
    { id: "chef", name: "暖心小廚師", path: "/default-avatars/alan-chef.jpg" },
    { id: "gardener", name: "陽光園藝家", path: "/default-avatars/alan-gardener.jpg" },
    { id: "dancer", name: "閃耀舞者", path: "/default-avatars/alan-dancer.jpg" },
    { id: "inventor", name: "點子發明家", path: "/default-avatars/alan-inventor.jpg" },
    { id: "robot", name: "藍光機器人", path: "/default-avatars/alan-robot.jpg" },
    { id: "dragon", name: "飛天小龍", path: "/default-avatars/alan-dragon.jpg" },
    { id: "star-hero", name: "星光小英雄", path: "/default-avatars/alan-star-hero.jpg" },
    { id: "space-friend", name: "星球好朋友", path: "/default-avatars/alan-space-friend.jpg" },
    { id: "knight", name: "勇氣騎士", path: "/default-avatars/alan-knight.jpg" },
    { id: "wizard", name: "星星魔法師", path: "/default-avatars/alan-wizard.jpg" },
    { id: "pilot", name: "天空飛行員", path: "/default-avatars/alan-pilot.jpg" },
    { id: "detective", name: "細心小偵探", path: "/default-avatars/alan-detective.jpg" },
    { id: "mountaineer", name: "高山登山家", path: "/default-avatars/alan-mountaineer.jpg" },
    { id: "sailor", name: "海風航海家", path: "/default-avatars/alan-sailor.jpg" }
];

export const isDefaultStudentAvatar = value => DEFAULT_STUDENT_AVATARS.some(avatar => avatar.path === value);

// Cloudflare serves these bundled files directly.
export const getStudentAvatarDisplayUrl = value => {
    const path = String(value || "").trim();
    return path && isDefaultStudentAvatar(path) ? path : path || null;
};
