import React, { useCallback, useEffect, useState } from "react";
import { FiCheck, FiChevronDown, FiCopy, FiLoader, FiMaximize2, FiSearch, FiSettings, FiShield, FiUserMinus, FiUserPlus, FiUsers, FiX } from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import {
    blockStudent,
    cancelFriendRequest,
    getSocialOverview,
    removeFriend,
    reportStudent,
    respondFriendRequest,
    searchStudents,
    sendFriendRequest,
    unblockStudent,
    updateSocialProfile
} from "../../services/studentSocialService";
import StudentAvatarImage from "../fragment/StudentAvatarImage";
import "./css/StudentFriends.scss";

const presenceCopy = {
    online: "在線",
    recent: "最近在線",
    offline: "離線",
    hidden: "未公開"
};

const PersonBadge = ({ person, onPreview, avatarClassName = "" }) => {
    const [avatarFailed, setAvatarFailed] = useState(false);
    const avatarUrl = avatarFailed ? null : person.avatar_url;
    return <div className="student-friends-person">
        {avatarUrl
            ? <button type="button" className={`student-friends-avatar student-friends-avatar--photo ${avatarClassName}`.trim()} onClick={() => onPreview?.(person)} aria-label={`查看 ${person.nickname} 的頭貼`} title="點擊放大頭貼"><StudentAvatarImage src={avatarUrl} alt="" objectFit="contain" onError={() => setAvatarFailed(true)} /><FiMaximize2 aria-hidden="true" /></button>
            : <span className="student-friends-avatar" aria-hidden="true">{person.nickname.slice(0, 1).toUpperCase()}</span>}
        <div>
            <strong>{person.nickname}</strong>
            <span className={`student-friends-presence is-${person.presence}`}><i />{presenceCopy[person.presence] || "離線"}</span>
        </div>
    </div>;
};

function StudentFriends() {
    const { firebaseUser } = useAuth();
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyKey, setBusyKey] = useState("");
    const [statsVisibility, setStatsVisibility] = useState("friends");
    const [presenceVisibility, setPresenceVisibility] = useState("friends");
    const [query, setQuery] = useState("");
    const [searchResult, setSearchResult] = useState(undefined);
    const [avatarPreview, setAvatarPreview] = useState(null);

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!firebaseUser) return;
        if (!quiet) setLoading(true);
        try {
            const result = await getSocialOverview(firebaseUser);
            setOverview(result);
            setStatsVisibility(result.settings?.stats_visibility || "friends");
            setPresenceVisibility(result.settings?.presence_visibility || "friends");
        } catch (error) {
            toast.error(error.message || "好友資料載入失敗");
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [firebaseUser]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (!avatarPreview) return undefined;
        const closeOnEscape = event => { if (event.key === "Escape") setAvatarPreview(null); };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [avatarPreview]);
    const run = async (key, task, successMessage) => {
        setBusyKey(key);
        try {
            await task();
            if (successMessage) toast.success(successMessage);
            await load({ quiet: true });
        } catch (error) {
            toast.error(error.message || "操作失敗，請稍後再試");
        } finally {
            setBusyKey("");
        }
    };

    const saveProfile = event => {
        event.preventDefault();
        run("profile", async () => {
            return updateSocialProfile(firebaseUser, {
                stats_visibility: statsVisibility,
                presence_visibility: presenceVisibility
            });
        }, "社交設定已更新");
    };

    const search = async event => {
        event.preventDefault();
        setBusyKey("search");
        setSearchResult(undefined);
        try {
            const result = await searchStudents(firebaseUser, query);
            setSearchResult(result.result || null);
        } catch (error) {
            toast.error(error.message || "搜尋失敗");
        } finally {
            setBusyKey("");
        }
    };

    const copyFriendCode = async () => {
        try {
            await navigator.clipboard.writeText(overview.profile.friend_code);
            toast.success("好友碼已複製");
        } catch {
            toast.info(`你的好友碼：${overview.profile.friend_code}`);
        }
    };

    const report = person => {
        const details = window.prompt(`要檢舉 ${person.nickname} 的原因是什麼？請不要填寫電話、Email 或其他個資。`, "");
        if (details === null) return;
        run(`report-${person.student_id}`, () => reportStudent(firebaseUser, person.student_id, "other", details), "已送出檢舉，管理員會進行確認");
    };

    const block = person => {
        if (!window.confirm(`確定要封鎖 ${person.nickname} 嗎？封鎖後對方不能搜尋或邀請你。`)) return;
        run(`block-${person.student_id}`, () => blockStudent(firebaseUser, person.student_id), "已封鎖這位使用者");
    };

    if (loading) return <main className="student-friends-page"><div className="student-friends-loading" role="status"><FiLoader />正在準備好友資料…</div></main>;

    const profile = overview?.profile;
    const friends = overview?.friends || [];
    const incoming = overview?.incoming_requests || [];
    const outgoing = overview?.outgoing_requests || [];
    const blocked = overview?.blocked || [];
    const blockedFriendIds = new Set(blocked.map(person => person.student_id));

    return (
        <main className="student-friends-page">
            <header className="student-friends-hero">
                <div><span>FRIENDS & PROGRESS</span><h1>好友與戰績</h1><p>用暱稱或好友碼找到同學。雙方同意後，才能看到彼此公開的學習戰績。</p></div>
                {profile && <div className="student-friends-self"><small>我的好友碼</small><strong>{profile.friend_code}</strong><button type="button" onClick={copyFriendCode}><FiCopy />複製</button></div>}
            </header>

            <section className="student-friends-panel student-friends-settings">
                <div className="student-friends-panel-heading"><div><FiShield /><h2>{profile ? "我的公開資料" : "先建立公開暱稱"}</h2></div><p>不會顯示 Email、真實班級、生日或精確登入時間。</p></div>
                {profile
                    ? <form onSubmit={saveProfile}>
                        <label>誰能看戰績<select value={statsVisibility} onChange={event => setStatsVisibility(event.target.value)}><option value="friends">好友都能看到</option><option value="self">只有自己能看到</option></select></label>
                        <label>在線狀態<select value={presenceVisibility} onChange={event => setPresenceVisibility(event.target.value)}><option value="friends">讓好友看到</option><option value="hidden">不要公開</option></select></label>
                        <button type="submit" disabled={busyKey === "profile"}>{busyKey === "profile" ? "儲存中…" : "儲存設定"}</button>
                    </form>
                    : <div className="student-friends-nickname-setup"><p>好友功能會使用你的公開暱稱。請先到「我的設定」建立暱稱，再回來搜尋同學。</p><Link to="/student/settings"><FiSettings />前往我的設定</Link></div>}
                <p className="student-friends-avatar-privacy">好友搜尋與邀請名單會顯示對方選擇的系統頭貼或自行上傳的照片；請只搜尋認識的同學。</p>
            </section>

            {profile && <>
                <section className="student-friends-panel student-friends-search">
                    <div className="student-friends-panel-heading"><div><FiSearch /><h2>尋找好友</h2></div><p>請輸入對方完整暱稱或好友碼，避免陌生人隨意搜尋學生。</p></div>
                    <form onSubmit={search}><input value={query} onChange={event => setQuery(event.target.value)} placeholder="完整暱稱或 AE-好友碼" minLength="2" required /><button type="submit" disabled={busyKey === "search"}><FiSearch />{busyKey === "search" ? "搜尋中" : "搜尋"}</button></form>
                    {searchResult === null && <p className="student-friends-empty">找不到這位同學，請確認暱稱或好友碼是否正確。</p>}
                    {searchResult && <article className="student-friends-search-result"><PersonBadge person={{ ...searchResult, presence: "hidden" }} onPreview={setAvatarPreview} avatarClassName="student-friends-search-avatar" /><div className="student-friends-actions">{searchResult.relationship?.status === "accepted" ? <span className="student-friends-state"><FiCheck />已是好友</span> : searchResult.relationship?.status === "pending" ? <span className="student-friends-state">邀請處理中</span> : <button type="button" onClick={() => run(`invite-${searchResult.student_id}`, () => sendFriendRequest(firebaseUser, searchResult.student_id), "好友邀請已送出")} disabled={busyKey === `invite-${searchResult.student_id}`}><FiUserPlus />加好友</button>}<button type="button" onClick={() => block(searchResult)} disabled={busyKey === `block-${searchResult.student_id}`}><FiShield />封鎖</button></div></article>}
                </section>

                {(incoming.length > 0 || outgoing.length > 0) && <section className="student-friends-panel">
                    <div className="student-friends-panel-heading"><div><FiUserPlus /><h2>好友邀請</h2></div><p>{incoming.length} 筆等你處理，{outgoing.length} 筆已送出。</p></div>
                    <div className="student-friends-list">{incoming.map(request => <article key={request.id}><PersonBadge person={request.person} onPreview={setAvatarPreview} /><div className="student-friends-actions"><button type="button" className="is-primary" onClick={() => run(`accept-${request.id}`, () => respondFriendRequest(firebaseUser, request.id, "accept"), "已成為好友")}><FiCheck />接受</button><button type="button" onClick={() => run(`reject-${request.id}`, () => respondFriendRequest(firebaseUser, request.id, "reject"), "已拒絕邀請")}><FiX />拒絕</button></div></article>)}{outgoing.map(request => <article key={request.id}><PersonBadge person={request.person} onPreview={setAvatarPreview} /><div className="student-friends-actions"><span className="student-friends-state">等待對方回覆</span><button type="button" onClick={() => run(`cancel-${request.id}`, () => cancelFriendRequest(firebaseUser, request.id), "已取消好友邀請")} disabled={busyKey === `cancel-${request.id}`}><FiX />取消邀請</button></div></article>)}</div>
                </section>}

                <section className="student-friends-panel">
                    <div className="student-friends-panel-heading"><div><FiUsers /><h2>我的好友</h2></div><p>{friends.length} 位好友；只有好友能看你選擇公開的戰績與在線狀態。</p></div>
                    {friends.length === 0 ? <p className="student-friends-empty">目前還沒有好友。把上方好友碼傳給認識的同學吧。</p> : <div className="student-friends-list">{friends.map(friend => {
                        const isBlocked = blockedFriendIds.has(friend.person.student_id);
                        return <article key={friend.id}><PersonBadge person={friend.person} onPreview={setAvatarPreview} />{friend.person.stats ? <div className="student-friends-stats"><span>Lv.{friend.person.stats.level}</span><strong>{friend.person.stats.total_xp.toLocaleString("zh-TW")} XP</strong></div> : <span className="student-friends-state">戰績未公開</span>}<div className="student-friends-actions"><button type="button" onClick={() => { if (window.confirm(`確定要刪除與 ${friend.person.nickname} 的好友關係嗎？`)) run(`remove-${friend.person.student_id}`, () => removeFriend(firebaseUser, friend.person.student_id), "已刪除好友"); }}><FiUserMinus />刪除好友</button><button type="button" className={isBlocked ? "is-blocked" : ""} onClick={() => block(friend.person)} disabled={isBlocked || busyKey === `block-${friend.person.student_id}`}><FiShield />{isBlocked ? "已封鎖" : "封鎖"}</button><button type="button" onClick={() => report(friend.person)}>檢舉</button></div></article>;
                    })}</div>}
                </section>

                {blocked.length > 0 && <details className="student-friends-panel student-friends-blocked"><summary><span>已封鎖 {blocked.length} 人</span><FiChevronDown aria-hidden="true" /></summary><div className="student-friends-list">{blocked.map(person => <article key={person.student_id}><PersonBadge person={person} onPreview={setAvatarPreview} /><button type="button" onClick={() => run(`unblock-${person.student_id}`, () => unblockStudent(firebaseUser, person.student_id), "已解除封鎖")}>解除封鎖</button></article>)}</div></details>}
            </>}
            {avatarPreview?.avatar_url && <div className="student-friends-avatar-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAvatarPreview(null); }}>
                <section className="student-friends-avatar-dialog" role="dialog" aria-modal="true" aria-labelledby="friend-avatar-preview-title">
                    <button type="button" className="student-friends-avatar-dialog-close" onClick={() => setAvatarPreview(null)} aria-label="關閉頭貼預覽"><FiX /></button>
                    <StudentAvatarImage src={avatarPreview.avatar_url} alt={`${avatarPreview.nickname} 的頭貼`} />
                    <h2 id="friend-avatar-preview-title">{avatarPreview.nickname}</h2>
                    <p>公開頭貼僅在好友功能中顯示。</p>
                </section>
            </div>}
        </main>
    );
}

export default StudentFriends;
