const STUDENT_NOTIFICATION_DESTINATIONS = new Set([
    "/student/assignments",
    "/student/friends",
    "/student/leaderboard",
    "/student/membership",
    "/student/review",
    "/student/rewards"
]);

const DESTINATION_BY_TYPE = {
    assignment: "/student/assignments",
    assignments: "/student/assignments",
    gamification: "/student/leaderboard",
    membership: "/student/membership",
    review: "/student/review",
    reward: "/student/rewards",
    rewards: "/student/rewards",
    social: "/student/friends"
};

export const getStudentNotificationDestination = notification => {
    const requestedPath = String(notification?.metadata?.target_path || "").trim();
    if (STUDENT_NOTIFICATION_DESTINATIONS.has(requestedPath)) return requestedPath;

    const notificationType = String(notification?.notification_type || "").trim().toLowerCase();
    return DESTINATION_BY_TYPE[notificationType] || null;
};
