import React from 'react';
import '../assets/scss/Playlist.scss';
import { useSelector } from "react-redux";
import MusicCard from "./MusicCard";
import { useParams } from 'react-router-dom';
import Marquee from 'react-fast-marquee';
// import Container from "./Container";
// import firebase from 'firebase/app';

const Playlist = () => {
    const { playlistId } = useParams();
    const { playlists } = useSelector(state => state.musicReducer);

    return (
        // <Container>
        <div className={"Playlist"}>

            <div className='newfunctionalert'>
                <Marquee
                    direction='right'
                    speed={30}
                    style={{
                        height: '40px',
                        alignItems: 'center'
                    }}
                >
                    新功能已上線  音軌播放次數要達到 "7次以上" 才算通過
                </Marquee>
            </div>
            <div className='playlisttitle'>
                {playlistId}
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