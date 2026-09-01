import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowRight, FiBookOpen, FiCheck, FiClock, FiEye, FiRefreshCw, FiSearch, FiShield } from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import {
    correctCurrentClassMaterials,
    loadCommerceAdmin,
    previewClassMaterials,
    previewCurrentClassMaterials,
    saveClassMaterials
} from "../../services/commerceService";
import "./css/Commerce.scss";

const today = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const defaultTermLabel = () => {
    const date = new Date();
    const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Taipei", year: "numeric" }).format(date);
    const month = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Taipei", month: "2-digit" }).format(date));
    return `${year} ${month <= 6 ? "春季" : "秋季"}`;
};
const relationOne = value => Array.isArray(value) ? value[0] : value;

function AdminClassMaterials() {
    const { firebaseUser } = useAuth();
    const [data, setData] = useState(null);
    const [classCode, setClassCode] = useState("E1");
    const [effectiveFrom, setEffectiveFrom] = useState(today());
    const [termLabel, setTermLabel] = useState(defaultTermLabel());
    const [selected, setSelected] = useState([]);
    const [search, setSearch] = useState("");
    const [preview, setPreview] = useState(null);
    const [operationMode, setOperationMode] = useState("rollover");
    const [busy, setBusy] = useState(false);
    const load = useCallback(async () => {
        if (!firebaseUser) return;
        try {
            const result = await loadCommerceAdmin(firebaseUser); setData(result);
            if (result.classes?.[0] && !result.classes.some(item => item.code === classCode)) setClassCode(result.classes[0].code);
        } catch (error) { toast.error(error.message || "班級教材設定載入失敗"); }
    }, [firebaseUser, classCode]);
    useEffect(() => { load(); }, [load]);

    const classRow = data?.classes?.find(item => item.code === classCode);
    const latest = useMemo(() => (data?.settings || []).filter(item => Number(item.class_id) === Number(classRow?.id)).sort((a, b) => b.version - a.version)[0], [data, classRow]);
    const canCorrectLatest = Boolean(latest && latest.effective_from === today());
    const canCreateVersion = !latest || latest.effective_from < today();
    useEffect(() => {
        setSelected((latest?.academy_class_material_books || []).map(item => Number(item.book_id)));
        setEffectiveFrom(today());
        setOperationMode(latest?.effective_from === today() ? "correction" : "rollover");
        setTermLabel(latest?.effective_from === today() ? (latest.note || defaultTermLabel()) : defaultTermLabel());
        setPreview(null);
    }, [latest, classCode]);
    const books = (data?.books || []).filter(book => `${book.name} ${book.code}`.toLowerCase().includes(search.toLowerCase()));
    const allBooks = data?.books || [];
    const bookNames = ids => (ids || []).map(id => allBooks.find(book => Number(book.id) === Number(id))?.name).filter(Boolean).join("、") || "無";
    const currentBookIds = (latest?.academy_class_material_books || []).map(item => Number(item.book_id));
    const grouped = books.reduce((groups, book) => { const category = relationOne(book.book_categories)?.name || "其他教材"; (groups[category] ||= []).push(book); return groups; }, {});
    const payload = { class_code: classCode, effective_from: effectiveFrom, term_label: termLabel.trim(), book_ids: selected };
    const invalidatePreview = () => setPreview(null);
    const selectOperationMode = mode => {
        setOperationMode(mode);
        setSelected(currentBookIds);
        setTermLabel(mode === "correction" ? (latest?.note || defaultTermLabel()) : defaultTermLabel());
        setPreview(null);
    };
    const doPreview = async () => {
        if (!termLabel.trim()) return toast.info("請先填寫新學期名稱");
        setBusy(true);
        try {
            const result = operationMode === "correction"
                ? await previewCurrentClassMaterials(firebaseUser, { ...payload, setting_id: latest?.id })
                : await previewClassMaterials(firebaseUser, payload);
            setPreview(result);
        } catch (error) { toast.error(error.message); } finally { setBusy(false); }
    };
    const save = async () => {
        if (!preview) return toast.info("請先預覽影響範圍");
        const message = operationMode === "correction"
            ? `確認修正 ${classCode} 第 ${latest?.version} 版為 ${selected.length} 本教材？本次修正會留下完整紀錄。`
            : `確認啟用 ${termLabel.trim()} 的 ${selected.length} 本教材？舊學期教材會永久保留給曾使用的學生。`;
        if (!window.confirm(message)) return;
        setBusy(true);
        try {
            if (operationMode === "correction") {
                await correctCurrentClassMaterials(firebaseUser, {
                    ...payload,
                    setting_id: latest?.id,
                    expected_updated_at: preview.setting_updated_at
                });
                toast.success("目前版本已修正並留下修改紀錄");
            } else {
                await saveClassMaterials(firebaseUser, payload);
                toast.success("新學期教材已換版，舊教材權限已保留");
            }
            await load();
            setPreview(null);
        } catch (error) { toast.error(error.message); } finally { setBusy(false); }
    };
    const auditLabel = action => ({ created: "建立版本", activated: "啟用版本", replaced: "學期換版", deactivated: "停用版本", corrected: "修正目前版本" }[action] || action);

    return <main className="commerce-page commerce-admin">
        <section className="commerce-hero"><div><span>TERM MATERIAL ROLLOVER</span><h1>新學期教材換版精靈</h1><p>新學期只選現在要使用的教材。上一學期教材會永久保留給實際在校使用過的學生，新加入學生不會取得入學前的舊教材。</p></div><aside><FiShield /><strong>一次完成，不會只換一半</strong><span>永久保存舊教材、結束舊版本與啟用新版本會在同一筆資料庫交易完成。</span></aside></section>
        <section className="commerce-admin-panel">
            <ol className="commerce-wizard-steps" aria-label="換版步驟">
                <li className="is-active"><span>1</span><strong>設定學期</strong></li><li className={selected.length ? "is-active" : ""}><span>2</span><strong>選新教材</strong></li><li className={preview ? "is-active" : ""}><span>3</span><strong>預覽並確認</strong></li>
            </ol>
            <div className="commerce-current-term">
                <div><small>目前班級版本</small><strong>{latest ? `${classCode} 第 ${latest.version} 版` : `${classCode} 尚未設定`}</strong><span>{latest?.note || "尚無學期名稱"} · {latest?.effective_from || "—"} 起</span></div>
                <div><small>目前教材</small><strong>{bookNames(currentBookIds)}</strong></div>
            </div>
            {!data?.read_only && <div className="commerce-operation-mode" role="group" aria-label="教材版本操作">
                <button type="button" className={operationMode === "rollover" ? "is-active" : ""} disabled={!canCreateVersion} onClick={() => selectOperationMode("rollover")}>建立新學期版本</button>
                <button type="button" className={operationMode === "correction" ? "is-active" : ""} disabled={!canCorrectLatest} onClick={() => selectOperationMode("correction")}>修正目前版本</button>
            </div>}
            {canCorrectLatest && !data?.read_only && <p className="commerce-admin-notice">{classCode} 今天已建立第 {latest.version} 版；若教材選錯，請使用「修正目前版本」。今天可以重複修正，但每次都必須重新預覽與二次確認。</p>}
            <div className="commerce-admin-toolbar commerce-rollover-toolbar"><label>班級<select value={classCode} onChange={event => setClassCode(event.target.value)}>{(data?.classes || []).map(item => <option key={item.code}>{item.code}</option>)}</select></label><label>{operationMode === "correction" ? "目前學期名稱" : "新學期名稱"}<input value={termLabel} disabled={data?.read_only} placeholder="例如：2026 秋季" onChange={event => { setTermLabel(event.target.value); invalidatePreview(); }} /></label><label>生效日<input type="date" value={effectiveFrom} disabled /></label><strong>{operationMode === "correction" ? "修正後" : "新學期"} {selected.length} 本</strong></div>
            <p className="commerce-admin-hint">{operationMode === "correction" ? "修正只會更新今天建立的目前版本，不會建立另一個同日版本、收回永久教材或刪除既有作業快照。" : "為避免漏掉生效日前新加入的學生，換版只允許在實際生效當天執行。若新學期仍會使用部分舊教材，請繼續勾選那些教材。"}</p>
            <div className="commerce-rollover-tools"><label className="is-search"><FiSearch /><input placeholder="搜尋新學期教材" value={search} onChange={event => setSearch(event.target.value)} /></label>{!data?.read_only && <><button type="button" onClick={() => { setSelected(currentBookIds); invalidatePreview(); }}><FiRefreshCw />沿用目前教材</button><button type="button" onClick={() => { setSelected([]); invalidatePreview(); }}>清空重選</button></>}</div>
            {data?.read_only && <p className="commerce-admin-notice">老師為唯讀模式，不能修改班級教材設定。</p>}
            <div className="commerce-book-groups">{Object.entries(grouped).map(([category, rows]) => <section key={category}><h2>{category}</h2><div>{rows.map(book => <label key={book.id}><input type="checkbox" disabled={data?.read_only} checked={selected.includes(Number(book.id))} onChange={event => { setSelected(current => event.target.checked ? [...current, Number(book.id)] : current.filter(id => id !== Number(book.id))); invalidatePreview(); }} /><span><FiBookOpen /><strong>{book.name}</strong><small>{book.code}</small></span></label>)}</div></section>)}</div>
            {!data?.read_only && <div className="commerce-admin-actions"><button type="button" onClick={doPreview} disabled={busy || selected.length === 0}><FiEye />{operationMode === "correction" ? "預覽修正影響" : "預覽換版影響"}</button><button type="button" className="primary" onClick={save} disabled={busy || !preview || preview.has_changes === false}><FiCheck />{operationMode === "correction" ? "二次確認並修正目前版本" : "二次確認並建立版本"}</button></div>}
            {preview && operationMode === "correction" && <div className="commerce-impact commerce-rollover-impact"><h2><FiArrowRight />目前版本修正預覽</h2><p><strong>修正前教材：</strong>{bookNames(preview.previous_book_ids)}。</p><p><strong>修正後教材：</strong>{bookNames(preview.next_book_ids)}；目前在校 {preview.affected_student_count || 0} 位學生會依修正後清單取得。</p><p><strong>本次新增：</strong>{bookNames(preview.added_book_ids)}。</p><p><strong>本次移除：</strong>{bookNames(preview.removed_book_ids)}。</p><p>既有有效作業 {preview.affected_assignment_count || 0} 份保留發布時的教材快照與學習紀錄。</p>{preview.has_changes === false && <p className="commerce-admin-notice">目前教材與學期名稱沒有變更，不需要再次儲存。</p>}</div>}
            {preview && operationMode === "rollover" && <div className="commerce-impact commerce-rollover-impact"><h2><FiArrowRight />換版影響預覽</h2><p><strong>全部歷史教材永久保留：</strong>{bookNames(preview.historical_book_ids)}，涵蓋曾在校使用的 {preview.retained_student_count || 0} 位學生，共寫入或更新 {preview.retained_entitlement_count || 0} 筆教材權限。</p><p><strong>新學期使用：</strong>{bookNames(preview.next_book_ids)}；目前在校 {preview.affected_student_count || 0} 位學生會依班級取得。</p><p><strong>相較上一版新增：</strong>{bookNames(preview.added_book_ids)}。</p><p><strong>相較上一版不再使用：</strong>{bookNames(preview.removed_book_ids)}。這些教材不會從舊生帳號移除。</p><p>既有有效作業 {preview.affected_assignment_count || 0} 份繼續使用發布時的教材快照。</p></div>}
        </section>
        <section className="commerce-admin-panel"><header><FiClock /><h2>修改紀錄</h2></header><div className="commerce-audit-list">{(data?.audit || []).filter(item => Number(item.class_id) === Number(classRow?.id)).map(item => <article key={item.id}><strong>{auditLabel(item.action)}</strong><span>{relationOne(item.students)?.name || "系統"}</span><time>{new Date(item.created_at).toLocaleString("zh-TW")}</time></article>)}</div></section>
    </main>;
}
export default AdminClassMaterials;
