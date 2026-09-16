export const NOTIFICATIONS_READ_EVENT = "ae:notifications-read";

export const notifyNotificationsRead = notificationIds => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_READ_EVENT, {
        detail: { notificationIds }
    }));
};
