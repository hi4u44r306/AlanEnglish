import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase-config";
import "./css/AddMusic.scss";
import { sortMusicTracksAscending } from "../../utils/musicTrackSort";

// Library 音樂播放器：預設音量 50%
const LibraryAudio = ({ src }) => {
    const audioRef = useRef(null);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = 0.5;
        }
    }, [src]);

    return (
        <audio
            ref={audioRef}
            controls
            preload="none"
            src={src}
        />
    );
};

const AddMusic = () => {
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
    const [newBook, setNewBook] = useState({
        category_id: "",
        name: "",
        code: ""
    });

    const selectedBook = useMemo(
        () => books.find(book => Number(book.id) === Number(selectedBookId)),
        [books, selectedBookId]
    );

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);

            await Promise.all([
                fetchBooks(),
                fetchCategories()
            ]);

            setLoading(false);
        };

        fetchInitialData();
    }, []);

    useEffect(() => {
        const fetchExistingTracks = async () => {
            if (!selectedBookId) {
                setExistingTracks([]);
                return;
            }

            const { data, error } = await supabase
                .from("music_tracks")
                .select("*")
                .eq("book_id", Number(selectedBookId))
                .order("sort_order", { ascending: true })
                .order("id", { ascending: true });

            if (error) {
                console.error("讀取音檔失敗:", error);
                return;
            }

            setExistingTracks(sortMusicTracksAscending(data || []));
        };

        fetchExistingTracks();
    }, [selectedBookId]);

    // =========================
    // 工具
    // =========================

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const isRetryableError = error => {
        const message = (error?.message || "").toLowerCase();

        return (
            message.includes("timeout") ||
            message.includes("timed out") ||
            message.includes("connection") ||
            message.includes("network") ||
            message.includes("fetch") ||
            message.includes("500") ||
            message.includes("502") ||
            message.includes("503") ||
            message.includes("504")
        );
    };

    // =========================
    // 初始化
    // =========================

    // const fetchInitialData = async () => {
    //     setLoading(true);
    //     await Promise.all([
    //         fetchBooks(),
    //         fetchCategories()
    //     ]);
    //     setLoading(false);
    // };

    // =========================
    // 取得教材
    // =========================

    const fetchBooks = async () => {
        const { data, error } = await supabase
            .from("books")
            .select("id, name, code, category_id, sort_order, enabled")
            .eq("enabled", true)
            .order("category_id", { ascending: true })
            .order("sort_order", { ascending: true });

        if (error) {
            console.error("讀取教材失敗:", error);
            return [];
        }

        setBooks(data || []);
        return data || [];
    };

    // =========================
    // 取得分類
    // =========================

    const fetchCategories = async () => {
        const { data, error } = await supabase
            .from("book_categories")
            .select("id, name, code, sort_order, enabled")
            .eq("enabled", true)
            .order("sort_order", { ascending: true });

        if (error) {
            console.error("讀取分類失敗:", error);
            return;
        }

        setCategories(data || []);
    };

    // =========================
    // 取得目前書籍音檔
    // =========================

    const fetchExistingTracks = async () => {
        if (!selectedBookId) return;

        const { data, error } = await supabase
            .from("music_tracks")
            .select("*")
            .eq("book_id", Number(selectedBookId))
            .order("sort_order", { ascending: true })
            .order("id", { ascending: true });

        if (error) {
            console.error("讀取音檔失敗:", error);
            return;
        }

        setExistingTracks(sortMusicTracksAscending(data || []));
    };

    // =========================
    // 新增教材
    // =========================

    const handleCreateBook = async () => {
        const categoryId = Number(newBook.category_id);
        const name = newBook.name.trim();
        const code = newBook.code.trim();

        if (!categoryId || !name || !code) {
            alert("請完整填寫教材分類、教材名稱與 Code");
            return;
        }

        const duplicateCode = books.some(
            book => book.code.toLowerCase() === code.toLowerCase()
        );

        if (duplicateCode) {
            alert(`Code「${code}」已經存在`);
            return;
        }

        setCreatingBook(true);

        try {
            const sameCategoryBooks = books.filter(
                book => Number(book.category_id) === categoryId
            );

            const nextSortOrder = sameCategoryBooks.length
                ? Math.max(
                    ...sameCategoryBooks.map(
                        book => Number(book.sort_order) || 0
                    )
                ) + 1
                : 1;

            const { data, error } = await supabase
                .from("books")
                .insert({
                    category_id: categoryId,
                    name,
                    code,
                    sort_order: nextSortOrder,
                    enabled: true
                })
                .select("id, name, code, category_id, sort_order, enabled")
                .single();

            if (error) {
                console.error("新增教材失敗:", error);
                alert(`新增教材失敗：${error.message}`);
                return;
            }

            await fetchBooks();

            setSelectedBookId(String(data.id));
            setSelectedFiles([]);
            setUploadQueue([]);
            setNewBook({
                category_id: "",
                name: "",
                code: ""
            });
            setShowNewBook(false);

            alert(`「${data.name}」建立成功，可以直接上傳音檔。`);
        } finally {
            setCreatingBook(false);
        }
    };

    // =========================
    // 忽略系統垃圾檔
    // =========================

    const shouldIgnoreFile = file => {
        const name = file.name.toLowerCase();

        return (
            name.startsWith("._") ||
            name === ".ds_store" ||
            name === "thumbs.db"
        );
    };

    // =========================
    // Storage 安全名稱
    // =========================

    const makeSafeStorageName = page => {
        const safePage = page
            .trim()
            .replace(/\s+/g, "_")
            .replace(/[^\w-]/g, "");

        return `${selectedBook.code}_${safePage}.mp3`;
    };

    // =========================
    // 智慧解析檔名
    // =========================

    const parseFile = file => {
        if (!selectedBook) {
            return {
                valid: false,
                reason: "尚未選擇教材"
            };
        }

        if (shouldIgnoreFile(file)) {
            return {
                valid: false,
                ignored: true,
                reason: "系統隱藏檔"
            };
        }

        if (!file.name.toLowerCase().endsWith(".mp3")) {
            return {
                valid: false,
                reason: "只接受 MP3"
            };
        }

        const fileStem = file.name
            .replace(/\.mp3$/i, "")
            .trim();

        // -------------------------
        // Unit
        // Unit 1.mp3
        // _Unit 1.mp3
        // -------------------------

        const unitMatch = fileStem.match(
            /unit[\s_-]*(\d+)/i
        );

        if (unitMatch) {
            const unitNumber = Number(unitMatch[1]);
            const page = `Unit ${unitNumber}`;
            const storageFileName = makeSafeStorageName(page);

            return {
                valid: true,
                page,
                pageNumber: unitNumber,
                sortOrder: unitNumber,
                storageFileName,
                storagePath: `${selectedBook.code}/${storageFileName}`
            };
        }

        // -------------------------
        // Page
        // P22
        // 習作本2 P22
        // P8 Question
        // P8 Answer
        // -------------------------

        const pageMatch = fileStem.match(
            /P[\s_-]*(\d+)(?:[\s_-]*(Answer|Question))?/i
        );

        if (pageMatch) {
            const pageNumber = Number(pageMatch[1]);
            let suffix = "";

            if (pageMatch[2]) {
                const type = pageMatch[2].toLowerCase();

                if (type === "question") suffix = " Question";
                if (type === "answer") suffix = " Answer";
            }

            const page = `P${pageNumber}${suffix}`;
            const storageFileName = makeSafeStorageName(page);

            let sortOrder = pageNumber * 10;

            if (suffix === " Question") {
                sortOrder += 1;
            } else if (!suffix) {
                sortOrder += 2;
            } else if (suffix === " Answer") {
                sortOrder += 3;
            }

            return {
                valid: true,
                page,
                pageNumber,
                sortOrder,
                storageFileName,
                storagePath: `${selectedBook.code}/${storageFileName}`
            };
        }

        return {
            valid: false,
            reason: "無法辨識，目前支援 P22、P8 Question、P8 Answer、Unit 1"
        };
    };

    // =========================
    // 加入檔案
    // =========================

    const addFiles = fileList => {
        if (!selectedBook) {
            alert("請先選擇教材");
            return;
        }

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
            const existingIds = new Set(
                prev.map(item => item.id)
            );

            return [
                ...prev,
                ...parsed.filter(
                    item => !existingIds.has(item.id)
                )
            ];
        });
    };

    const handleFileInput = e => {
        addFiles(e.target.files);
        e.target.value = "";
    };

    const handleDrop = e => {
        e.preventDefault();
        setDragActive(false);
        addFiles(e.dataTransfer.files);
    };

    const removeSelectedFile = id => {
        setSelectedFiles(prev =>
            prev.filter(item => item.id !== id)
        );
    };

    const clearSelectedFiles = () => {
        setSelectedFiles([]);
        setUploadQueue([]);
    };

    const removeFromPending = id => {
        setSelectedFiles(prev =>
            prev.filter(item => item.id !== id)
        );
    };

    const updateQueueItem = (id, updates) => {
        setUploadQueue(prev =>
            prev.map(item =>
                item.id === id
                    ? { ...item, ...updates }
                    : item
            )
        );
    };

    // =========================
    // 確認 DB 是否已有
    // =========================

    const checkTrackExists = async page => {
        const { data, error } = await supabase
            .from("music_tracks")
            .select("id, page, music_name, audio_url")
            .eq("book_id", Number(selectedBookId))
            .eq("page", page)
            .maybeSingle();

        if (error) {
            console.warn(
                "檢查音檔是否存在失敗:",
                error
            );

            return false;
        }

        return !!data;
    };

    // =========================
    // DB Insert + Retry
    // =========================

    const insertTrackWithRetry = async (
        item,
        maxRetries = 3
    ) => {
        let lastError = null;

        for (
            let attempt = 1;
            attempt <= maxRetries;
            attempt++
        ) {
            const alreadyExists =
                await checkTrackExists(item.page);

            if (alreadyExists) {
                return {
                    success: true,
                    alreadyExists: true
                };
            }

            const { error } = await supabase
                .from("music_tracks")
                .insert({
                    book_id: Number(selectedBookId),
                    page: item.page,
                    title: `${selectedBook.name} ${item.page}`,
                    music_name: item.storageFileName,
                    audio_url: item.storagePath,
                    sort_order: item.sortOrder,
                    enabled: true
                });

            if (!error) {
                return {
                    success: true,
                    alreadyExists: false
                };
            }

            lastError = error;

            // Timeout 時 DB 可能其實成功了
            if (isRetryableError(error)) {
                await sleep(700);

                const insertedDespiteTimeout =
                    await checkTrackExists(item.page);

                if (insertedDespiteTimeout) {
                    return {
                        success: true,
                        alreadyExists: false
                    };
                }
            }

            if (
                !isRetryableError(error) ||
                attempt === maxRetries
            ) {
                break;
            }

            updateQueueItem(item.id, {
                status: "database",
                message: `資料庫忙碌，自動重試 ${attempt}/${maxRetries}...`
            });

            await sleep(attempt * 1500);
        }

        return {
            success: false,
            error: lastError
        };
    };

    // =========================
    // 上傳單首
    // =========================

    const uploadSingleFile = async item => {
        if (!item.valid) {
            updateQueueItem(item.id, {
                status: "failed",
                message: item.reason
            });

            return;
        }

        // -------------------------
        // 已經存在
        // -------------------------

        const alreadyExists =
            await checkTrackExists(item.page);

        if (alreadyExists) {
            updateQueueItem(item.id, {
                status: "skipped",
                message: `${item.page} 已存在`
            });

            // ⭐ 從準備上傳消失
            removeFromPending(item.id);

            return;
        }

        // -------------------------
        // Storage
        // -------------------------

        updateQueueItem(item.id, {
            status: "uploading",
            message: "上傳 Storage..."
        });

        const { error: uploadError } =
            await supabase.storage
                .from("music")
                .upload(
                    item.storagePath,
                    item.file,
                    {
                        cacheControl: "3600",
                        contentType: "audio/mpeg",
                        upsert: false
                    }
                );

        if (uploadError) {
            const uploadMessage =
                (uploadError.message || "")
                    .toLowerCase();

            const storageAlreadyExists =
                uploadMessage.includes("already exists") ||
                uploadMessage.includes("duplicate") ||
                uploadMessage.includes(
                    "resource already exists"
                );

            if (!storageAlreadyExists) {
                updateQueueItem(item.id, {
                    status: "failed",
                    message: `Storage：${uploadError.message}`
                });

                return;
            }

            updateQueueItem(item.id, {
                status: "database",
                message: "Storage 已存在，繼續建立 Playlist..."
            });
        }

        // -------------------------
        // Database
        // -------------------------

        updateQueueItem(item.id, {
            status: "database",
            message: "建立 Playlist..."
        });

        const result =
            await insertTrackWithRetry(
                item,
                3
            );

        if (!result.success) {
            updateQueueItem(item.id, {
                status: "failed",
                message: `資料庫：${result.error?.message ||
                    "未知錯誤"
                    }`
            });

            // ⭐ 失敗的不刪
            // 留在準備上傳清單方便重試
            return;
        }

        // -------------------------
        // DB 已存在
        // -------------------------

        if (result.alreadyExists) {
            updateQueueItem(item.id, {
                status: "skipped",
                message: `${item.page} 已存在`
            });

            // ⭐ 自動消失
            removeFromPending(item.id);

            return;
        }

        // -------------------------
        // 完整成功
        // -------------------------

        updateQueueItem(item.id, {
            status: "success",
            message: `${item.page} 上傳完成`
        });

        // ⭐ 成功後從準備上傳消失
        removeFromPending(item.id);

        // 降低大量 request 壓力
        await sleep(300);
    };

    // =========================
    // 同批重複檢查
    // =========================

    const checkBatchDuplicates = files => {
        const pageCounts = {};

        files.forEach(item => {
            const key =
                item.page.toLowerCase();

            pageCounts[key] =
                (pageCounts[key] || 0) + 1;
        });

        return Object
            .keys(pageCounts)
            .filter(
                key => pageCounts[key] > 1
            );
    };

    // =========================
    // 全部上傳
    // =========================

    const handleUploadAll = async () => {
        const validFiles =
            selectedFiles.filter(
                item => item.valid
            );

        if (!selectedBook) {
            alert("請先選擇教材");
            return;
        }

        if (!validFiles.length) {
            alert("沒有可以上傳的 MP3");
            return;
        }

        const duplicates =
            checkBatchDuplicates(validFiles);

        if (duplicates.length) {
            alert(
                `這批檔案有重複頁碼：\n${duplicates.join(
                    "\n"
                )}\n\n請先確認檔案。`
            );

            return;
        }

        setUploading(true);

        setUploadQueue(
            selectedFiles.map(item => ({
                ...item,
                status:
                    item.valid
                        ? "waiting"
                        : "failed",
                message:
                    item.valid
                        ? "等待上傳"
                        : item.reason
            }))
        );

        for (const item of validFiles) {
            await uploadSingleFile(item);
        }

        await fetchExistingTracks();

        setUploading(false);
    };

    // =========================
    // 只重試失敗
    // =========================

    const handleRetryFailed = async () => {
        const failedFiles =
            uploadQueue.filter(
                item => item.status === "failed"
            );

        if (!failedFiles.length) {
            alert("目前沒有失敗的音檔");
            return;
        }

        setUploading(true);

        setUploadQueue(prev =>
            prev.map(item =>
                item.status === "failed"
                    ? {
                        ...item,
                        status: "waiting",
                        message: "準備重新嘗試..."
                    }
                    : item
            )
        );

        for (const item of failedFiles) {
            await uploadSingleFile(item);
        }

        await fetchExistingTracks();

        setUploading(false);
    };

    // =========================
    // Library
    // =========================

    const filteredTracks = sortMusicTracksAscending(
        existingTracks.filter(track => {
            const keyword =
                searchText
                    .trim()
                    .toLowerCase();

            if (!keyword) return true;

            return (
                track.page
                    ?.toLowerCase()
                    .includes(keyword) ||
                track.music_name
                    ?.toLowerCase()
                    .includes(keyword)
            );
        })
    );

    const getPublicUrl = path => {
        return supabase.storage
            .from("music")
            .getPublicUrl(path)
            .data.publicUrl;
    };

    const successCount =
        uploadQueue.filter(
            item => item.status === "success"
        ).length;

    const failedCount =
        uploadQueue.filter(
            item => item.status === "failed"
        ).length;

    const skippedCount =
        uploadQueue.filter(
            item => item.status === "skipped"
        ).length;

    const processingCount =
        uploadQueue.filter(item =>
            [
                "waiting",
                "uploading",
                "database"
            ].includes(item.status)
        ).length;

    // =========================
    // UI
    // =========================

    return (
        <div className="music-admin">
            <div className="music-admin-header">
                <div>
                    <span className="admin-eyebrow">
                        Alan English
                    </span>

                    <h1>音檔管理</h1>

                    <p>
                        選教材 → 丟 MP3 → 自動建立 Storage 與 Playlist。
                    </p>
                </div>

                <div className="music-admin-stats">
                    <div>
                        <span>教材</span>
                        <strong>{books.length}</strong>
                    </div>

                    <div>
                        <span>本書音檔</span>
                        <strong>
                            {existingTracks.length}
                        </strong>
                    </div>

                    <div>
                        <span>待上傳</span>
                        <strong>
                            {selectedFiles.length}
                        </strong>
                    </div>
                </div>
            </div>

            <div className="music-admin-grid">
                <section className="admin-card upload-panel">
                    <div className="card-header">
                        <div>
                            <span className="step-number">
                                01
                            </span>

                            <h2>選擇教材</h2>
                        </div>

                        <button
                            type="button"
                            className="text-button"
                            onClick={fetchBooks}
                            disabled={
                                loading ||
                                uploading
                            }
                        >
                            ↻ 重新整理
                        </button>
                    </div>

                    <label className="field-label">
                        這批音檔屬於哪一本書？
                    </label>

                    <select
                        className="book-select"
                        value={selectedBookId}
                        disabled={uploading}
                        onChange={e => {
                            setSelectedBookId(
                                e.target.value
                            );

                            setSelectedFiles([]);
                            setUploadQueue([]);
                        }}
                    >
                        <option value="">
                            {loading
                                ? "讀取教材中..."
                                : "請選擇教材..."}
                        </option>

                        {books.map(book => (
                            <option
                                key={book.id}
                                value={book.id}
                            >
                                {book.name} · {book.code}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        className="quick-add-book-button"
                        onClick={() =>
                            setShowNewBook(
                                prev => !prev
                            )
                        }
                        disabled={uploading}
                    >
                        {showNewBook
                            ? "− 關閉新增教材"
                            : "＋ 找不到教材？新增一本"}
                    </button>

                    {showNewBook && (
                        <div className="quick-new-book">
                            <div className="quick-new-book-header">
                                <div>
                                    <span className="step-number">
                                        NEW
                                    </span>

                                    <h3>
                                        快速建立新教材
                                    </h3>
                                </div>

                                <p>
                                    建立後會自動選取，可以馬上上傳。
                                </p>
                            </div>

                            <label className="field-label">
                                教材分類
                            </label>

                            <select
                                value={
                                    newBook.category_id
                                }
                                onChange={e =>
                                    setNewBook({
                                        ...newBook,
                                        category_id:
                                            e.target.value
                                    })
                                }
                            >
                                <option value="">
                                    請選擇分類...
                                </option>

                                {categories.map(
                                    category => (
                                        <option
                                            key={category.id}
                                            value={category.id}
                                        >
                                            {category.name}
                                        </option>
                                    )
                                )}
                            </select>

                            <label className="field-label">
                                教材名稱
                            </label>

                            <input
                                type="text"
                                placeholder="例如 Reading Lamp 4"
                                value={newBook.name}
                                onChange={e =>
                                    setNewBook({
                                        ...newBook,
                                        name: e.target.value
                                    })
                                }
                            />

                            <label className="field-label">
                                教材 Code
                            </label>

                            <input
                                type="text"
                                placeholder="例如 ReadingLamp_4"
                                value={newBook.code}
                                onChange={e =>
                                    setNewBook({
                                        ...newBook,
                                        code:
                                            e.target.value.replace(
                                                /\s+/g,
                                                "_"
                                            )
                                    })
                                }
                            />

                            <div className="code-tip">
                                建議使用英文、數字、底線，例如：
                                <code>
                                    ReadingLamp_4
                                </code>
                            </div>

                            <button
                                type="button"
                                className="create-book-button"
                                onClick={
                                    handleCreateBook
                                }
                                disabled={
                                    creatingBook
                                }
                            >
                                {creatingBook
                                    ? "建立教材中..."
                                    : "建立並選擇這本教材"}
                            </button>
                        </div>
                    )}

                    {selectedBook && (
                        <div className="selected-book-info">
                            <div>
                                <span>
                                    目前教材
                                </span>

                                <strong>
                                    {selectedBook.name}
                                </strong>
                            </div>

                            <code>
                                {selectedBook.code}
                            </code>
                        </div>
                    )}

                    <div className="card-header upload-header">
                        <div>
                            <span className="step-number">
                                02
                            </span>

                            <h2>上傳音檔</h2>
                        </div>
                    </div>

                    <div
                        className={`drop-zone ${dragActive
                            ? "active"
                            : ""
                            } ${!selectedBook
                                ? "disabled"
                                : ""
                            }`}
                        onDragOver={e => {
                            e.preventDefault();

                            if (
                                selectedBook &&
                                !uploading
                            ) {
                                setDragActive(true);
                            }
                        }}
                        onDragLeave={() =>
                            setDragActive(false)
                        }
                        onDrop={e => {
                            if (uploading) return;
                            handleDrop(e);
                        }}
                        onClick={() => {
                            if (
                                selectedBook &&
                                !uploading
                            ) {
                                fileInputRef.current
                                    ?.click();
                            }
                        }}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".mp3,audio/mpeg"
                            multiple
                            hidden
                            onChange={
                                handleFileInput
                            }
                        />

                        <div className="upload-icon">
                            ↑
                        </div>

                        <h3>
                            {dragActive
                                ? "放開即可加入"
                                : "把所有 MP3 拖進來"}
                        </h3>

                        <p>
                            原始檔名不用修改，系統會自動辨識
                        </p>

                        {selectedBook && (
                            <div className="filename-example">
                                支援：
                                <code>P22</code>、
                                <code>
                                    習作本2 P22
                                </code>、
                                <code>
                                    P8 Question
                                </code>、
                                <code>
                                    P8 Answer
                                </code>、
                                <code>
                                    Unit 1
                                </code>
                            </div>
                        )}
                    </div>

                    {selectedFiles.length > 0 && (
                        <div className="selected-file-section">
                            <div className="section-title-row">
                                <h3>
                                    準備上傳
                                    <span className="pending-count">
                                        {selectedFiles.length}
                                    </span>
                                </h3>

                                <button
                                    type="button"
                                    className="text-button"
                                    onClick={
                                        clearSelectedFiles
                                    }
                                    disabled={
                                        uploading
                                    }
                                >
                                    全部清除
                                </button>
                            </div>

                            <div className="selected-file-list">
                                {selectedFiles.map(
                                    item => (
                                        <div
                                            className={`selected-file ${item.valid
                                                ? ""
                                                : "invalid"
                                                }`}
                                            key={item.id}
                                        >
                                            <div className="file-icon">
                                                MP3
                                            </div>

                                            <div className="file-info">
                                                <strong>
                                                    {item.originalName}
                                                </strong>

                                                <span>
                                                    {item.valid
                                                        ? `辨識為 ${item.page
                                                        } · ${(
                                                            item.size /
                                                            1024 /
                                                            1024
                                                        ).toFixed(
                                                            2
                                                        )} MB`
                                                        : item.reason}
                                                </span>
                                            </div>

                                            <div
                                                className={`validation-badge ${item.valid
                                                    ? "valid"
                                                    : "invalid"
                                                    }`}
                                            >
                                                {item.valid
                                                    ? "已辨識"
                                                    : "無法辨識"}
                                            </div>

                                            <button
                                                type="button"
                                                className="remove-file"
                                                onClick={() =>
                                                    removeSelectedFile(
                                                        item.id
                                                    )
                                                }
                                                disabled={
                                                    uploading
                                                }
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>

                            <button
                                type="button"
                                className="upload-all-button"
                                onClick={
                                    handleUploadAll
                                }
                                disabled={
                                    uploading ||
                                    !selectedFiles.some(
                                        file =>
                                            file.valid
                                    )
                                }
                            >
                                {uploading
                                    ? `處理中... ${processingCount} 個等待`
                                    : `上傳 ${selectedFiles.filter(
                                        file =>
                                            file.valid
                                    ).length
                                    } 個音檔`}
                            </button>
                        </div>
                    )}

                    {selectedFiles.length === 0 &&
                        uploadQueue.length > 0 &&
                        !uploading &&
                        failedCount === 0 && (
                            <div className="all-uploaded-message">
                                ✓ 所有可上傳音檔都已處理完成
                            </div>
                        )}
                </section>

                <section className="admin-card status-panel">
                    <div className="card-header">
                        <div>
                            <span className="step-number">
                                03
                            </span>

                            <h2>處理狀態</h2>
                        </div>
                    </div>

                    {!uploadQueue.length ? (
                        <div className="empty-upload-state">
                            <div>✓</div>

                            <h3>
                                準備完成
                            </h3>

                            <p>
                                選教材、丟 MP3，剩下交給系統。
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="upload-summary">
                                <div className="summary-success">
                                    <span>
                                        成功
                                    </span>

                                    <strong>
                                        {successCount}
                                    </strong>
                                </div>

                                <div className="summary-skipped">
                                    <span>
                                        略過
                                    </span>

                                    <strong>
                                        {skippedCount}
                                    </strong>
                                </div>

                                <div className="summary-failed">
                                    <span>
                                        失敗
                                    </span>

                                    <strong>
                                        {failedCount}
                                    </strong>
                                </div>
                            </div>

                            {failedCount > 0 &&
                                !uploading && (
                                    <button
                                        type="button"
                                        className="retry-failed-button"
                                        onClick={
                                            handleRetryFailed
                                        }
                                    >
                                        ↻ 只重試 {failedCount} 個失敗音檔
                                    </button>
                                )}

                            <div className="upload-queue">
                                {uploadQueue.map(
                                    item => (
                                        <div
                                            className="queue-item"
                                            key={item.id}
                                        >
                                            <div
                                                className={`queue-status ${item.status
                                                    }`}
                                            >
                                                {item.status ===
                                                    "success"
                                                    ? "✓"
                                                    : item.status ===
                                                        "failed"
                                                        ? "!"
                                                        : item.status ===
                                                            "skipped"
                                                            ? "−"
                                                            : "••"}
                                            </div>

                                            <div>
                                                <strong>
                                                    {item.originalName}
                                                </strong>

                                                <span>
                                                    {item.message ||
                                                        "等待中"}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>

            {/* ========================= */}
            {/* Library */}
            {/* ========================= */}

            <section className="admin-card library-panel">
                <div className="library-header">
                    <div>
                        <span className="admin-eyebrow">
                            Library
                        </span>

                        <h2>
                            {selectedBook
                                ? `${selectedBook.name} 音檔`
                                : "教材音檔"}
                        </h2>
                    </div>

                    <input
                        type="text"
                        placeholder="搜尋 P22、Unit 1 或檔名..."
                        value={searchText}
                        onChange={e =>
                            setSearchText(
                                e.target.value
                            )
                        }
                        disabled={
                            !selectedBook
                        }
                    />
                </div>

                {!selectedBook ? (
                    <div className="library-empty">
                        先選擇一本教材。
                    </div>
                ) : filteredTracks.length ===
                    0 ? (
                    <div className="library-empty">
                        這本教材目前還沒有音檔。
                    </div>
                ) : (
                    <div className="track-grid">
                        {filteredTracks.map(
                            track => (
                                <div
                                    className="track-card"
                                    key={track.id}
                                >
                                    <div className="track-top">
                                        <span className="track-page">
                                            {track.page}
                                        </span>

                                        <span
                                            className={
                                                track.enabled
                                                    ? "track-enabled"
                                                    : "track-disabled"
                                            }
                                        >
                                            {track.enabled
                                                ? "顯示中"
                                                : "已隱藏"}
                                        </span>
                                    </div>

                                    <strong>
                                        {track.music_name}
                                    </strong>

                                    <span className="track-path">
                                        {track.audio_url}
                                    </span>

                                    {/* ⭐ Library 預設音量 50% */}
                                    <LibraryAudio
                                        src={getPublicUrl(
                                            track.audio_url
                                        )}
                                    />
                                </div>
                            )
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

export default AddMusic;
