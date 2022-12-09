import React, { useState } from 'react';
import '../assets/scss/Playlist.scss';
import {useSelector} from "react-redux";
import MusicCard from "./MusicCard";
import Container from "./Container";
import firebase from 'firebase/app';

const Playlist = () => {
    const [totaltimeplayed, setTotal] = useState();
    const typeOfPlaylist = window.location.pathname.substring(15);
    const {playlists} = useSelector(state=>state.musicReducer);
    const dbRef = firebase.database().ref();
    var userId = firebase.auth().currentUser.uid;
    dbRef.child("student").child(userId).child("totaltimeplayed").get().then((snapshot) => {
        setTotal(snapshot.val());
    }).catch((error) => {
        console.error(error);
    });
    return (
        <Container>
            <div className={"Playlist"}>
                <div className='playlisttitle'> {typeOfPlaylist} </div>
                <div className='totaltimeplayed'>總聽力次數 : {totaltimeplayed || '---'} 次</div>
                <div className="Playlist-container">
                    {
                        playlists.map((item)=>(
                            item.type === typeOfPlaylist &&
                            <MusicCard key={item.musicName} music={item}/>
                        ))
                    }
                </div>
            </div>
        </Container>
    );
}

export default Playlist;