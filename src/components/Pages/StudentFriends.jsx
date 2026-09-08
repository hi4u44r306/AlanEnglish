import React, { useCallback, useEffect, useState } from "react";
import { FiCheck, FiCopy, FiLoader, FiSearch, FiShield, FiUserMinus, FiUserPlus, FiUsers, FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import {
    blockStudent,
    getSocialOverview,
    removeFriend,
    reportStudent,
    respondFriendRequest,
    searchStudents,
    sendFriendRequest,
    unblockStudent,
    updateSocialProfile
} from "../../services/studentSocialService";
import "./css/StudentFriends.scss";

const presenceCopy = {
    online: "在線",
    recent: "最近在線",
    offline: "離線",
    hidden: "未公開"
};

const PersonBadge = ({ person }) => (
    <div className="student-friends-person">
        <span className="student-friends-avatar" aria-hidden="true">{person.nickname.slice(0, 1).toUpperCase()}</span>
        <div>
            <strong>{person.nickname}</strong>
            <span className={`student-friends-presence is-${person.presence}`}><i />{presenceCopy[person.presence] || "離線"}</span>
        </div>
    </div>
);

function StudentFriends() {
    const { firebaseUser } = useAuth();
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyKey, setBusyKey] = useState("");
    const [nickname, setNickname] = useState("");
    const [statsVisibility, setStatsVisibility] = useState("friends");
    const [presenceVisibility, setPresenceVisibility] = useState("friends");
    const [query, setQuery] = useState("");
    const [searchResult, setSearchResult] = useState(undefined);

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!firebaseUser) return;
        if (!quiet) setLoading(true);
        try {
            const result = await getSocialOverview(firebaseUser);
            setOverview(result);
            setNickname(result.profile?.nickname || "");
            setStatsVisibility(result.settings?.stats_visibility || "friends");
            setPresenceVisibility(result.settings?.presence_visibility || "friends");
        } catch (error) {
            toast.error(error.message || "好友資料載入失敗");
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [firebaseUser]);

    useEffect(() => { load(); }, [load]);
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
        run("profile", () => updateSocialProfile(firebaseUser, {
            nickname,
            stats_visibility: statsVisibility,
            presence_visibility: presenceVisibility
        }), overview?.profile ? "社交設定已更新" : "暱稱建立完成，現在可以加好友了");
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

    if (loading) return <main className="student-friends-page"><div className="student-friends-loading" role="status"><FiLoader />正在準備好友資料…</div></main>;

    const profile = overview?.profile;
    const friends = overview?.friends || [];
    const incoming = overview?.incoming_requests || [];
    const outgoing = overview?.outgoing_requests || [];
    const blocked = overview?.blocked || [];

    return (
        <main className="student-friends-page">
            <header className="student-friends-hero">
                <div><span>FRIENDS & PROGRESS</span><h1>好友與戰績</h1><p>用暱稱或好友碼找到同學。雙方同意後，才能看到彼此公開的學習戰績。</p></div>
                {profile && <div className="student-friends-self"><small>我的好友碼</small><strong>{profile.friend_code}</strong><button type="button" onClick={copyFriendCode}><FiCopy />複製</button></div>}
            </header>

            <section className="student-friends-panel student-friends-settings">
                <div className="student-friends-panel-heading"><div><FiShield /><h2>{profile ? "我的公開資料" : "先建立你的暱稱"}</h2></div><p>不會顯示 Email、真實班級、生日或精確登入時間。</p></div>
                <form onSubmit={saveProfile}>
                    <label>公開暱稱<input value={nickname} onChange={event => setNickname(event.target.value)} maxLength="20" placeholder="例如 Alan Fox" required /></label>
                    <label>誰能看戰績<select value={statsVisibility} onChange={event => setStatsVisibility(event.target.value)}><option value="friends">只有好友</option><option value="self">只有自己</option></select></label>
                    <label>在線狀態<select value={presenceVisibility} onChange={event => setPresenceVisibility(event.target.value)}><option value="friends">讓好友看到</option><option value="hidden">不要公開</option></select></label>
                    <button type="submit" disabled={busyKey === "profile"}>{busyKey === "profile" ? "儲存中…" : profile ? "儲存設定" : "建立暱稱"}</button>
                </form>
            </section>

            {profile && <>
                <section className="student-friends-panel student-friends-search">
                    <div className="student-friends-panel-heading"><div><FiSearch /><h2>尋找好友</h2></div><p>請輸入對方完整暱稱或好友碼，避免陌生人隨意搜尋學生。</p></div>
                    <form onSubmit={search}><input value={query} onChange={event => setQuery(event.target.value)} placeholder="完整暱稱或 AE-好友碼" minLength="2" required /><button type="submit" disabled={busyKey === "search"}><FiSearch />{busyKey === "search" ? "搜尋中" : "搜尋"}</button></form>
                    {searchResult === null && <p className="student-friends-empty">找不到這位同學，請確認暱稱或好友碼是否正確。</p>}
                    {searchResult && <article className="student-friends-search-result"><PersonBadge person={{ ...searchResult, presence: "hidden" }} /><div>{searchResult.relationship?.status === "accepted" ? <span className="student-friends-state"><FiCheck />已是好友</span> : searchResult.relationship?.status === "pending" ? <span className="student-friends-state">邀請處理中</span> : <button type="button" onClick={() => run(`invite-${searchResult.student_id}`, () => sendFriendRequest(firebaseUser, searchResult.student_id), "好友邀請已送出") } disabled={busyKey === `invite-${searchResult.student_id}`}><FiUserPlus />加好友</button>}</div></article>}
                </section>

                {(incoming.length > 0 || outgoing.length > 0) && <section className="student-friends-panel">
                    <div className="student-friends-panel-heading"><div><FiUserPlus /><h2>好友邀請</h2></div><p>{incoming.length} 筆等你處理，{outgoing.length} 筆已送出。</p></div>
                    <div className="student-friends-list">{incoming.map(request => <article key={request.id}><PersonBadge person={request.person} /><div className="student-friends-actions"><button type="button" className="is-primary" onClick={() => run(`accept-${request.id}`, () => respondFriendRequest(firebaseUser, request.id, "accept"), "已成為好友")}><FiCheck />接受</button><button type="button" onClick={() => run(`reject-${request.id}`, () => respondFriendRequest(firebaseUser, request.id, "reject"), "已拒絕邀請")}><FiX />拒絕</button></div></article>)}{outgoing.map(request => <article key={request.id}><PersonBadge person={request.person} /><span className="student-friends-state">等待對方回覆</span></article>)}</div>
                </section>}

                <section className="student-friends-panel">
                    <div className="student-friends-panel-heading"><div><FiUsers /><h2>我的好友</h2></div><p>{friends.length} 位好友；只有好友能看你選擇公開的戰績與在線狀態。</p></div>
                    {friends.length === 0 ? <p className="student-friends-empty">目前還沒有好友。把上方好友碼傳給認識的同學吧。</p> : <div className="student-friends-list">{friends.map(friend => <article key={friend.id}><PersonBadge person={friend.person} />{friend.person.stats ? <div className="student-friends-stats"><span>Lv.{friend.person.stats.level}</span><strong>{friend.person.stats.total_xp.toLocaleString("zh-TW")} XP</strong></div> : <span className="student-friends-state">戰績未公開</span>}<div className="student-friends-actions"><button type="button" onClick={() => { if (window.confirm(`確定要解除與 ${friend.person.nickname} 的好友關係嗎？`)) run(`remove-${friend.person.student_id}`, () => removeFriend(firebaseUser, friend.person.student_id), "已解除好友"); }}><FiUserMinus />解除</button><button type="button" onClick={() => { if (window.confirm(`封鎖 ${friend.person.nickname} 後會立即解除好友，確定嗎？`)) run(`block-${friend.person.student_id}`, () => blockStudent(firebaseUser, friend.person.student_id), "已封鎖這位使用者"); }}><FiShield />封鎖</button><button type="button" onClick={() => report(friend.person)}>檢舉</button></div></article>)}</div>}
                </section>

                {blocked.length > 0 && <details className="student-friends-panel student-friends-blocked"><summary>已封鎖 {blocked.length} 人</summary><div className="student-friends-list">{blocked.map(person => <article key={person.student_id}><PersonBadge person={person} /><button type="button" onClick={() => run(`unblock-${person.student_id}`, () => unblockStudent(firebaseUser, person.student_id), "已解除封鎖")}>解除封鎖</button></article>)}</div></details>}
            </>}
        </main>
    );
}

export default StudentFriends;
