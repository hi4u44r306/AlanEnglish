import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiCamera, FiCreditCard, FiGift, FiImage, FiLock, FiMove, FiStar, FiUser, FiX, FiZap, FiZoomIn } from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { DEFAULT_STUDENT_AVATARS, getStudentAvatarDisplayUrl } from "../../constants/defaultStudentAvatars";
import { createSquareAvatarImage, getGamificationSummary, prepareAvatarImage, selectStudentAvatarPreset, uploadGamificationImage } from "../../services/gamificationService";
import { updateStudentProfile } from "../../services/membershipService";
import { loadStudentCommerceProfile } from "../../services/commerceService";
import { hasAiAddonPlan } from "../../constants/membershipPlans";
import BirthdaySelect from "../fragment/BirthdaySelect";
import "./css/StudentSettings.scss";

const number = value => Number(value || 0).toLocaleString("zh-TW");
const initial = name => String(name || "A").trim().charAt(0).toUpperCase() || "A";
const AVATAR_CROP_SIZE = 280;
const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

const getCropLimits = (draft, zoom = draft?.zoom || 1) => {
    if (!draft?.width || !draft?.height) return { x: 0, y: 0 };
    const scale = Math.max(AVATAR_CROP_SIZE / draft.width, AVATAR_CROP_SIZE / draft.height) * zoom;
    return {
        x: Math.max(0, (draft.width * scale - AVATAR_CROP_SIZE) / 2),
        y: Math.max(0, (draft.height * scale - AVATAR_CROP_SIZE) / 2)
    };
};

const getCropPosition = (draft, offsetX, offsetY, zoom = draft?.zoom || 1) => {
    const limits = getCropLimits(draft, zoom);
    return {
        offsetX: clamp(offsetX, -limits.x, limits.x),
        offsetY: clamp(offsetY, -limits.y, limits.y)
    };
};

function StudentSettings() {
    const { firebaseUser, studentProfile, setStudentProfile } = useAuth();
    const fileInputRef = useRef(null);
    const [summary, setSummary] = useState(null);
    const [commerce, setCommerce] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [savingBirthday, setSavingBirthday] = useState(false);
    const [dateOfBirth, setDateOfBirth] = useState(studentProfile?.date_of_birth || "");
    const [guardianEmail, setGuardianEmail] = useState("");
    const [savingGuardian, setSavingGuardian] = useState(false);
    const [avatarDraft, setAvatarDraft] = useState(null);
    const [avatarConfirmation, setAvatarConfirmation] = useState(null);
    const avatarDragRef = useRef(null);

    const load = useCallback(async () => {
        if (!firebaseUser) return;
        try {
            const [summaryResult, commerceResult] = await Promise.allSettled([
                getGamificationSummary(firebaseUser),
                loadStudentCommerceProfile(firebaseUser)
            ]);
            if (summaryResult.status === "fulfilled") setSummary(summaryResult.value || null);
            if (commerceResult.status === "fulfilled") setCommerce(commerceResult.value?.profile || null);
            if (summaryResult.status === "rejected" && commerceResult.status === "rejected") throw summaryResult.reason;
        } catch (error) {
            toast.error(error.message || "設定資料讀取失敗");
        }
    }, [firebaseUser]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setDateOfBirth(studentProfile?.date_of_birth || ""); }, [studentProfile?.date_of_birth]);
    useEffect(() => { setGuardianEmail(commerce?.guardian?.email || ""); }, [commerce?.guardian?.email]);
    useEffect(() => () => {
        if (avatarConfirmation?.revokePreview && avatarConfirmation.previewUrl) {
            URL.revokeObjectURL(avatarConfirmation.previewUrl);
        }
    }, [avatarConfirmation]);

    const closeAvatarEditor = () => {
        setAvatarDraft(current => {
            if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
            return null;
        });
        avatarDragRef.current = null;
    };

    const handleAvatarChange = event => {
        const selectedFile = event.target.files?.[0];
        event.target.value = "";
        if (!selectedFile || !firebaseUser) return;

        if (!/^image\/(jpeg|png|webp)$/.test(selectedFile.type)) {
            toast.error("只支援 JPG、PNG、WebP 圖片");
            return;
        }
        if (selectedFile.size > 20 * 1024 * 1024) {
            toast.error("原始照片請控制在 20MB 以內");
            return;
        }
        setAvatarDraft({
            file: selectedFile,
            previewUrl: URL.createObjectURL(selectedFile),
            width: 0,
            height: 0,
            zoom: 1,
            offsetX: 0,
            offsetY: 0
        });
    };

    const reviewCustomAvatar = async () => {
        if (!avatarDraft || !firebaseUser) return;
        setUploading(true);
        try {
            const croppedFile = await createSquareAvatarImage(avatarDraft.file, {
                zoom: avatarDraft.zoom,
                offsetX: avatarDraft.offsetX,
                offsetY: avatarDraft.offsetY,
                previewSize: AVATAR_CROP_SIZE
            });
            const file = await prepareAvatarImage(croppedFile);
            setAvatarConfirmation({
                kind: "upload",
                file,
                label: "自選照片",
                previewUrl: URL.createObjectURL(file),
                revokePreview: true
            });
        } catch (error) {
            toast.error(error.message || "頭像預覽建立失敗");
        } finally {
            setUploading(false);
        }
    };

    const reviewPresetAvatar = avatar => {
        if (!firebaseUser || uploading) return;
        setAvatarConfirmation({
            kind: "preset",
            avatar,
            label: avatar.name,
            previewUrl: getStudentAvatarDisplayUrl(avatar.path, 256),
            revokePreview: false
        });
    };

    const closeAvatarConfirmation = () => {
        if (uploading) return;
        setAvatarConfirmation(null);
    };

    const confirmAvatarChange = async () => {
        if (!firebaseUser || !avatarConfirmation || uploading) return;
        setUploading(true);
        try {
            const result = avatarConfirmation.kind === "preset"
                ? await selectStudentAvatarPreset(firebaseUser, avatarConfirmation.avatar.path)
                : await uploadGamificationImage(firebaseUser, "avatar", avatarConfirmation.file);
            setSummary(current => current ? {
                ...current,
                profile: { ...current.profile, avatar_url: result.image_url }
            } : current);
            setStudentProfile(current => current ? { ...current, user_image: result.path } : current);
            setAvatarConfirmation(null);
            closeAvatarEditor();
            toast.success(avatarConfirmation.kind === "preset" ? `已套用${avatarConfirmation.label}` : "頭像已更新");
        } catch (error) {
            toast.error(error.message || "頭像更新失敗");
        } finally {
            setUploading(false);
        }
    };

    const updateAvatarPosition = (offsetX, offsetY, zoom = avatarDraft?.zoom || 1) => {
        setAvatarDraft(current => current ? { ...current, ...getCropPosition(current, offsetX, offsetY, zoom), zoom } : current);
    };

    const handleAvatarZoom = event => {
        const zoom = Number(event.target.value);
        setAvatarDraft(current => current ? {
            ...current,
            ...getCropPosition(current, current.offsetX, current.offsetY, zoom),
            zoom
        } : current);
    };

    const beginAvatarDrag = ({ pointerId, clientX, clientY }) => {
        if (!avatarDraft?.width || !avatarDraft?.height) return;
        avatarDragRef.current = { pointerId, x: clientX, y: clientY, offsetX: avatarDraft.offsetX, offsetY: avatarDraft.offsetY };
    };

    const continueAvatarDrag = ({ pointerId, clientX, clientY }) => {
        const drag = avatarDragRef.current;
        if (!drag || drag.pointerId !== pointerId) return;
        updateAvatarPosition(drag.offsetX + clientX - drag.x, drag.offsetY + clientY - drag.y);
    };

    const endAvatarDrag = pointerId => {
        if (avatarDragRef.current?.pointerId === pointerId) avatarDragRef.current = null;
    };

    const startAvatarPointerDrag = event => {
        event.preventDefault();
        try {
            event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
            // Older Safari may not support pointer capture; movement still works while inside the crop area.
        }
        beginAvatarDrag({ pointerId: `pointer-${event.pointerId}`, clientX: event.clientX, clientY: event.clientY });
    };

    const moveAvatarPointerDrag = event => {
        event.preventDefault();
        continueAvatarDrag({ pointerId: `pointer-${event.pointerId}`, clientX: event.clientX, clientY: event.clientY });
    };

    const stopAvatarPointerDrag = event => {
        endAvatarDrag(`pointer-${event.pointerId}`);
    };

    const getTrackedTouch = touches => {
        const activePointerId = avatarDragRef.current?.pointerId;
        return Array.from(touches || []).find(touch => `touch-${touch.identifier}` === activePointerId);
    };

    const startAvatarTouchDrag = event => {
        if (String(avatarDragRef.current?.pointerId || "").startsWith("pointer-")) return;
        const touch = event.changedTouches?.[0];
        if (!touch) return;
        event.preventDefault();
        beginAvatarDrag({ pointerId: `touch-${touch.identifier}`, clientX: touch.clientX, clientY: touch.clientY });
    };

    const moveAvatarTouchDrag = event => {
        const touch = getTrackedTouch(event.touches);
        if (!touch) return;
        event.preventDefault();
        continueAvatarDrag({ pointerId: `touch-${touch.identifier}`, clientX: touch.clientX, clientY: touch.clientY });
    };

    const stopAvatarTouchDrag = event => {
        const touch = getTrackedTouch(event.changedTouches);
        if (touch) endAvatarDrag(`touch-${touch.identifier}`);
    };

    const saveBirthday = async event => {
        event.preventDefault();
        if (!firebaseUser || !dateOfBirth) return;
        setSavingBirthday(true);
        try {
            const result = await updateStudentProfile(firebaseUser, { date_of_birth: dateOfBirth });
            const savedDate = result?.profile?.date_of_birth || dateOfBirth;
            setDateOfBirth(savedDate);
            setStudentProfile(current => current ? { ...current, date_of_birth: savedDate } : current);
            toast.success("出生年月日已更新");
        } catch (error) {
            toast.error(error.message || "無法更新出生年月日");
        } finally {
            setSavingBirthday(false);
        }
    };

    const saveGuardianEmail = async event => {
        event.preventDefault();
        if (!firebaseUser) return;
        setSavingGuardian(true);
        try {
            await updateStudentProfile(firebaseUser, { guardian_email: guardianEmail });
            setCommerce(current => current ? { ...current, guardian: { ...(current.guardian || {}), email: guardianEmail } } : current);
            toast.success("家長 Email 已更新");
        } catch (error) { toast.error(error.message || "無法更新家長 Email"); }
        finally { setSavingGuardian(false); }
    };

    const profile = studentProfile || {};
    const balance = summary?.balance || {};
    const avatarUrl = summary?.profile?.avatar_url || null;
    const avatarDisplayUrl = getStudentAvatarDisplayUrl(avatarUrl, 256);
    const hasAiPremium = hasAiAddonPlan(profile?.membership?.effective_access?.plan_codes);
    const hasAiMaterials = profile?.membership?.effective_access?.features?.ai_materials === true;
    const statusLabel = commerce?.enrollment_status === "active" ? "在校" : commerce?.enrollment_status === "scheduled_departure" ? "預定離校" : commerce?.enrollment_status === "departed" ? "離校" : "非在校生";
    const currentEnrollment = commerce?.current_enrollment || null;
    const directBooks = commerce?.direct_entitlements || [];
    const booksBySource = source => directBooks.filter(item => item.source === source);
    const planName = plan => {
        const value = Array.isArray(plan?.subscription_plans) ? plan.subscription_plans[0] : plan?.subscription_plans;
        return value?.name || value?.code || "方案";
    };

    return (
        <main className="student-settings-page">
            <section className="student-settings-hero">
                <span><FiUser /> MY SETTINGS</span>
                <h1>我的設定</h1>
                <p>在這裡確認學生基本資料、學習榮譽與帳號方案。班級、等級與點數由系統安全計算，不能自行修改。</p>
            </section>

            <section className="student-settings-profile-card">
                <div className="student-settings-avatar-wrap">
                    {avatarDisplayUrl
                        ? <img src={avatarDisplayUrl} className="student-settings-avatar" alt={`${profile.chinese_name || profile.name || "學生"} 的頭像`} />
                        : <div className="student-settings-avatar fallback">{initial(profile.chinese_name || profile.name)}</div>}
                    <button type="button" className="student-settings-avatar-button" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="更換學生頭像"><FiCamera /></button>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleAvatarChange} />
                </div>
                <div className="student-settings-profile-copy">
                    <span>學生基本資料</span>
                    <h2>{profile.chinese_name || profile.name || "學生"}</h2>
                    <p>{profile.english_name || "尚未設定英文姓名"}　·　{profile.class ? `${profile.class} 班` : "尚未分班"}</p>
                    <small><FiImage /> {uploading ? "正在處理頭像…" : "支援 JPG、PNG、WebP；超過 5MB 的照片會先在裝置上壓縮。"}</small>
                </div>
                <div className={`student-settings-premium ${hasAiPremium ? "active" : ""}`}>
                    <FiZap />
                    <strong>{hasAiPremium ? "AI PREMIUM 已啟用" : "AI PREMIUM 未加購"}</strong>
                    <span>{hasAiMaterials ? "AI 教材可使用" : "目前沒有 AI 教材權限"}</span>
                </div>
                <div className="student-settings-avatar-presets">
                    <div><strong>選擇預設頭像</strong><span>不想使用自己的照片時，可以隨時換回下列角色。</span></div>
                    <div className="student-settings-avatar-preset-grid">
                        {DEFAULT_STUDENT_AVATARS.map(avatar => (
                            <button key={avatar.id} type="button" onClick={() => reviewPresetAvatar(avatar)} disabled={uploading} aria-pressed={avatarUrl === avatar.path} aria-label={`使用${avatar.name}頭像`}>
                                <img src={getStudentAvatarDisplayUrl(avatar.path, 160)} alt="" />
                                <span>{avatar.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {avatarDraft && !avatarConfirmation && (
                <div className="student-avatar-editor-backdrop" role="presentation">
                    <section className="student-avatar-editor" role="dialog" aria-modal="true" aria-labelledby="avatar-editor-title">
                        <header>
                            <div><span>ADJUST YOUR PHOTO</span><h2 id="avatar-editor-title">調整正方形頭像</h2></div>
                            <button type="button" onClick={closeAvatarEditor} disabled={uploading} aria-label="關閉頭像調整視窗"><FiX /></button>
                        </header>
                        <p>拖移照片，讓想保留的內容落在方形範圍內。儲存後每個學生的頭像都會是略圓角的正方形。</p>
                        <div className="student-avatar-crop-canvas" onPointerDown={startAvatarPointerDrag} onPointerMove={moveAvatarPointerDrag} onPointerUp={stopAvatarPointerDrag} onPointerCancel={stopAvatarPointerDrag} onLostPointerCapture={stopAvatarPointerDrag} onTouchStart={startAvatarTouchDrag} onTouchMove={moveAvatarTouchDrag} onTouchEnd={stopAvatarTouchDrag} onTouchCancel={stopAvatarTouchDrag}>
                            <img
                                src={avatarDraft.previewUrl}
                                alt="頭像裁切預覽"
                                draggable="false"
                                onLoad={event => {
                                    const { naturalWidth, naturalHeight } = event.currentTarget;
                                    setAvatarDraft(current => current ? { ...current, width: naturalWidth, height: naturalHeight } : current);
                                }}
                                style={avatarDraft.width && avatarDraft.height ? (() => {
                                    const scale = Math.max(AVATAR_CROP_SIZE / avatarDraft.width, AVATAR_CROP_SIZE / avatarDraft.height) * avatarDraft.zoom;
                                    return { width: `${avatarDraft.width * scale}px`, height: `${avatarDraft.height * scale}px`, left: `calc(50% + ${avatarDraft.offsetX}px)`, top: `calc(50% + ${avatarDraft.offsetY}px)` };
                                })() : undefined}
                            />
                            <span className="student-avatar-crop-frame" aria-hidden="true"><FiMove /><small>拖移照片</small></span>
                        </div>
                        <label className="student-avatar-zoom"><span><FiZoomIn />縮放</span><input aria-label="頭像縮放" type="range" min="1" max="3" step="0.05" value={avatarDraft.zoom} onChange={handleAvatarZoom} /><strong>{Math.round(avatarDraft.zoom * 100)}%</strong></label>
                        <div className="student-avatar-editor-actions"><button type="button" className="student-avatar-editor-cancel" onClick={closeAvatarEditor} disabled={uploading}>取消</button><button type="button" className="student-avatar-editor-save" onClick={reviewCustomAvatar} disabled={uploading || !avatarDraft.width}>{uploading ? "建立預覽中…" : "預覽並確認"}</button></div>
                    </section>
                </div>
            )}

            {avatarConfirmation && (
                <div className="student-avatar-editor-backdrop" role="presentation">
                    <section className="student-avatar-editor student-avatar-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="avatar-confirmation-title">
                        <header>
                            <div><span>FINAL CONFIRMATION</span><h2 id="avatar-confirmation-title">確認更換頭像</h2></div>
                            <button type="button" onClick={closeAvatarConfirmation} disabled={uploading} aria-label="關閉頭像確認視窗"><FiX /></button>
                        </header>
                        <p>這是最後一步。請確認下方頭像會顯示在個人資料與排行榜；只有按下確認才會真正儲存。</p>
                        <div className="student-avatar-confirmation-comparison">
                            <div>
                                <span>目前頭像</span>
                                {avatarDisplayUrl
                                    ? <img src={avatarDisplayUrl} alt="目前使用的頭像" />
                                    : <div className="student-avatar-confirmation-fallback" aria-label="目前使用的文字頭像">{initial(profile.chinese_name || profile.name)}</div>}
                            </div>
                            <strong aria-hidden="true">→</strong>
                            <div className="pending">
                                <span>即將套用</span>
                                <img src={avatarConfirmation.previewUrl} alt={`即將套用的${avatarConfirmation.label}頭像`} />
                            </div>
                        </div>
                        <div className="student-avatar-editor-actions">
                            <button type="button" className="student-avatar-editor-cancel" onClick={closeAvatarConfirmation} disabled={uploading}>{avatarConfirmation.kind === "upload" ? "返回調整" : "取消"}</button>
                            <button type="button" className="student-avatar-editor-save" onClick={confirmAvatarChange} disabled={uploading}>{uploading ? "儲存中…" : "確認更換頭像"}</button>
                        </div>
                    </section>
                </div>
            )}

            <section className="student-settings-grid">
                <article className="student-settings-panel">
                    <header><FiStar /><div><span>LEARNING HONORS</span><h2>學習榮譽</h2></div></header>
                    <div className="student-settings-stats">
                        <div><span>目前等級</span><strong>Lv.{balance.level || 1}</strong></div>
                        <div><span>總 XP</span><strong>{number(balance.total_xp)} XP</strong></div>
                        <div><span>AE Points</span><strong>{number(balance.points_balance)} P</strong></div>
                    </div>
                    <p>完成學習任務、作業與挑戰可累積 XP 和 AE Points。</p>
                </article>

                <article className="student-settings-panel">
                    <header><FiCreditCard /><div><span>MEMBERSHIP</span><h2>教材與方案</h2></div></header>
                    <dl className="student-settings-data-list">
                        <div><dt>AI Premium</dt><dd>{hasAiPremium ? "已加購" : "未加購"}</dd></div>
                        <div><dt>AI 教材方案</dt><dd>{hasAiMaterials ? "可使用" : "目前不可使用"}</dd></div>
                        <div><dt>帳號類型</dt><dd>{profile.learner_type === "academy_student" ? "英文班學生" : profile.learner_type === "textbook_customer" ? "教材購買者" : "試用／一般學生"}</dd></div>
                        <div><dt>在校狀態</dt><dd>{statusLabel}</dd></div>
                        <div><dt>入學日期</dt><dd>{currentEnrollment?.enrolled_at || "—"}</dd></div>
                        <div><dt>預定離校</dt><dd>{currentEnrollment?.scheduled_departure_at || "—"}</dd></div>
                        <div><dt>實際離校</dt><dd>{currentEnrollment?.departed_at || "—"}</dd></div>
                    </dl>
                </article>
            </section>

            <section className="student-settings-grid">
                <article className="student-settings-panel">
                    <header><FiGift /><div><span>BOOK OWNERSHIP</span><h2>教材權限來源</h2></div></header>
                    <dl className="student-settings-data-list">
                        <div><dt>班級取得教材</dt><dd>{commerce?.class_books?.map(book => book?.name).filter(Boolean).join("、") || "—"}</dd></div>
                        <div><dt>已購買教材</dt><dd>{booksBySource("material_purchase").map(item => item.books?.name).filter(Boolean).join("、") || "—"}</dd></div>
                        <div><dt>管理員贈送</dt><dd>{booksBySource("admin_grant").map(item => item.books?.name).filter(Boolean).join("、") || "—"}</dd></div>
                        <div><dt>開通碼教材</dt><dd>{booksBySource("activation_code").map(item => item.books?.name).filter(Boolean).join("、") || "—"}</dd></div>
                    </dl>
                    <p>教材擁有權永久保留；網站使用權由班級、90 天贈送、試用或會員方案分別疊加。</p>
                </article>
                <article className="student-settings-panel">
                    <header><FiCreditCard /><div><span>PLAN STATUS</span><h2>基本會員與 AI 方案</h2></div></header>
                    <dl className="student-settings-data-list">
                        {(commerce?.plans || []).length ? commerce.plans.map(plan => <div key={plan.id}><dt>{planName(plan)}</dt><dd>{plan.stripe_subscription_status === "past_due" ? "付款失敗" : plan.cancel_at_period_end ? `本期結束取消（${plan.current_period_end?.slice(0, 10) || "—"}）` : plan.current_period_end ? `續訂日 ${plan.current_period_end.slice(0, 10)}` : plan.ends_at ? `到期日 ${plan.ends_at.slice(0, 10)}` : plan.status}</dd></div>) : <div><dt>方案</dt><dd>目前無方案</dd></div>}
                    </dl>
                </article>
            </section>

            <section className="student-settings-grid">
                <article className="student-settings-panel">
                    <header><FiUser /><div><span>PROFILE</span><h2>基本資料</h2></div></header>
                    <dl className="student-settings-data-list">
                        <div><dt>中文姓名</dt><dd>{profile.chinese_name || profile.name || "—"}</dd></div>
                        <div><dt>英文姓名</dt><dd>{profile.english_name || "尚未設定"}</dd></div>
                        <div><dt>班級</dt><dd>{profile.class ? `${profile.class} 班` : "尚未分班"}</dd></div>
                    </dl>
                    <p className="student-settings-readonly"><FiLock /> 姓名與班級由英文班／帳號管理維護；如需更正請聯絡老師或櫃檯。</p>
                </article>

                <article className="student-settings-panel">
                    <header><FiGift /><div><span>BIRTHDAY</span><h2>出生年月日</h2></div></header>
                    <p>資料僅用於帳號基本資料與未來的生日獎勵，不會顯示在排行榜。</p>
                    <form className="student-settings-birthday-form" onSubmit={saveBirthday}>
                        <div className="student-settings-birthday-field"><span>出生年月日</span><BirthdaySelect value={dateOfBirth} onChange={setDateOfBirth} disabled={savingBirthday} required idPrefix="student-settings-birthday" /></div>
                        <button type="submit" disabled={savingBirthday}>{savingBirthday ? "儲存中…" : "儲存生日資料"}</button>
                    </form>
                </article>

                <article className="student-settings-panel">
                    <header><FiCreditCard /><div><span>GUARDIAN</span><h2>家長 Email</h2></div></header>
                    <p>Checkout 與到期前三天提醒會使用這個 Email；缺少有效 Email 時無法開始付款。</p>
                    <form className="student-settings-birthday-form" onSubmit={saveGuardianEmail}>
                        <label className="student-settings-birthday-field"><span>家長 Email</span><input type="email" required value={guardianEmail} onChange={event => setGuardianEmail(event.target.value)} placeholder="parent@example.com" /></label>
                        <button type="submit" disabled={savingGuardian}>{savingGuardian ? "儲存中…" : "儲存家長 Email"}</button>
                    </form>
                </article>
            </section>
        </main>
    );
}

export default StudentSettings;
