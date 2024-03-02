import React from 'react';
import '../assets/scss/Playlist.scss';
import { useSelector } from "react-redux";
import MusicCard from "./MusicCard";
import { useParams } from 'react-router-dom';
// import Container from "./Container";
// import firebase from 'firebase/app';

const Playlist = () => {
    const { playlistId } = useParams();
    const { playlists } = useSelector(state => state.musicReducer);
    return (
        // <Container>
        <div className={"Playlist"}>
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