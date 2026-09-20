export const DEFAULT_STUDENT_AVATARS = [
    { id: "cat", name: "勇氣貓咪", path: "/default-avatars/alan-cat.png" },
    { id: "fox", name: "機智狐狸", path: "/default-avatars/alan-fox.png" },
    { id: "rabbit", name: "活力兔子", path: "/default-avatars/alan-rabbit.png" },
    { id: "bear", name: "穩重小熊", path: "/default-avatars/alan-bear.png" },
    { id: "owl", name: "智慧貓頭鷹", path: "/default-avatars/alan-owl.png" }
];

export const isDefaultStudentAvatar = value => DEFAULT_STUDENT_AVATARS.some(avatar => avatar.path === value);

// Cloudflare serves these bundled files directly.
export const getStudentAvatarDisplayUrl = value => {
    const path = String(value || "").trim();
    return path && isDefaultStudentAvatar(path) ? path : path || null;
};
