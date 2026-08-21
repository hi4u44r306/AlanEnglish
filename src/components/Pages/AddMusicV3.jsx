import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
    checkMusicTrack,
    createMusicBook,
    createMusicUpload,
    deleteMusicTrack,
    finalizeMusicUpload,
    getMusicAdminBootstrap,
    listMusicTracks,
    updateMusicTrackDisplayName
} from "../../services/musicAdminService";
import { supabase } from "./supabase-config";
import "./css/AddMusic.scss";
import "./css/AddMusicV3.scss";

const LibraryAudio = ({ src }) => {
    const audioRef = useRef(null);

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = 0.5;
    }, [src]);

    return <audio ref={audioRef} controls preload="none" src={src} />;
};

const TRACK_TYPE_LABELS = {
    main: "一般",
    question: "Question",
    answer: "Answer"
};

const TYPE_SORT_OFFSET = {
    question: 10,
    main: 20,
    answer: 30
};

const AddMusicV3 = () => {
    const { firebaseUser } = useAuth();
    const fileInputRef = useRef(null);
    const [books, setBooks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedBookId, setSelectedBookId] = useState("");
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadQueue, setUploadQueue] = useState([]);
    const [existingTracks, setExistingTracks] = useState([]);
    const [searchText, setSearchText] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showNewBook, setShowNewBook] = useState(false);
    const [creatingBook, setCreatingBook] = useState(false);
    const [newBook, setNewBook] = useState({ category_id: "", name: "", code: "" });
    const [editingTrack, setEditingTrack] = useState(null);
    const [editName, setEditName] = useState("");
    const [savingTrackId, setSavingTrackId] = useState(null);
    const [deletingTrackId, setDeletingTrackId] = useState(null);

    const selectedBook = useMemo(
        () => books.find(book => Number(book.id) === Number(selectedBookId)),
        [books, selectedBookId]
    );

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const fetchBooks = useCallback(async () => {
        try {
            const result = await getMusicAdminBootstrap(firebaseUser);
            setBooks(result?.books || []);
            setCategories(result?.categories || []);
            return result?.books || [];
        } catch (error) {
            console.error("讀取教材失敗:", error);
            return [];
        }
    }, [firebaseUser]);

    const fetchExistingTracks = useCallback(async () => {
        if (!selectedBookId) {
            setExistingTracks([]);
            return;
        }

        try {
            const result = await listMusicTracks(firebaseUser, Number(selectedBookId));
            setExistingTracks(result?.tracks || []);
        } catch (error) {
            console.error("讀取音檔失敗:", error);
        }
    }, [firebaseUser, selectedBookId]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await fetchBooks();
            setLoading(false);
        };
        load();
    }, [fetchBooks]);

    useEffect(() => {
        fetchExistingTracks();
    }, [fetchExistingTracks]);

    const handleCreateBook = async () => {
        const categoryId = Number(newBook.category_id);
        const name = newBook.name.trim();
        const code = newBook.code.trim();

        if (!categoryId || !name || !code) return alert("請完整填寫教材分類、教材名稱與 Code");
        if (books.some(book => book.code.toLowerCase() === code.toLowerCase())) return alert(`Code「${code}」已經存在`);

        setCreatingBook(true);
        try {
            const result = await createMusicBook(firebaseUser, { category_id: categoryId, name, code });
            const data = result.book;
            await fetchBooks();
            setSelectedBookId(String(data.id));
            setSelectedFiles([]);
            setUploadQueue([]);
            setNewBook({ category_id: "", name: "", code: "" });
            setShowNewBook(false);
            alert(`「${data.name}」建立成功，可以直接上傳音檔。`);
        } catch (error) {
            console.error("新增教材失敗:", error);
            alert(`新增教材失敗：${error.message}`);
        } finally {
            setCreatingBook(false);
        }
    };

    const shouldIgnoreFile = file => {
        const name = file.name.toLowerCase();
        return name.startsWith("._") || name === ".ds_store" || name === "thumbs.db";
    };

    const makeSafeStorageName = displayPage => {
        const safePage = displayPage.trim().replace(/\s+/g, "_").replace(/[^\w-]/g, "");
        return `${selectedBook.code}_${safePage}.mp3`;
    };

    const getVariantType = fileStem => {
        const typeMatch = fileStem.match(/(?:^|[\s_-])(Question|Answer)(?:$|[\s_-])/i);
        if (!typeMatch) return "main";
        return typeMatch[1].toLowerCase() === "question" ? "question" : "answer";
    };

    const getPartNumber = (fileStem, match) => {
        const afterMatch = fileStem.slice((match.index || 0) + match[0].length);
        const directPart = afterMatch.match(/^[\s_-]+(\d+)(?=$|[\s_-])/);
        const typePart = afterMatch.match(/(?:Question|Answer)[\s_-]+(\d+)$/i);
        if (directPart) return Number(directPart[1]);
        if (typePart) return Number(typePart[1]);
        return null;
    };

    const buildVariant = ({ prefix, number, trackType, partNumber }) => {
        const normalizedPrefix = prefix === "P" ? "P" : prefix === "Unit" ? "Unit " : "Track ";
        const basePage = `${normalizedPrefix}${number}`;
        let displayPage = basePage;

        if (trackType === "question") displayPage += " Question";
        if (trackType === "answer") displayPage += " Answer";
        if (partNumber) displayPage += `-${partNumber}`;

        const keyPrefix = prefix === "P" ? `p${number}` : prefix === "Unit" ? `unit${number}` : `track${number}`;
        const sortBase = Number(number) * 100;

        return {
            page: basePage,
            basePage,
            displayPage,
            pageNumber: Number(number),
            trackType,
            partNumber: partNumber || null,
            trackKey: `${keyPrefix}:${trackType}:${partNumber || 0}`,
            sortOrder: sortBase + TYPE_SORT_OFFSET[trackType] + (partNumber || 0)
        };
    };

    const parseFile = file => {
        if (!selectedBook) return { valid: false, reason: "尚未選擇教材" };
        if (shouldIgnoreFile(file)) return { valid: false, ignored: true, reason: "系統隱藏檔" };
        if (!file.name.toLowerCase().endsWith(".mp3")) return { valid: false, reason: "只接受 MP3" };

        const fileStem = file.name.replace(/\.mp3$/i, "").trim();
        const trackType = getVariantType(fileStem);
        const pageMatch = fileStem.match(/P[\s_-]*(\d+)/i);
        const unitMatch = fileStem.match(/Unit[\s_-]*(\d+)/i);
        const trackMatch = fileStem.match(/Track[\s_-]*(\d+)/i);
        const matched = pageMatch || unitMatch || trackMatch;

        if (!matched) {
            return {
                valid: false,
                reason: "無法辨識。支援 P21-1、P24 Question、Unit 1、Track 37、SER1track24 等格式。"
            };
        }

        const prefix = pageMatch ? "P" : unitMatch ? "Unit" : "Track";
        const number = Number(matched[1]);
        const partNumber = getPartNumber(fileStem, matched);
        const variant = buildVariant({ prefix, number, trackType, partNumber });
        const storageFileName = makeSafeStorageName(variant.displayPage);

        return {
            valid: true,
            ...variant,
            storageFileName,
            storagePath: `${selectedBook.code}/${storageFileName}`
        };
    };

    const addFiles = fileList => {
        if (!selectedBook) return alert("請先選擇教材");

        const parsed = Array.from(fileList)
            .map(file => {
                const result = parseFile(file);
                return {
                    id: `${file.name}-${file.size}-${file.lastModified}`,
                    file,
                    originalName: file.name,
                    size: file.size,
                    ...result,
                    status: result.valid ? "ready" : "invalid"
                };
            })
            .filter(item => !item.ignored);

        setSelectedFiles(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            return [...prev, ...parsed.filter(item => !existingIds.has(item.id))];
        });
    };

    const handleFileInput = event => {
        addFiles(event.target.files);
        event.target.value = "";
    };

    const handleDrop = event => {
        event.preventDefault();
        setDragActive(false);
        addFiles(event.dataTransfer.files);
    };

    const updateQueueItem = (id, updates) => {
        setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const removeFromPending = id => {
        setSelectedFiles(prev => prev.filter(item => item.id !== id));
    };

    const checkTrackExists = async trackKey => {
        try {
            const result = await checkMusicTrack(firebaseUser, Number(selectedBookId), trackKey);
            return Boolean(result?.exists);
        } catch (error) {
            console.warn("檢查音檔是否存在失敗:", error);
            return false;
        }
    };

    const insertTrackWithRetry = async (item, maxRetries = 3) => {
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            if (await checkTrackExists(item.trackKey)) return { success: true, alreadyExists: true };

            try {
                const result = await finalizeMusicUpload(firebaseUser, {
                    book_id: Number(selectedBookId),
                    page: item.page,
                    base_page: item.basePage,
                    display_page: item.displayPage,
                    track_type: item.trackType,
                    part_number: item.partNumber,
                    track_key: item.trackKey,
                    music_name: item.storageFileName,
                    storage_path: item.storagePath,
                    sort_order: item.sortOrder
                });
                return { success: true, alreadyExists: Boolean(result?.already_exists) };
            } catch (error) {
                lastError = error;
            }

            const retryable = /timeout|connection|network|fetch|500|502|503|504/i.test(lastError?.message || "");
            if (!retryable || attempt === maxRetries) break;

            updateQueueItem(item.id, { status: "database", message: `資料庫忙碌，自動重試 ${attempt}/${maxRetries}...` });
            await sleep(attempt * 1200);
        }

        return { success: false, error: lastError };
    };

    const uploadSingleFile = async item => {
        if (!item.valid) {
            updateQueueItem(item.id, { status: "failed", message: item.reason });
            return;
        }

        if (await checkTrackExists(item.trackKey)) {
            updateQueueItem(item.id, { status: "skipped", message: `${item.displayPage} 已存在` });
            removeFromPending(item.id);
            return;
        }

        updateQueueItem(item.id, { status: "uploading", message: "上傳 Storage..." });

        try {
            const signed = await createMusicUpload(firebaseUser, Number(selectedBookId), item.trackKey, item.storagePath);
            const uploadPath = signed?.upload?.path || item.storagePath;
            const uploadToken = signed?.upload?.token;
            if (!uploadToken) throw new Error("無法建立安全上傳網址");
            const { error: uploadError } = await supabase.storage
                .from("music")
                .uploadToSignedUrl(uploadPath, uploadToken, item.file, {
                    cacheControl: "3600",
                    contentType: "audio/mpeg"
                });
            if (uploadError) throw uploadError;
        } catch (uploadError) {
            if (uploadError?.code === "track_exists") {
                updateQueueItem(item.id, { status: "skipped", message: `${item.displayPage} 已存在` });
                removeFromPending(item.id);
                return;
            }
            updateQueueItem(item.id, { status: "failed", message: `Storage：${uploadError?.message || "上傳失敗"}` });
            return;
        }

        updateQueueItem(item.id, { status: "database", message: "建立 Playlist..." });
        const result = await insertTrackWithRetry(item, 3);

        if (!result.success) {
            updateQueueItem(item.id, { status: "failed", message: `資料庫：${result.error?.message || "未知錯誤"}` });
            return;
        }

        updateQueueItem(item.id, {
            status: result.alreadyExists ? "skipped" : "success",
            message: result.alreadyExists ? `${item.displayPage} 已存在` : `${item.displayPage} 上傳完成`
        });
        removeFromPending(item.id);
        await sleep(250);
    };

    const handleUploadAll = async () => {
        const validFiles = selectedFiles.filter(item => item.valid);
        if (!selectedBook) return alert("請先選擇教材");
        if (!validFiles.length) return alert("沒有可以上傳的 MP3");

        const counts = {};
        validFiles.forEach(item => {
            counts[item.trackKey] = (counts[item.trackKey] || 0) + 1;
        });
        const duplicates = Object.keys(counts).filter(key => counts[key] > 1);

        if (duplicates.length) {
            const labels = duplicates.map(key => validFiles.find(item => item.trackKey === key)?.displayPage || key);
            return alert(`這批檔案有重複音檔：\n${labels.join("\n")}\n\n同一頁可以有不同分段或 Question / Answer，但完全相同的音檔識別不能重複。`);
        }

        setUploading(true);
        setUploadQueue(selectedFiles.map(item => ({
            ...item,
            status: item.valid ? "waiting" : "failed",
            message: item.valid ? "等待上傳" : item.reason
        })));

        for (const item of validFiles) await uploadSingleFile(item);
        await fetchExistingTracks();
        setUploading(false);
    };

    const handleRetryFailed = async () => {
        const failedFiles = uploadQueue.filter(item => item.status === "failed");
        if (!failedFiles.length) return alert("目前沒有失敗的音檔");

        setUploading(true);
        setUploadQueue(prev => prev.map(item => item.status === "failed"
            ? { ...item, status: "waiting", message: "準備重新嘗試..." }
            : item
        ));
        for (const item of failedFiles) await uploadSingleFile(item);
        await fetchExistingTracks();
        setUploading(false);
    };

    const handleDeleteTrack = async track => {
        const displayName = track.display_page || track.page || track.music_name;
        const confirmed = window.confirm(`確定要刪除「${displayName}」嗎？\n\n確認後會刪除 Playlist 資料與 Storage MP3。已有學生紀錄或被作業使用的音檔會自動阻止刪除。`);
        if (!confirmed) return;

        setDeletingTrackId(track.id);
        try {
            const result = await deleteMusicTrack(firebaseUser, track.id);
            setExistingTracks(prev => prev.filter(item => item.id !== track.id));
            if (result?.storage_removed === false) {
                alert("音檔資料已刪除，但 Storage 清理失敗。網站已不會再顯示這個音檔。請稍後再檢查 Storage。");
            }
        } catch (error) {
            alert(error.message || "刪除音檔失敗");
        } finally {
            setDeletingTrackId(null);
        }
    };

    const openRename = track => {
        setEditingTrack(track);
        setEditName(track.display_page || track.page || "");
    };

    const handleRenameTrack = async () => {
        const nextName = editName.trim();
        if (!editingTrack || !nextName) return alert("顯示名稱不能空白");

        setSavingTrackId(editingTrack.id);
        try {
            const result = await updateMusicTrackDisplayName(firebaseUser, editingTrack.id, nextName);
            setExistingTracks(prev => prev.map(item => item.id === editingTrack.id ? { ...item, ...result.track } : item));
            setEditingTrack(null);
            setEditName("");
        } catch (error) {
            alert(error.message || "修改名稱失敗");
        } finally {
            setSavingTrackId(null);
        }
    };

    const filteredTracks = existingTracks.filter(track => {
        const keyword = searchText.trim().toLowerCase();
        if (!keyword) return true;
        return [track.display_page, track.page, track.music_name, track.track_type]
            .some(value => value?.toLowerCase().includes(keyword));
    });

    const successCount = uploadQueue.filter(item => item.status === "success").length;
    const failedCount = uploadQueue.filter(item => item.status === "failed").length;
    const skippedCount = uploadQueue.filter(item => item.status === "skipped").length;
    const processingCount = uploadQueue.filter(item => ["waiting", "uploading", "database"].includes(item.status)).length;

    return (
        <div className="music-admin">
            <div className="music-admin-header">
                <div>
                    <span className="admin-eyebrow">Alan English</span>
                    <h1>音檔管理</h1>
                    <p>支援頁碼、分段、Question / Answer、Track 舊格式，也可以直接修改或安全刪除已上傳音檔。</p>
                </div>
                <div className="music-admin-stats">
                    <div><span>教材</span><strong>{books.length}</strong></div>
                    <div><span>本書音檔</span><strong>{existingTracks.length}</strong></div>
                    <div><span>待上傳</span><strong>{selectedFiles.length}</strong></div>
                </div>
            </div>

            <div className="music-admin-grid">
                <section className="admin-card upload-panel">
                    <div className="card-header">
                        <div><span className="step-number">01</span><h2>選擇教材</h2></div>
                        <button type="button" className="text-button" onClick={fetchBooks} disabled={loading || uploading}>↻ 重新整理</button>
                    </div>

                    <label className="field-label">這批音檔屬於哪一本書？</label>
                    <select
                        className="book-select"
                        value={selectedBookId}
                        disabled={uploading}
                        onChange={event => {
                            setSelectedBookId(event.target.value);
                            setSelectedFiles([]);
                            setUploadQueue([]);
                        }}
                    >
                        <option value="">{loading ? "讀取教材中..." : "請選擇教材..."}</option>
                        {books.map(book => <option key={book.id} value={book.id}>{book.name} · {book.code}</option>)}
                    </select>

                    <button type="button" className="quick-add-book-button" onClick={() => setShowNewBook(prev => !prev)} disabled={uploading}>
                        {showNewBook ? "− 關閉新增教材" : "＋ 找不到教材？新增一本"}
                    </button>

                    {showNewBook && (
                        <div className="quick-new-book">
                            <div className="quick-new-book-header">
                                <div><span className="step-number">NEW</span><h3>快速建立新教材</h3></div>
                                <p>建立後會自動選取，可以馬上上傳。</p>
                            </div>
                            <label className="field-label">教材分類</label>
                            <select value={newBook.category_id} onChange={event => setNewBook({ ...newBook, category_id: event.target.value })}>
                                <option value="">請選擇分類...</option>
                                {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                            </select>
                            <label className="field-label">教材名稱</label>
                            <input type="text" placeholder="例如 Super Easy Reading 1" value={newBook.name} onChange={event => setNewBook({ ...newBook, name: event.target.value })} />
                            <label className="field-label">教材 Code</label>
                            <input type="text" placeholder="例如 SER_1" value={newBook.code} onChange={event => setNewBook({ ...newBook, code: event.target.value.replace(/\s+/g, "_") })} />
                            <div className="code-tip">建議使用英文、數字、底線，例如：<code>SER_1</code></div>
                            <button type="button" className="create-book-button" onClick={handleCreateBook} disabled={creatingBook}>
                                {creatingBook ? "建立教材中..." : "建立並選擇這本教材"}
                            </button>
                        </div>
                    )}

                    {selectedBook && (
                        <div className="selected-book-info">
                            <div><span>目前教材</span><strong>{selectedBook.name}</strong></div>
                            <code>{selectedBook.code}</code>
                        </div>
                    )}

                    <div className="card-header upload-header">
                        <div><span className="step-number">02</span><h2>上傳音檔</h2></div>
                    </div>

                    <div
                        className={`drop-zone ${dragActive ? "active" : ""} ${!selectedBook ? "disabled" : ""}`}
                        onDragOver={event => {
                            event.preventDefault();
                            if (selectedBook && !uploading) setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={event => !uploading && handleDrop(event)}
                        onClick={() => selectedBook && !uploading && fileInputRef.current?.click()}
                    >
                        <input ref={fileInputRef} type="file" accept=".mp3,audio/mpeg" multiple hidden onChange={handleFileInput} />
                        <div className="upload-icon">↑</div>
                        <h3>{dragActive ? "放開即可加入" : "把所有 MP3 拖進來"}</h3>
                        <p>原始檔名不用修改，系統會自動辨識頁碼、Track、Question / Answer 與分段。</p>
                        {selectedBook && (
                            <div className="filename-example">
                                支援：<code>P21-1</code>、<code>P24 Question</code>、<code>Unit 1</code>、<code>Track 37</code>、<code>SER1track24</code>
                            </div>
                        )}
                    </div>

                    {selectedFiles.length > 0 && (
                        <div className="selected-file-section">
                            <div className="section-title-row">
                                <h3>準備上傳 <span className="pending-count">{selectedFiles.length}</span></h3>
                                <button type="button" className="text-button" onClick={() => { setSelectedFiles([]); setUploadQueue([]); }} disabled={uploading}>全部清除</button>
                            </div>
                            <div className="selected-file-list">
                                {selectedFiles.map(item => (
                                    <div className={`selected-file ${item.valid ? "" : "invalid"}`} key={item.id}>
                                        <div className="file-icon">MP3</div>
                                        <div className="file-info">
                                            <strong>{item.originalName}</strong>
                                            <span>{item.valid
                                                ? `辨識為 ${item.displayPage} · ${TRACK_TYPE_LABELS[item.trackType]}${item.partNumber ? ` · 第 ${item.partNumber} 段` : ""} · ${(item.size / 1024 / 1024).toFixed(2)} MB`
                                                : item.reason
                                            }</span>
                                        </div>
                                        <div className={`validation-badge ${item.valid ? "valid" : "invalid"}`}>{item.valid ? "已辨識" : "無法辨識"}</div>
                                        <button type="button" className="remove-file" onClick={() => setSelectedFiles(prev => prev.filter(file => file.id !== item.id))} disabled={uploading}>×</button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="upload-all-button" onClick={handleUploadAll} disabled={uploading || !selectedFiles.some(file => file.valid)}>
                                {uploading ? `處理中... ${processingCount} 個等待` : `上傳 ${selectedFiles.filter(file => file.valid).length} 個音檔`}
                            </button>
                        </div>
                    )}
                </section>

                <section className="admin-card status-panel">
                    <div className="card-header"><div><span className="step-number">03</span><h2>處理狀態</h2></div></div>
                    {!uploadQueue.length ? (
                        <div className="empty-upload-state"><div>✓</div><h3>準備完成</h3><p>選教材、丟 MP3，剩下交給系統。</p></div>
                    ) : (
                        <>
                            <div className="upload-summary">
                                <div className="summary-success"><span>成功</span><strong>{successCount}</strong></div>
                                <div className="summary-skipped"><span>略過</span><strong>{skippedCount}</strong></div>
                                <div className="summary-failed"><span>失敗</span><strong>{failedCount}</strong></div>
                            </div>
                            {failedCount > 0 && !uploading && <button type="button" className="retry-failed-button" onClick={handleRetryFailed}>↻ 只重試 {failedCount} 個失敗音檔</button>}
                            <div className="upload-queue">
                                {uploadQueue.map(item => (
                                    <div className="queue-item" key={item.id}>
                                        <div className={`queue-status ${item.status}`}>{item.status === "success" ? "✓" : item.status === "failed" ? "!" : item.status === "skipped" ? "−" : "••"}</div>
                                        <div><strong>{item.originalName}</strong><span>{item.message || "等待中"}</span></div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </section>
            </div>

            <section className="admin-card library-panel">
                <div className="library-header">
                    <div><span className="admin-eyebrow">Library</span><h2>{selectedBook ? `${selectedBook.name} 音檔` : "教材音檔"}</h2></div>
                    <input type="text" placeholder="搜尋 P21-1、Track 37、Question 或檔名..." value={searchText} onChange={event => setSearchText(event.target.value)} disabled={!selectedBook} />
                </div>

                {!selectedBook ? (
                    <div className="library-empty">先選擇一本教材。</div>
                ) : filteredTracks.length === 0 ? (
                    <div className="library-empty">這本教材目前還沒有音檔。</div>
                ) : (
                    <div className="track-grid">
                        {filteredTracks.map(track => (
                            <div className="track-card track-card-v3" key={track.id}>
                                <div className="track-top">
                                    <span className="track-page">{track.display_page || track.page}</span>
                                    <span className={track.enabled ? "track-enabled" : "track-disabled"}>{track.enabled ? "顯示中" : "已隱藏"}</span>
                                </div>
                                <strong>{track.music_name}</strong>
                                <span className="track-path">{TRACK_TYPE_LABELS[track.track_type] || track.track_type}{track.part_number ? ` · 第 ${track.part_number} 段` : ""}</span>
                                <span className="track-path">{track.audio_url}</span>
                                {track.preview_url ? <LibraryAudio src={track.preview_url} /> : <span className="track-path">預覽網址暫時無法使用</span>}
                                <div className="track-admin-actions">
                                    <button type="button" className="track-edit-button" onClick={() => openRename(track)} disabled={savingTrackId === track.id || deletingTrackId === track.id}>修改名稱</button>
                                    <button type="button" className="track-delete-button" onClick={() => handleDeleteTrack(track)} disabled={deletingTrackId === track.id || savingTrackId === track.id}>
                                        {deletingTrackId === track.id ? "刪除中..." : "刪除音檔"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {editingTrack && (
                <div className="music-edit-overlay" onMouseDown={event => event.target === event.currentTarget && setEditingTrack(null)}>
                    <div className="music-edit-dialog">
                        <span className="admin-eyebrow">EDIT TRACK</span>
                        <h3>修改顯示名稱</h3>
                        <p>這只修改學生在 Playlist 看到的名稱，不會重新上傳 MP3。</p>
                        <label className="field-label">顯示名稱</label>
                        <input value={editName} onChange={event => setEditName(event.target.value)} placeholder="例如 Track 24 或 P24 Question" maxLength={120} autoFocus />
                        <div className="music-edit-actions">
                            <button type="button" className="music-edit-cancel" onClick={() => setEditingTrack(null)} disabled={savingTrackId === editingTrack.id}>取消</button>
                            <button type="button" className="music-edit-save" onClick={handleRenameTrack} disabled={savingTrackId === editingTrack.id || !editName.trim()}>
                                {savingTrackId === editingTrack.id ? "儲存中..." : "儲存名稱"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddMusicV3;
