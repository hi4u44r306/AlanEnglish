export const STUDENT_STAGING_HOSTNAME = "staging--alanenglish.netlify.app";
export const STUDENT_STAGING_ORIGIN = `https://${STUDENT_STAGING_HOSTNAME}`;

export const isStudentStagingSite = (hostname = typeof window !== "undefined" ? window.location.hostname : "") => (
    String(hostname || "").trim().toLowerCase() === STUDENT_STAGING_HOSTNAME
);
