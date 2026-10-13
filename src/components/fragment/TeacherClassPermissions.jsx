import React, { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getTeacherClassCodes, setTeacherClassCodes } from "../../services/academyStudentService";
import "../Pages/css/Attendance.scss";

const CLASS_CODES = ["E1", "E3", "E5", "E7"];

// Shown inside the account edit form for a saved teacher. It saves on its own button,
// separately from the name and role above it.
const TeacherClassPermissions = ({ teacherId, disabled = false }) => {
    const { firebaseUser } = useAuth();
    const [saved, setSaved] = useState(null);
    const [selected, setSelected] = useState([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        let active = true;
        setSaved(null);
        setMessage(null);
        getTeacherClassCodes(firebaseUser, teacherId).then(result => {
            if (!active) return;
            setSaved(result.class_codes || []);
            setSelected(result.class_codes || []);
        }).catch(error => {
            if (active) setMessage({ type: "error", text: error.message || "讀取班級授權失敗" });
        });
        return () => { active = false; };
    }, [firebaseUser, teacherId]);

    const toggle = code => {
        setMessage(null);
        setSelected(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code].sort());
    };
    const changed = saved !== null && saved.join() !== selected.join();

    const save = async () => {
        if (selected.length === 0 && !window.confirm("沒有勾選任何班級，這位教師將無法點名或發作業。確定要儲存嗎？")) return;
        setSaving(true);
        try {
            const result = await setTeacherClassCodes(firebaseUser, teacherId, selected);
            setSaved(result.class_codes || []);
            setSelected(result.class_codes || []);
            setMessage({ type: "success", text: "班級授權已更新。" });
        } catch (error) {
            setMessage({ type: "error", text: error.message || "班級授權儲存失敗" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <fieldset className="staff-create-classes teacher-class-permissions">
            <legend>可以管理的班級（點名、發作業、看報表）</legend>
            {saved === null && !message ? <p className="attendance-hint">正在讀取…</p> : <div>
                {CLASS_CODES.map(code => <button type="button" key={code} className="attendance-status present" aria-pressed={selected.includes(code)} disabled={disabled || saving || saved === null} onClick={() => toggle(code)}>{code}</button>)}
                <button type="button" className="attendance-secondary" disabled={disabled || saving || !changed} onClick={save}>{saving ? "儲存中…" : "儲存班級"}</button>
            </div>}
            {message && <p className={`attendance-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
        </fieldset>
    );
};

export default TeacherClassPermissions;
