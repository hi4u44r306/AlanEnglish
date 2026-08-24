import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
    createAcademyStudentsBatch,
    previewAcademyStudents
} from "../../services/academyStudentService";
import {
    ACADEMY_STUDENT_CSV_MAX_ROWS,
    buildAcademyStudentCsvTemplate,
    buildAcademyStudentResultCsv,
    parseAcademyStudentCsv
} from "../../utils/academyStudentCsv";
import "./css/ManagementDashboard.scss";
import "./css/AcademyStudentCsvImport.scss";

const createRequestId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
};

const downloadCsv = (contents, filename) => {
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const displayDate = value => value || "無期限";

function AcademyStudentCsvImport() {
    const { firebaseUser } = useAuth();
    const inputRef = useRef(null);
    const [filename, setFilename] = useState("");
    const [rows, setRows] = useState([]);
    const [preview, setPreview] = useState(null);
    const [requestId, setRequestId] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [message, setMessage] = useState("");
    const [results, setResults] = useState([]);
    const [auditComplete, setAuditComplete] = useState(true);

    const resetImport = () => {
        setFilename("");
        setRows([]);
        setPreview(null);
        setRequestId("");
        setMessage("");
        setResults([]);
        setSubmitted(false);
        setAuditComplete(true);
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleFile = async event => {
        const file = event.target.files?.[0];
        resetImport();
        if (!file) return;

        setFilename(file.name);
        setLoading(true);

        try {
            if (file.size > 512 * 1024) throw new Error("CSV 檔案不可超過 512 KB");
            const parsedRows = parseAcademyStudentCsv(await file.text());
            const previewResult = await previewAcademyStudents(firebaseUser, parsedRows);
            setRows(parsedRows);
            setPreview(previewResult);
            setRequestId(createRequestId());
        } catch (error) {
            setMessage(error?.message || "CSV 讀取失敗");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!firebaseUser || !preview || submitted || submitting) return;
        if (preview.summary?.invalid > 0) {
            setMessage("請先修正所有錯誤列，再重新選擇 CSV 預覽");
            return;
        }
        if (!window.confirm(`確定要建立 ${rows.length} 位英文班學生帳號嗎？建立後無法在此頁撤銷。`)) return;

        setSubmitting(true);
        setSubmitted(true);
        setMessage("批次建立進行中，請勿關閉頁面或重複送出。");

        try {
            const result = await createAcademyStudentsBatch(firebaseUser, rows, requestId);
            const mappedResults = (result?.results || []).map((item, index) => ({
                ...item,
                source_row: rows[index]?.source_row || item.row_number
            }));
            setResults(mappedResults);
            setAuditComplete(result?.audit_complete !== false);
            setMessage(`批次完成：成功 ${result?.summary?.succeeded || 0} 位，失敗 ${result?.summary?.failed || 0} 位。`);
        } catch (error) {
            setMessage(`${error?.message || "批次建立失敗"}。為避免重複帳號，本批不會自動重送；請先到帳號管理確認結果。`);
        } finally {
            setSubmitting(false);
        }
    };

    const downloadResults = () => {
        if (results.length === 0) return;
        downloadCsv(
            buildAcademyStudentResultCsv(results),
            `alan-english-student-import-result-${new Date().toISOString().slice(0, 10)}.csv`
        );
    };

    const previewRows = Array.isArray(preview?.rows) ? preview.rows : [];
    const canCreate = previewRows.length > 0
        && preview?.summary?.invalid === 0
        && !submitted
        && !submitting;

    return (
        <main className="management-page academy-csv-page">
            <section className="management-hero academy-csv-hero">
                <div>
                    <span className="management-eyebrow">CSV STUDENT IMPORT</span>
                    <h1>CSV 批次建立英文班學生</h1>
                    <p>先下載範本並預覽驗證，再一次建立整班帳號。每批最多 {ACADEMY_STUDENT_CSV_MAX_ROWS} 位。</p>
                </div>
                <Link to="/admin/accounts" className="management-primary-link academy-csv-back-link">返回帳號管理</Link>
            </section>

            <section className="management-panel academy-csv-panel">
                <div className="academy-csv-steps" aria-label="匯入步驟">
                    <span className="active">1. 下載範本</span>
                    <span className={preview ? "active" : ""}>2. 預覽驗證</span>
                    <span className={results.length > 0 ? "active" : ""}>3. 建立與下載結果</span>
                </div>

                <div className="academy-csv-upload-grid">
                    <article>
                        <h2>下載 CSV 範本</h2>
                        <p>欄位包含中文姓名、英文姓名、可收信 Email、班級、入班日期、權限截止日與備註。</p>
                        <button
                            type="button"
                            className="academy-csv-secondary"
                            onClick={() => downloadCsv(buildAcademyStudentCsvTemplate(), "alan-english-student-import-template.csv")}
                        >
                            下載範本
                        </button>
                    </article>

                    <article>
                        <h2>選擇填好的 CSV</h2>
                        <p>班級只接受 E1、E3、E5、E7；Email 必須可正常收信。</p>
                        <label className="academy-csv-file-button">
                            <span>{loading ? "驗證中..." : "選擇 CSV 檔案"}</span>
                            <input
                                ref={inputRef}
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleFile}
                                disabled={loading || submitting}
                            />
                        </label>
                        {filename && <small>{filename}</small>}
                    </article>
                </div>

                {message && (
                    <div className={`academy-csv-message ${results.length > 0 ? "success" : ""}`} role="status">
                        {message}
                    </div>
                )}

                {preview && (
                    <>
                        <div className="academy-csv-summary">
                            <span>共 {preview.summary?.total || 0} 列</span>
                            <strong>{preview.summary?.valid || 0} 列可建立</strong>
                            <span className={preview.summary?.invalid > 0 ? "error" : ""}>{preview.summary?.invalid || 0} 列有錯</span>
                        </div>

                        <div className="management-table-wrap">
                            <table className="management-table academy-csv-preview-table">
                                <thead>
                                    <tr>
                                        <th>CSV 列</th>
                                        <th>學生</th>
                                        <th>登入 Email</th>
                                        <th>班級</th>
                                        <th>入班／截止</th>
                                        <th>驗證結果</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRows.map((item, index) => {
                                        const source = rows[index] || {};
                                        return (
                                            <tr key={`${source.source_row}-${source.login_email}`} className={item.valid ? "" : "academy-csv-invalid-row"}>
                                                <td>{source.source_row}</td>
                                                <td><strong>{source.chinese_name}</strong>{source.english_name && <small>{source.english_name}</small>}</td>
                                                <td>{source.login_email}</td>
                                                <td>{source.class_code}</td>
                                                <td><span>{displayDate(source.enrolled_at)}</span><small>至 {displayDate(source.access_ends_at)}</small></td>
                                                <td>{item.valid
                                                    ? <span className="academy-csv-valid">可建立</span>
                                                    : <span className="academy-csv-invalid">{item.errors?.join("；") || "資料有誤"}</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="academy-csv-create-bar">
                            <div>
                                <strong>建立前請再次確認</strong>
                                <span>臨時密碼只在完成結果顯示一次，不會儲存在系統中。</span>
                            </div>
                            <button type="button" disabled={!canCreate} onClick={handleCreate}>
                                {submitting ? "建立中，請勿關閉..." : `建立 ${preview.summary?.valid || 0} 位學生`}
                            </button>
                        </div>
                    </>
                )}

                {results.length > 0 && (
                    <section className="academy-csv-results" aria-live="polite">
                        <div className="academy-csv-results-heading">
                            <div>
                                <h2>批次建立結果</h2>
                                <p>請立即下載並妥善交付。離開或重新整理後，臨時密碼不會再次顯示。</p>
                            </div>
                            <button type="button" onClick={downloadResults}>下載成功／失敗結果</button>
                        </div>
                        {!auditComplete && <div className="academy-csv-audit-warning">部分操作紀錄寫入失敗，請暫停下一批並檢查 Function Logs。</div>}
                        <div className="management-table-wrap">
                            <table className="management-table academy-csv-result-table">
                                <thead><tr><th>CSV 列</th><th>登入 Email</th><th>結果</th><th>一次性臨時密碼</th></tr></thead>
                                <tbody>
                                    {results.map(result => (
                                        <tr key={`${result.source_row}-${result.login_email}`}>
                                            <td>{result.source_row}</td>
                                            <td>{result.credentials?.email || result.login_email}</td>
                                            <td>{result.status === "success" ? "成功" : result.error}</td>
                                            <td><strong className="academy-csv-password">{result.credentials?.temporary_password || "—"}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {(preview || results.length > 0) && (
                    <button type="button" className="academy-csv-reset" onClick={resetImport} disabled={submitting}>
                        清除畫面並匯入下一批
                    </button>
                )}
            </section>
        </main>
    );
}

export default AcademyStudentCsvImport;
