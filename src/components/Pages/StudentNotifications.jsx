import React, { useCallback, useEffect, useState } from "react";
import { FiArrowRight, FiBell, FiCheck, FiChevronLeft, FiClock, FiLoader } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getStudentNotifications, markAllStudentNotificationsRead, markStudentNotificationRead } from "../../services/membershipService";
import { notifyNotificationsRead } from "../../constants/notificationEvents";
import { getStudentNotificationDestination } from "../../constants/studentNotificationRoutes";
import { disableWebPush, enableWebPush, getCurrentWebPushStatus, getWebPushAvailability, getWebPushConfig } from "../../services/webPushService";
import "./css/StudentNotifications.scss";

const PAGE_SIZE = 30;
const formatDateTime = value => value ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";

function StudentNotifications() {
    const { firebaseUser } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextBefore, setNextBefore] = useState(null);
    const [pushConfig, setPushConfig] = useState(null);
    const [pushStatus, setPushStatus] = useState(null);
    const [pushBusy, setPushBusy] = useState(false);

    const loadNotifications = useCallback(async ({ append = false, before = null } = {}) => {
        if (!firebaseUser) return;
        const setBusy = append ? setLoadingMore : setLoading;
        setBusy(true);
        try {
            const result = await getStudentNotifications(firebaseUser, {
                limit: PAGE_SIZE,
                ...(append && before ? { before } : {})
            });
            const nextItems = result?.notifications || [];
            setNotifications(current => append ? [...current, ...nextItems] : nextItems);
            setHasMore(result?.has_more === true);
            setNextBefore(result?.next_before || null);
        } catch (error) {
            toast.error(error.message || "通知載入失敗");
            if (!append) setNotifications([]);
        } finally {
            setBusy(false);
        }
    }, [firebaseUser]);

    useEffect(() => { loadNotifications(); }, [loadNotifications]);

    useEffect(() => {
        if (!firebaseUser) return undefined;
        let cancelled = false;
        const availability = getWebPushAvailability();
        setPushStatus({ ...availability, active: false });
        getWebPushConfig(firebaseUser).then(async config => {
            if (cancelled) return;
            setPushConfig(config);
            if (availability.supported && config.enabled) {
                const status = await getCurrentWebPushStatus(firebaseUser);
                if (!cancelled) setPushStatus(status);
            }
        }).catch(() => {
            if (!cancelled) setPushConfig({ enabled: false });
        });
        return () => { cancelled = true; };
    }, [firebaseUser]);

    const togglePush = async () => {
        if (!firebaseUser || pushBusy || !pushConfig?.enabled) return;
        setPushBusy(true);
        try {
            if (pushStatus?.active) await disableWebPush(firebaseUser);
            else await enableWebPush(firebaseUser, pushConfig.public_key);
            const status = await getCurrentWebPushStatus(firebaseUser);
            setPushStatus(status);
            toast.success(status.active ? "此裝置已開啟推播" : "此裝置已關閉推播");
        } catch (error) {
            setPushStatus(getWebPushAvailability());
            toast.error(error.message || "推播設定失敗");
        } finally {
            setPushBusy(false);
        }
    };

    const markRead = async notification => {
        if (!notification || notification.read_at || !firebaseUser) return;
        const readAt = new Date().toISOString();
        setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: readAt } : item));
        notifyNotificationsRead([notification.id]);
        try {
            await markStudentNotificationRead(firebaseUser, notification.id);
        } catch (error) {
            setNotifications(current => current.map(item => item.id === notification.id ? notification : item));
            notifyNotificationsRead({ unreadIds: [notification.id] });
            toast.error(error.message || "通知狀態更新失敗");
        }
    };

    const openNotification = notification => {
        const destination = getStudentNotificationDestination(notification);
        if (!destination) return;
        void markRead(notification);
        navigate(destination);
    };

    const handleNotificationKeyDown = (event, notification) => {
        if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        openNotification(notification);
    };

    const unreadCount = notifications.filter(notification => !notification.read_at).length;
    const markAllRead = async () => {
        if (!firebaseUser || unreadCount === 0) return;
        const readAt = new Date().toISOString();
        const previous = notifications;
        setNotifications(current => current.map(item => ({ ...item, read_at: item.read_at || readAt })));
        notifyNotificationsRead("all");
        try { await markAllStudentNotificationsRead(firebaseUser); }
        catch (error) { setNotifications(previous); notifyNotificationsRead({ unreadIds: previous.filter(item => !item.read_at).map(item => item.id) }); toast.error(error.message || "通知狀態更新失敗"); }
    };

    return (
        <main className="student-notifications-page">
            <Link to="/student/dashboard" className="student-notifications-back"><FiChevronLeft />回到我的首頁</Link>
            <section className="student-notifications-hero">
                <span><FiBell /> NOTIFICATIONS</span>
                <h1>所有通知</h1>
                <p>作業提醒、學習獎勵、會員訊息與未來生日點數都會保留在這裡。</p>
                <strong>{unreadCount > 0 ? `本頁有 ${unreadCount} 則未讀通知` : "目前沒有未讀通知"}</strong>
                {unreadCount > 0 && <button type="button" className="student-notifications-mark-all" onClick={markAllRead}>全部標示已讀</button>}
            </section>

            <section className="student-notifications-push" aria-labelledby="student-push-heading">
                <div>
                    <h2 id="student-push-heading">手機推播</h2>
                    <p>開啟後，此裝置可收到新班級作業與教材使用期限提醒。鎖定畫面只顯示簡短提示；完整內容請登入查看。晚上 9 點至早上 8 點不發送，每日最多三則。</p>
                    <small aria-live="polite">{pushStatus?.reason || (pushConfig?.enabled === false ? "推播服務尚未開放；網站內通知仍可正常使用。" : pushStatus?.active ? "此裝置已開啟" : "此裝置尚未開啟")}</small>
                </div>
                <button type="button" onClick={togglePush}
                    disabled={pushBusy || !pushConfig?.enabled || (!pushStatus?.active && !pushStatus?.supported)}>
                    {pushBusy ? "設定中…" : pushStatus?.active ? "關閉此裝置推播" : "開啟此裝置推播"}
                </button>
            </section>

            <section className="student-notifications-list" aria-live="polite">
                {loading ? <p className="student-notifications-empty"><FiLoader />通知載入中…</p> : notifications.length === 0 ? <p className="student-notifications-empty"><FiBell />目前沒有通知；新的作業、獎勵與生日活動會在這裡告訴你。</p> : notifications.map(notification => {
                    const destination = getStudentNotificationDestination(notification);
                    return (
                    <article
                        className={`student-notification-card ${notification.read_at ? "is-read" : "is-unread"} ${destination ? "is-actionable" : ""}`}
                        key={notification.id}
                        role={destination ? "link" : undefined}
                        tabIndex={destination ? 0 : undefined}
                        onClick={destination ? () => openNotification(notification) : undefined}
                        onKeyDown={destination ? event => handleNotificationKeyDown(event, notification) : undefined}
                    >
                        <span className="student-notification-icon">{notification.read_at ? <FiCheck /> : <FiBell />}</span>
                        <div>
                            <header><strong>{notification.title}</strong>{!notification.read_at && <span>未讀</span>}</header>
                            <p>{notification.body}</p>
                            <time><FiClock />{formatDateTime(notification.created_at)}</time>
                            {destination && <span className="student-notification-destination">查看相關頁面 <FiArrowRight /></span>}
                        </div>
                        {!notification.read_at && <button type="button" onClick={event => { event.stopPropagation(); void markRead(notification); }}>標示已讀</button>}
                    </article>
                    );
                })}
                {hasMore && <button type="button" className="student-notifications-more" onClick={() => loadNotifications({ append: true, before: nextBefore })} disabled={loadingMore}>{loadingMore ? "載入中…" : "載入更早的通知"}</button>}
            </section>
        </main>
    );
}

export default StudentNotifications;
