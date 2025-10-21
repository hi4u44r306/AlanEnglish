import React, { useEffect, useState } from "react";
import "./css/ABC.scss";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { getstorage } from "././firebase-config";

const ABC = () => {
    const [mediaFiles, setMediaFiles] = useState([]);
    const [selectedMedia, setSelectedMedia] = useState(null);

    useEffect(() => {

        const mediaRef = ref(getstorage, "Media");

        listAll(mediaRef)
            .then(async (res) => {
                const urls = await Promise.all(
                    res.items.map(async (itemRef) => {
                        const url = await getDownloadURL(itemRef);
                        const name = itemRef.name.toLowerCase();
                        const isVideo = name.endsWith(".mp4") || name.endsWith(".mov") || name.endsWith(".webm");
                        return { url, isVideo };
                    })
                );
                setMediaFiles(urls);
            })
            .catch((error) => {
                console.error("Error fetching media:", error);
            });
    }, []);

    return (
        <div className="gallery-container">
            <h2 className="gallery-title">媒體相簿</h2>

            <div className="gallery-grid">
                {mediaFiles.map((file, index) => (
                    <div
                        className="gallery-item"
                        key={index}
                        onClick={() => setSelectedMedia(file)}
                    >
                        {file.isVideo ? (
                            <video src={file.url} className="gallery-thumbnail" />
                        ) : (
                            <img src={file.url} alt="media" className="gallery-thumbnail" />
                        )}
                    </div>
                ))}
            </div>

            {selectedMedia && (
                <div className="gallery-modal" onClick={() => setSelectedMedia(null)}>
                    <div className="gallery-modal-content" onClick={(e) => e.stopPropagation()}>
                        {selectedMedia.isVideo ? (
                            <video src={selectedMedia.url} controls autoPlay />
                        ) : (
                            <img src={selectedMedia.url} alt="media" />
                        )}
                        <button className="close-btn" onClick={() => setSelectedMedia(null)}>✕</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ABC;
