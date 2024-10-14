import React, { useEffect, useState } from 'react';
import '../assets/scss/Playlist.scss';
import { useSelector } from "react-redux";
import MusicCard from "./MusicCard";
import { useParams } from 'react-router-dom';
import { child, get, ref, update } from 'firebase/database';
import { rtdb } from '../Pages/firebase-config';
// import CountdownTimer from './CountdownTimer';
// import Container from "./Container";
// import firebase from 'firebase/app';

const Playlist = () => {
    const { playlistId } = useParams();
    const { playlists } = useSelector(state => state.musicReducer);
    const [totalTracks, setTotalTracks] = useState(0);
    const [completedTracks, setCompletedTracks] = useState(0);
    const useruid = localStorage.getItem('ae-useruid');

    useEffect(() => {
        // 計算類別中的音軌總數
        const filteredTracks = playlists.filter(item => item.type === playlistId);
        setTotalTracks(filteredTracks.length);

        // 從 Firebase 獲取通過的音軌數量
        async function fetchCompletedTracks() {
            let count = 0;
            const dbRef = ref(rtdb);

            // 收集每首音軌的完成狀態
            for (const track of filteredTracks) {
                const convertmusicName = `${track.bookname} ${track.page}`;
                const completeRef = child(dbRef, `student/${useruid}/MusicLogfile/${convertmusicName}/complete`);

                try {
                    const snapshot = await get(completeRef);
                    if (snapshot.exists() && snapshot.val() === '通過') {
                        count += 1;
                    }
                } catch (error) {
                    console.error("Error fetching complete value:", error);
                }
            }

            setCompletedTracks(count);

            // 計算通過比例
            const passRate = filteredTracks.length > 0 ? (count / filteredTracks.length) * 100 : 0;

            // 更新 Firebase 中書籍的通過比例
            const bookRef = ref(rtdb, `student/${useruid}/BookLogfile/${playlistId}`);
            try {
                await update(bookRef, { passRate: passRate.toFixed(1) });
            } catch (error) {
                console.error("Error updating pass rate:", error);
            }
        }

        fetchCompletedTracks();
    }, [playlistId, playlists, useruid]);


    // 計算通過的百分比
    const completionPercentage = totalTracks > 0 ? (completedTracks / totalTracks) * 100 : 0;

    return (
        // <Container>
        <div className={"Playlist"}>

            {/* <div className='newfunctionalert'>
                <Marquee
                    direction='right'
                    speed={20}
                    style={{
                        height: '40px',
                        alignItems: 'center'
                    }}
                >

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                    }}>
                        音軌聽力次數達到每聽 "7次" 就能獲得一個 <FcApproval size={20} /> 喔!!
                    </div>
                </Marquee>
            </div> */}
            <div className='playlisttitle'>
                {playlistId}
            </div>
            {/* Progress bar */}
            <div className="progress-bar">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${completionPercentage}%` }}
                />
            </div>
            <div className="progress-info">
                已通過 {completedTracks} 首 / 總共 {totalTracks} 首 ({completionPercentage.toFixed(1)}%)
            </div>
            <div className="Playlist-container">
                {
                    playlists.map((item) => (
                        item.type === playlistId &&
                        <MusicCard key={item.musicName} music={item} />
                    ))
                }
            </div>
        </div>
        // </Container>
    );
}

export default Playlist;