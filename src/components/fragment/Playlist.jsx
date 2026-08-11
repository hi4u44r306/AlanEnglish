import React, { useEffect, useState } from 'react';
import '../assets/scss/Playlist.scss';
import MusicCard from "./MusicCard";
import { useParams } from 'react-router-dom';
import { supabase } from "../Pages/supabase-config";

const Playlist = () => {

    const { playlistId } = useParams();

    const [tracks, setTracks] = useState([]);
    const [bookName, setBookName] = useState('');
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {

        const fetchPlaylist = async () => {

            try {

                setLoading(true);
                setErrorMessage('');

                console.log("目前 playlistId:", playlistId);

                // =========================
                // 1. 先透過 code 找 books
                // =========================

                const { data: bookData, error: bookError } = await supabase
                    .from('books')
                    .select('id, name, code')
                    .eq('code', playlistId)
                    .single();

                if (bookError) {

                    console.error(
                        '讀取 books 發生錯誤:',
                        bookError
                    );

                    setErrorMessage(
                        '找不到這本教材'
                    );

                    setLoading(false);

                    return;
                }

                console.log(
                    '找到的教材:',
                    bookData
                );

                setBookName(bookData.name);

                // =========================
                // 2. 用 book_id 找音檔
                // =========================

                const { data: trackData, error: trackError } = await supabase
                    .from('music_tracks')
                    .select('*')
                    .eq('book_id', bookData.id)
                    .eq('enabled', true)
                    .order('sort_order', {
                        ascending: true
                    });

                if (trackError) {

                    console.error(
                        '讀取 music_tracks 發生錯誤:',
                        trackError
                    );

                    setErrorMessage(
                        '讀取音檔資料失敗'
                    );

                    setLoading(false);

                    return;
                }

                console.log(
                    'Supabase 音檔資料:',
                    trackData
                );

                // =========================
                // 3. Storage path
                //    → Public URL
                // =========================

                const convertedTracks =
                    (trackData || []).map((track) => {

                        const {
                            data: publicUrlData
                        } = supabase.storage
                            .from('music')
                            .getPublicUrl(
                                track.audio_url
                            );

                        return {

                            // 新 SQL 欄位
                            id: track.id,
                            book_id: track.book_id,
                            page: track.page,
                            title: track.title,
                            sort_order: track.sort_order,

                            // 舊 MusicCard 可能還會使用
                            // 這些名稱，所以先相容舊程式
                            bookname: bookData.name,
                            type: playlistId,

                            musicName:
                                track.music_name,

                            audioURL:
                                publicUrlData.publicUrl,

                            audio_url:
                                publicUrlData.publicUrl,

                            image:
                                track.image
                        };
                    });

                console.log(
                    '轉換後 Playlist:',
                    convertedTracks
                );

                setTracks(convertedTracks);

            } catch (error) {

                console.error(
                    'Playlist 發生未知錯誤:',
                    error
                );

                setErrorMessage(
                    '載入教材時發生錯誤'
                );

            } finally {

                setLoading(false);

            }

        };

        if (playlistId) {
            fetchPlaylist();
        }

    }, [playlistId]);


    // =========================
    // Loading
    // =========================

    if (loading) {

        return (
            <div className="Playlist">

                <div className="playlisttitle">
                    載入中...
                </div>

            </div>
        );

    }


    // =========================
    // Error
    // =========================

    if (errorMessage) {

        return (
            <div className="Playlist">

                <div className="playlisttitle">
                    {errorMessage}
                </div>

            </div>
        );

    }


    // =========================
    // 正常畫面
    // =========================

    return (

        <div className="Playlist">

            <div className="playlisttitle">

                {bookName || playlistId}

            </div>


            <div className="Playlist-container">

                {
                    tracks.length > 0 ?

                        tracks.map((item) => (

                            <MusicCard
                                key={item.id}
                                music={item}
                            />

                        ))

                        :

                        <div>
                            目前沒有音檔
                        </div>
                }

            </div>

        </div>

    );

};

export default Playlist;