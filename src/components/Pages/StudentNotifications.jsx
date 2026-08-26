import React, { useCallback, useEffect, useState } from "react";
import { FiBell, FiCheck, FiChevronLeft, FiClock, FiLoader } from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { getStudentNotifications, markStudentNotificationRead } from "../../services/membershipService";
import "./css/StudentNotifications.scss";

const PAGE_SIZE = 30;
const formatDateTime = value => value ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";

function StudentNotifications() {
    const { firebaseUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextBefore, setNextBefore] = useState(null);

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

    const markRead = async notification => {
        if (!notification || notification.read_at || !firebaseUser) return;
        const readAt = new Date().toISOString();
        setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: readAt } : item));
        try {
            await markStudentNotificationRead(firebaseUser, notification.id);
        } catch (error) {
            setNotifications(current => current.map(item => item.id === notification.id ? notification : item));
            toast.error(error.message || "通知狀態更新失敗");
        }
    };

    const unreadCount = notifications.filter(notification => !notification.read_at).length;

    return (
        <main className="student-notifications-page">
            <Link to="/student/dashboard" className="student-notifications-back"><FiChevronLeft />回到我的首頁</Link>
            <section className="student-notifications-hero">
                <span><FiBell /> NOTIFICATIONS</span>
                <h1>所有通知</h1>
                <p>作業提醒、學習獎勵、會員訊息與未來生日點數都會保留在這裡。</p>
                <strong>{unreadCount > 0 ? `本頁有 ${unreadCount} 則未讀通知` : "目前沒有未讀通知"}</strong>
            </section>

            <section className="student-notifications-list" aria-live="polite">
                {loading ? <p className="student-notifications-empty"><FiLoader />通知載入中…</p> : notifications.length === 0 ? <p className="student-notifications-empty"><FiBell />目前沒有通知；新的作業、獎勵與生日活動會在這裡告訴你。</p> : notifications.map(notification => (
                    <article className={`student-notification-card ${notification.read_at ? "is-read" : "is-unread"}`} key={notification.id}>
                        <span className="student-notification-icon">{notification.read_at ? <FiCheck /> : <FiBell />}</span>
                        <div>
                            <header><strong>{notification.title}</strong>{!notification.read_at && <span>未讀</span>}</header>
                            <p>{notification.body}</p>
                            <time><FiClock />{formatDateTime(notification.created_at)}</time>
                        </div>
                        {!notification.read_at && <button type="button" onClick={() => markRead(notification)}>標示已讀</button>}
                    </article>
                ))}
                {hasMore && <button type="button" className="student-notifications-more" onClick={() => loadNotifications({ append: true, before: nextBefore })} disabled={loadingMore}>{loadingMore ? "載入中…" : "載入更早的通知"}</button>}
            </section>
        </main>
    );
}

export default StudentNotifications;
