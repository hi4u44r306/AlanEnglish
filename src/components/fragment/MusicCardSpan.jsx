// import React from 'react';
// import '../assets/scss/MusicCardSpan.scss';
// import { AiFillPlayCircle } from "react-icons/ai";

// function MusicCardSpan({ music }) {
//     return (
//         <div style={{ cursor: "pointer" }} className={"MusicCardSpan"}>
//             <div className={"d1"}>
//                 <img src={require("../assets/img/" + music.img)} alt="" />
//                 <div className="detail">
//                     <h4>{music.name}</h4>
//                 </div>
//             </div>
//             <div className="play">
//                 {/* <PlayArrow fontSize={"large"}/> */}
//                 <AiFillPlayCircle />
//             </div>
//         </div>
//     );
// }

// export default MusicCardSpan;

import React, { useEffect, useState } from 'react';
import '../assets/scss/MusicCardSpan.scss';
import { AiFillPlayCircle } from "react-icons/ai";
import { getStorage, ref, getDownloadURL } from "firebase/storage";

function MusicCardSpan({ music }) {
    const [imgURL, setImgURL] = useState("");
    const [audioURL, setAudioURL] = useState("");
    const storage = getStorage();

    // Fetch URLs from Firebase Storage
    useEffect(() => {
        const fetchURLs = async () => {
            try {
                // Reference to the audio in Firebase Storage
                const audioRef = ref(storage, `Music/${music.audio}`);
                const audioDownloadURL = await getDownloadURL(audioRef);
                setAudioURL(audioDownloadURL);
            } catch (error) {
                console.error("Error fetching file URLs from Firebase Storage:", error);
            }
        };

        fetchURLs();
    }, [music, storage]);

    return (
        <div style={{ cursor: "pointer" }} className={"MusicCardSpan"}>
            <div className={"d1"}>
                <img src={require("../assets/img/" + music.img)} alt="" />
                <div className="detail">
                    <h4>{music.name}</h4>
                </div>
            </div>
            <div className="play" onClick={() => audioURL && window.open(audioURL, "_blank")}>
                <AiFillPlayCircle />
            </div>
        </div>
    );
}

export default MusicCardSpan;

