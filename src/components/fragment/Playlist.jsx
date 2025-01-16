import React, { useEffect } from 'react';
import '../assets/scss/Playlist.scss';
import MusicCard from "./MusicCard";
import { useParams } from 'react-router-dom';

const Playlist = () => {
    const { playlistId } = useParams();
    // const [totalTracks, setTotalTracks] = useState(0);
    // const [completedTracks, setCompletedTracks] = useState(0);
    const useruid = localStorage.getItem('ae-useruid');
    const playlists = JSON.parse(localStorage.getItem('ae-playlistData'));



    useEffect(() => {

        // const allTracks = Object.keys(playlists).reduce((acc, workbook) => {
        //     return acc.concat(playlists[playlistId].map(track => ({ ...track, workbook })));
        // }, []);
        // const filteredTracks = allTracks.filter(item => item.type === playlistId);
        // // 計算類別中的音軌總數
        // setTotalTracks(filteredTracks.length);

        // 從 Firebase 獲取通過的音軌數量
        // async function fetchCompletedTracks() {
        //     let count = 0;
        //     const dbRef = ref(rtdb);

        //     // 收集每首音軌的完成狀態
        //     for (const track of filteredTracks) {
        //         const convertmusicName = `${track.bookname} ${track.page}`;
        //         const completeRef = child(dbRef, `student/${useruid}/MusicLogfile/${convertmusicName}/complete`);

        //         try {
        //             const snapshot = await get(completeRef);
        //             if (snapshot.exists() && snapshot.val() === '通過') {
        //                 count += 1;
        //             }
        //         } catch (error) {
        //             console.error("Error fetching complete value:", error);
        //         }
        //     }

        //     setCompletedTracks(count);

        //     // 計算通過比例
        //     const passRate = filteredTracks.length > 0 ? (count / filteredTracks.length) * 100 : 0;

        //     // 更新 Firebase 中書籍的通過比例
        //     const bookRef = ref(rtdb, `student/${useruid}/BookLogfile/${playlistId}`);
        //     try {
        //         await update(bookRef, {
        //             passRate: Math.round(passRate)
        //         });
        //     } catch (error) {
        //         console.error("Error updating pass rate:", error);
        //     }
        // }

        // fetchCompletedTracks();
    }, [playlistId, useruid]);

    // 計算通過的百分比
    // const completionPercentage = totalTracks > 0 ? (completedTracks / totalTracks) * 100 : 0;

    const extractPageNumber = (page) => {
        if (!page || typeof page !== 'string') {
            return 0; // 預設值：若 page 無效
        }
        if (page.startsWith('P')) {
            return parseInt(page.replace('P', ''), 10); // 處理 "P" 開頭
        } else if (page.startsWith('Unit')) {
            return parseInt(page.replace('Unit', ''), 10); // 處理 "Unit" 開頭
        }
        return 0; // 預設值：若格式無法識別
    };
    const sortedPlaylists = Object.values(playlists) // Get all values of the playlists object
        .flat() // Flatten the array if playlists contains arrays of tracks
        .filter(item => item.type === playlistId) // Filter out invalid data
        .sort((a, b) => {
            const pageA = extractPageNumber(a.page);
            const pageB = extractPageNumber(b.page);
            return pageA - pageB;
        });



    return (
        // <Container>
        <div className={"Playlist"}>
            <div className='playlisttitle'>
                {playlistId}
            </div>
            {/* Progress bar */}
            {/* <div className="progress-bar">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${completionPercentage}%` }}
                />
            </div> */}
            {/* <div className="progress-info">
                已通過 {completedTracks} 首 / 總共 {totalTracks} 首 ({Math.round(completionPercentage)}%)
            </div> */}
            <div className="Playlist-container">
                {
                    sortedPlaylists
                        .filter(item => item.type === playlistId)
                        .map(item => (
                            <MusicCard key={item.musicName} music={item} />
                        ))
                }
            </div>

        </div>
        // </Container>
    );
}

export default Playlist;