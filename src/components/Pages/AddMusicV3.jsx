import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
    checkMusicTrack,
    createMusicBook,
    createMusicUpload,
    confirmR2AudioTest,
    deleteMusicTrack,
    finalizeMusicUpload,
    getMusicAdminBootstrap,
    getR2AudioStatus,
    listMusicTracks,
    migrateR2AudioBatch,
    prepareR2AudioTest,
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

const R2_CORS_POLICY = JSON.stringify([
    {
        AllowedOrigins: [
            "https://alanenglish.com.tw",
            "https://www.alanenglish.com.tw",
            "https://alanenglish-student-test.netlify.app",
            "https://alan-english-listening.web.app",
            "https://alan-english-listening.firebaseapp.com"
        ],
        AllowedMethods: ["GET", "HEAD", "PUT"],
        AllowedHeaders: ["Content-Type", "Range"],
        ExposeHeaders: ["ETag", "Content-Length"],
        MaxAgeSeconds: 3600
    }
], null, 2);

const AddMusicV3 = () => {
    const { firebaseUser, role } = useAuth();
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
    const [r2Status, setR2Status] = useState(null);
    const [r2Busy, setR2Busy] = useState(false);
    const [migrationMessage, setMigrationMessage] = useState("");

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

    const fetchR2Status = useCallback(async () => {
        if (role !== "admin") return null;
        try {
            const result = await getR2AudioStatus(firebaseUser);
            setR2Status(result);
            return result;
        } catch (error) {
            setMigrationMessage(error.message || "無法讀取 R2 狀態");
            return null;
        }
    }, [firebaseUser, role]);

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

    useEffect(() => {
        fetchR2Status();
    }, [fetchR2Status]);

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
                    sort_order: item.sortOrder,
                    storage_provider: item.storageProvider || "supabase"
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

        let storageProvider = "supabase";
        try {
            const signed = await createMusicUpload(firebaseUser, Number(selectedBookId), item.trackKey, item.storagePath);
            const uploadPath = signed?.upload?.path || item.storagePath;
            if (signed?.provider === "r2") {
                const signedUrl = signed?.upload?.signed_url;
                if (!signedUrl) throw new Error("無法建立 R2 安全上傳網址");
                const response = await fetch(signedUrl, {
                    method: signed.upload.method || "PUT",
                    headers: signed.upload.headers || { "Content-Type": "audio/mpeg" },
                    body: item.file
                });
                if (!response.ok) throw new Error(`R2 上傳失敗（HTTP ${response.status}）`);
                storageProvider = "r2";
            } else {
                const uploadToken = signed?.upload?.token;
                if (!uploadToken) throw new Error("無法建立安全上傳網址");
                const { error: uploadError } = await supabase.storage
                    .from("music")
                    .uploadToSignedUrl(uploadPath, uploadToken, item.file, {
                        cacheControl: "3600",
                        contentType: "audio/mpeg"
                    });
                if (uploadError) throw uploadError;
                storageProvider = "supabase";
            }
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
        const result = await insertTrackWithRetry({ ...item, storageProvider }, 3);

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

    const handleConfigureR2 = async () => {
        setR2Busy(true);
        setMigrationMessage("正在驗證 R2，並從這個瀏覽器測試跨網域上傳...");
        try {
            const prepared = await prepareR2AudioTest(firebaseUser);
            const response = await fetch(prepared.upload.signed_url, {
                method: prepared.upload.method || "PUT",
                headers: prepared.upload.headers || { "Content-Type": "text/plain" },
                body: "Alan English R2 CORS verification"
            });
            if (!response.ok) throw new Error(`瀏覽器 R2 測試失敗（HTTP ${response.status}）`);
            await confirmR2AudioTest(firebaseUser, prepared.test_key);
            await fetchR2Status();
            setMigrationMessage("R2 連線與瀏覽器 CORS 測試成功；之後新上傳的 MP3 將直接存入 R2。");
        } catch (error) {
            setMigrationMessage(`${error.message || "R2 設定失敗"}。若 R2 連線顯示正常，請先到 Bucket Settings 新增下方 CORS Policy。`);
        } finally {
            setR2Busy(false);
        }
    };

    const migrateBatch = async limit => {
        const result = await migrateR2AudioBatch(firebaseUser, limit);
        if (result.failed > 0) {
            const firstError = result.results?.find(item => !item.success)?.error;
            throw new Error(firstError || `${result.failed} 首搬移失敗`);
        }
        return result;
    };

    const handleMigrateOne = async () => {
        setR2Busy(true);
        setMigrationMessage("正在複製第 1 首測試音檔；Supabase 原檔會保留...");
        try {
            const result = await migrateBatch(1);
            await Promise.all([fetchR2Status(), fetchExistingTracks()]);
            setMigrationMessage(result.complete
                ? "沒有待搬移的音檔。"
                : `已安全搬移 ${result.migrated} 首。請先播放 R2 標記的音檔，確認後再搬移全部。`);
        } catch (error) {
            await fetchR2Status();
            setMigrationMessage(`測試停止：${error.message}`);
        } finally {
            setR2Busy(false);
        }
    };

    const handleMigrateAll = async () => {
        if (!window.confirm("將逐批複製剩餘 MP3 到 R2，Supabase 原檔仍會全部保留。搬移期間請保持此頁開啟。確定繼續？")) return;
        setR2Busy(true);
        let migrated = 0;
        try {
            while (true) {
                setMigrationMessage(`安全搬移中，這次已完成 ${migrated} 首...`);
                const result = await migrateBatch(5);
                migrated += result.migrated;
                if (result.complete || result.processed === 0) break;
                await sleep(300);
            }
            await Promise.all([fetchR2Status(), fetchExistingTracks()]);
            setMigrationMessage(`搬移完成：本次 ${migrated} 首。Supabase 原檔仍保留，尚未刪除。`);
        } catch (error) {
            await fetchR2Status();
            setMigrationMessage(`已安全停止；完成的檔案不受影響。原因：${error.message}`);
        } finally {
            setR2Busy(false);
        }
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

            {role === "admin" && (
                <section className="admin-card r2-panel">
                    <div className="library-header">
                        <div>
                            <span className="admin-eyebrow">PRIVATE AUDIO STORAGE</span>
                            <h2>Cloudflare R2 安全搬移</h2>
                            <p>逐首驗證後才切換播放來源；Supabase 原始 MP3 會保留，這裡不會刪除備份。</p>
                        </div>
                        <button type="button" className="text-button" onClick={fetchR2Status} disabled={r2Busy}>↻ 更新狀態</button>
                    </div>
                    <div className="r2-status-grid">
                        <div><span>R2 連線</span><strong className={r2Status?.connection?.ok ? "r2-ok" : "r2-error"}>{r2Status?.connection?.ok ? "正常" : "待設定"}</strong></div>
                        <div><span>Supabase</span><strong>{r2Status?.totals?.supabase ?? "—"}</strong></div>
                        <div><span>R2</span><strong>{r2Status?.totals?.r2 ?? "—"}</strong></div>
                        <div><span>錯誤</span><strong>{r2Status?.totals?.errors ?? "—"}</strong></div>
                    </div>
                    {r2Status?.connection?.error && <div className="r2-message r2-message-error">{r2Status.connection.error}</div>}
                    {migrationMessage && <div className="r2-message">{migrationMessage}</div>}
                    <div className="r2-actions">
                        <button type="button" onClick={handleConfigureR2} disabled={r2Busy}>
                            {r2Busy ? "處理中..." : r2Status?.settings?.upload_provider === "r2" ? "重新驗證 R2／CORS" : "驗證 R2 並啟用新上傳"}
                        </button>
                        <button type="button" onClick={handleMigrateOne} disabled={r2Busy || !r2Status?.connection?.ok}>
                            複製 1 首測試
                        </button>
                        <button type="button" className="r2-migrate-all" onClick={handleMigrateAll} disabled={r2Busy || !r2Status?.connection?.ok || !r2Status?.totals?.r2 || !r2Status?.totals?.supabase}>
                            搬移其餘全部
                        </button>
                    </div>
                    <small>「搬移其餘全部」會在至少 1 首測試成功後才開放。請先播放有 R2 標記的測試音檔。</small>
                    {r2Status?.settings?.upload_provider !== "r2" && (
                        <details className="r2-cors-guide">
                            <summary>R2 瀏覽器測試失敗時：查看要貼到 Cloudflare 的 CORS Policy</summary>
                            <ol>
                                <li>Cloudflare → R2 → alanenglish-audio → Settings</li>
                                <li>CORS Policy → Add CORS policy → JSON</li>
                                <li>貼上下方內容、儲存，再回來按「驗證 R2 並啟用新上傳」</li>
                            </ol>
                            <pre>{R2_CORS_POLICY}</pre>
                        </details>
                    )}
                </section>
            )}

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
                                    <div className="track-badges">
                                        <span className={`storage-badge ${track.storage_provider === "r2" ? "storage-r2" : "storage-supabase"}`}>{track.storage_provider === "r2" ? "R2" : "Supabase"}</span>
                                        <span className={track.enabled ? "track-enabled" : "track-disabled"}>{track.enabled ? "顯示中" : "已隱藏"}</span>
                                    </div>
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
