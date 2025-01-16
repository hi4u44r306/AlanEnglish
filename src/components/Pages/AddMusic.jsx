import React, { useState, useEffect } from "react";
import { ref as storageref, uploadBytes, listAll, getDownloadURL } from "firebase/storage";
import { child, get, ref as rtdbref, update } from "firebase/database";
import { rtdb, getstorage } from "./firebase-config";

const AddMusic = () => {
    const [folders, setFolders] = useState([]);
    const [currentFolder, setCurrentFolder] = useState("");
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
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
        setUploading(true);

        const file = e.dataTransfer.files[0];
        if (file && currentFolder) {
            const storageRef = storageref(getstorage, `Music/${currentFolder}/${file.name}`);
            await uploadBytes(storageRef, file);
            fetchFiles();

        }
        setUploading(false);

        const regex = /^(.*) (P\d+)\.mp3$/;
        const match = file.name.match(regex);

        if (!match) {
            return null; // 或拋出錯誤
        }

        const [, bookName, page] = match;
        const type = bookName; // 假設type與bookName相同
        const musicName = `${bookName}/${file.name}`;


        // 構造要寫入 Firebase 的資料
        const initialData = {
            bookname: bookName,
            page: page,
            type: type,
            musicName: musicName,
        };

        // 合併資料
        const finalData = {
            ...initialData,
        };
        // 寫入 Firebase
        const dbRef = rtdbref(rtdb, `Music/${currentFolder}/`);

        async function addNewSubcollection(finalData) {
            try {
                const snapshot = await get(dbRef);
                const data = snapshot.val();

                // 計算子集合數量
                const childCount = Object.keys(data || {}).length;
                console.log('習作本1 總共有', childCount, '個子集合');

                // 找到最大的 ID
                let maxId = 0;
                for (const key in data) {
                    if (Number(key) > maxId) {
                        maxId = Number(key);
                    }
                }

                // 新增子集合 (假設 finalData 已經準備好)
                const newId = maxId + 1;
                console.log(newId);

                // 設定新的子集合
                const newRef = child(dbRef, newId.toString());
                await update(newRef, finalData);
                console.log('資料已成功新增');
            } catch (error) {
                console.error('錯誤發生:', error);
            }
        }

        addNewSubcollection(finalData);


    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleCreateFolder = async () => {
        if (newFolderName.trim()) {
            const dummyFileRef = storageref(getstorage, `${newFolderName}/.keep`);
            await uploadBytes(dummyFileRef, new Blob([])); // 創建一個空檔案以初始化資料夾
            setNewFolderName("");
            fetchFolders();


        }

    };

    return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "50px auto", textAlign: "center" }}>
            <h5>音樂上傳與播放</h5>

            {/* 資料夾選擇或創建 */}
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

            {/* 拖曳區 */}
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
                    {uploading && <p>上傳中...</p>}
                </div>
            )}

            {/* 檔案列表 */}
            <ul style={{ marginTop: "20px" }}>
                {files.map((file, index) => (
                    <li key={index}>
                        <p>{file.name}</p>
                        <audio controls src={file.url} style={{ width: "100%" }} />
                    </li>
                ))}
            </ul>

            {/* 加載資料夾檔案 */}
            {currentFolder && (
                <button style={{ marginTop: "20px" }} onClick={fetchFiles}>
                    加載 {currentFolder} 中的檔案
                </button>
            )}
        </div>
    );
};

export default AddMusic;
