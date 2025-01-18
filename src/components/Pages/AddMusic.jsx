import React, { useState, useEffect } from "react";
import { ref as storageref, uploadBytesResumable, listAll, getDownloadURL, uploadBytes } from "firebase/storage";
import { child, get, ref as rtdbref, set, update } from "firebase/database";
import { rtdb, getstorage } from "./firebase-config";

const AddMusic = () => {
    const [folders, setFolders] = useState([]);
    const [currentFolder, setCurrentFolder] = useState("");
    const [files, setFiles] = useState([]);
    const [uploadingFiles, setUploadingFiles] = useState([]); // Track upload progress
    const [newFolderName, setNewFolderName] = useState("");

    useEffect(() => {
        fetchFolders();
    }, []);

    const fetchFolders = async () => {
        const rootRef = storageref(getstorage, "Music/");
        const res = await listAll(rootRef);
        setFolders(res.prefixes.map((folder) => folder.name));
    };

    const fetchFiles = async () => {
        if (!currentFolder) return;
        const folderRef = storageref(getstorage, currentFolder);
        const res = await listAll(folderRef);
        const urls = await Promise.all(
            res.items.map((item) =>
                getDownloadURL(item).then((url) => ({ name: item.name, url }))
            )
        );
        setFiles(urls);
    };

    const handleDrop = async (e) => {
        e.preventDefault();

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (!droppedFiles.length || !currentFolder) {
            return;
        }

        const regex = /^(.*) (P\d+)\.mp3$/;

        for (const file of droppedFiles) {
            const match = file.name.match(regex);
            if (!match) {
                console.error(`File name "${file.name}" does not match the required pattern.`);
                continue;
            }

            const [, bookName, page] = match;
            const type = bookName;
            const musicName = `${bookName}/${file.name}`;

            const initialData = {
                bookname: bookName,
                page: page,
                type: type,
                musicName: musicName,
            };

            const uploadTask = uploadBytesResumable(
                storageref(getstorage, `Music/${currentFolder}/${file.name}`),
                file
            );

            setUploadingFiles((prev) => [
                ...prev,
                { name: file.name, progress: 0 },
            ]);

            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    const progress = Math.round(
                        (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    );

                    setUploadingFiles((prev) =>
                        prev.map((upload) =>
                            upload.name === file.name
                                ? { ...upload, progress }
                                : upload
                        )
                    );
                },
                (error) => {
                    console.error(`Error uploading file "${file.name}":`, error);
                },
                async () => {
                    // On complete
                    const dbRef = rtdbref(rtdb, `Music/${currentFolder}/`);
                    const snapshot = await get(dbRef);
                    const data = snapshot.val();
                    const maxId = Object.keys(data || {}).reduce((max, key) => Math.max(max, Number(key)), 0);

                    const newId = maxId + 1;
                    const newRef = child(dbRef, newId.toString());
                    await update(newRef, { ...initialData });

                    setUploadingFiles((prev) =>
                        prev.filter((upload) => upload.name !== file.name)
                    );
                    fetchFiles(); // Refresh files
                }
            );
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleCreateFolder = async () => {
        if (newFolderName.trim()) {
            if (window.confirm("Are you sure you want to add this dropdown?")) {
                const newDropdownRef = rtdbref(rtdb, `Music/${newFolderName}`);
                await set(newDropdownRef, "");

                const dummyFileRef = storageref(getstorage, `Music/${newFolderName}/.keep`);
                await uploadBytes(dummyFileRef, new Blob([]));

                setNewFolderName("");
                fetchFolders();
                alert("Dropdown added successfully.");
            }
        }
    };

    return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "50px auto", textAlign: "center" }}>
            <h5>音樂上傳與播放</h5>

            {/* Folder Selection */}
            <div>
                <h6>選擇資料夾</h6>
                <select
                    onChange={(e) => {
                        setCurrentFolder(e.target.value);
                        setFiles([]);
                    }}
                    value={currentFolder}
                >
                    <option value="">請選擇資料夾</option>
                    {folders.map((folder, index) => (
                        <option key={index} value={folder}>
                            {folder}
                        </option>
                    ))}
                </select>
                <div style={{ marginTop: "10px" }}>
                    <input
                        type="text"
                        placeholder="新資料夾名稱"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                    />
                    <button onClick={handleCreateFolder}>創建資料夾</button>
                </div>
            </div>

            {/* Drag-and-Drop Area */}
            {currentFolder && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    style={{
                        padding: "20px",
                        border: "2px dashed #ccc",
                        borderRadius: "10px",
                        marginTop: "20px",
                    }}
                >
                    <p>將檔案拖曳到此處上傳到「{currentFolder}」資料夾。</p>
                    {uploadingFiles.map((upload, index) => (
                        <div key={index} style={{ marginTop: "10px", textAlign: "left" }}>
                            <p>{upload.name}</p>
                            <div style={{ background: "#f3f3f3", borderRadius: "5px", overflow: "hidden" }}>
                                <div
                                    style={{
                                        width: `${upload.progress}%`,
                                        background: "#4caf50",
                                        height: "10px",
                                    }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* File List */}
            <ul style={{ marginTop: "20px" }}>
                {files.map((file, index) => (
                    <li key={index}>
                        <p>{file.name}</p>
                        <audio controls src={file.url} style={{ width: "100%" }} />
                    </li>
                ))}
            </ul>

            {/* Refresh Files */}
            {currentFolder && (
                <button style={{ marginTop: "20px" }} onClick={fetchFiles}>
                    加載 {currentFolder} 中的檔案
                </button>
            )}
        </div>
    );
};

export default AddMusic;
