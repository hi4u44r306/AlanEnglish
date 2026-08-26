export const DEFAULT_STUDENT_AVATARS = [
    { id: "cat", name: "勇氣貓咪", path: "/default-avatars/alan-cat.png" },
    { id: "fox", name: "機智狐狸", path: "/default-avatars/alan-fox.png" },
    { id: "rabbit", name: "活力兔子", path: "/default-avatars/alan-rabbit.png" },
    { id: "bear", name: "穩重小熊", path: "/default-avatars/alan-bear.png" },
    { id: "owl", name: "智慧貓頭鷹", path: "/default-avatars/alan-owl.png" }
];

export const isDefaultStudentAvatar = value => DEFAULT_STUDENT_AVATARS.some(avatar => avatar.path === value);

export const getStudentAvatarDisplayUrl = (value, size = 256) => {
    const path = String(value || "").trim();
    if (!path || !isDefaultStudentAvatar(path) || process.env.NODE_ENV !== "production") return path || null;
    const safeSize = Math.min(512, Math.max(64, Math.round(Number(size) || 256)));
    return `/.netlify/images?url=${encodeURIComponent(path)}&w=${safeSize}&h=${safeSize}&fit=cover`;
};
