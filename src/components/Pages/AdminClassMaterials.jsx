import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiBookOpen, FiCheck, FiClock, FiEye, FiSearch, FiShield } from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { loadCommerceAdmin, previewClassMaterials, saveClassMaterials } from "../../services/commerceService";
import "./css/Commerce.scss";

const today = () => new Date().toISOString().slice(0, 10);
const relationOne = value => Array.isArray(value) ? value[0] : value;

function AdminClassMaterials() {
    const { firebaseUser } = useAuth();
    const [data, setData] = useState(null);
    const [classCode, setClassCode] = useState("E1");
    const [effectiveFrom, setEffectiveFrom] = useState(today());
    const [selected, setSelected] = useState([]);
    const [search, setSearch] = useState("");
    const [preview, setPreview] = useState(null);
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
    useEffect(() => { setSelected((latest?.academy_class_material_books || []).map(item => Number(item.book_id))); setPreview(null); }, [latest, classCode]);
    const books = (data?.books || []).filter(book => `${book.name} ${book.code}`.toLowerCase().includes(search.toLowerCase()));
    const grouped = books.reduce((groups, book) => { const category = relationOne(book.book_categories)?.name || "其他教材"; (groups[category] ||= []).push(book); return groups; }, {});
    const payload = { class_code: classCode, effective_from: effectiveFrom, book_ids: selected };
    const doPreview = async () => { setBusy(true); try { const result = await previewClassMaterials(firebaseUser, payload); setPreview(result); } catch (error) { toast.error(error.message); } finally { setBusy(false); } };
    const save = async () => {
        if (!preview) return toast.info("請先預覽影響範圍");
        if (!window.confirm(`確認將 ${selected.length} 本教材套用到 ${classCode}？既有未到期作業會保留快照。`)) return;
        setBusy(true); try { await saveClassMaterials(firebaseUser, payload); toast.success("班級教材版本已建立"); await load(); setPreview(null); } catch (error) { toast.error(error.message); } finally { setBusy(false); }
    };

    return <main className="commerce-page commerce-admin">
        <section className="commerce-hero"><div><span>CLASS MATERIAL CONTROL</span><h1>班級教材設定</h1><p>固定班級只有 E1、E3、E5、E7。老師只能讀取自己授權班級；只有管理員可建立新版本。</p></div><aside><FiShield /><strong>後端權限再次驗證</strong><span>不相信前端傳入的角色、班級或教材 ID。</span></aside></section>
        <section className="commerce-admin-panel">
            <div className="commerce-admin-toolbar"><label>班級<select value={classCode} onChange={event => setClassCode(event.target.value)}>{(data?.classes || []).map(item => <option key={item.code}>{item.code}</option>)}</select></label><label>生效日<input type="date" min={today()} value={effectiveFrom} disabled={data?.read_only} onChange={event => setEffectiveFrom(event.target.value)} /></label><label className="is-search"><FiSearch /><input placeholder="搜尋實際教材" value={search} onChange={event => setSearch(event.target.value)} /></label><strong>已選 {selected.length} 本</strong></div>
            {data?.read_only && <p className="commerce-admin-notice">老師為唯讀模式，不能修改班級教材設定。</p>}
            <div className="commerce-book-groups">{Object.entries(grouped).map(([category, rows]) => <section key={category}><h2>{category}</h2><div>{rows.map(book => <label key={book.id}><input type="checkbox" disabled={data?.read_only} checked={selected.includes(Number(book.id))} onChange={event => setSelected(current => event.target.checked ? [...current, Number(book.id)] : current.filter(id => id !== Number(book.id)))} /><span><FiBookOpen /><strong>{book.name}</strong><small>{book.code}</small></span></label>)}</div></section>)}</div>
            {!data?.read_only && <div className="commerce-admin-actions"><button type="button" onClick={doPreview} disabled={busy || selected.length === 0}><FiEye />預覽影響</button><button type="button" className="primary" onClick={save} disabled={busy || !preview}><FiCheck />二次確認並建立版本</button></div>}
            {preview && <div className="commerce-impact"><h2>影響預覽</h2><p>受影響學生 {preview.affected_student_count} 人；既有作業 {preview.affected_assignment_count} 份會保留發布快照。</p><p>新增教材：{preview.added_book_ids?.join("、") || "無"}　移除班級來源：{preview.removed_book_ids?.join("、") || "無"}</p></div>}
        </section>
        <section className="commerce-admin-panel"><header><FiClock /><h2>修改紀錄</h2></header><div className="commerce-audit-list">{(data?.audit || []).filter(item => Number(item.class_id) === Number(classRow?.id)).map(item => <article key={item.id}><strong>{item.action}</strong><span>{relationOne(item.students)?.name || "系統"}</span><time>{new Date(item.created_at).toLocaleString("zh-TW")}</time></article>)}</div></section>
    </main>;
}
export default AdminClassMaterials;
