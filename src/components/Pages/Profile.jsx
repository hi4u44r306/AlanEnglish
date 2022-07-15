import React, {useEffect, useState} from 'react';
import './css/Profile.scss';
// import {Avatar} from "@material-ui/core";
import {useSelector} from "react-redux";
import MusicCard from "../fragment/MusicCard";
import Container from "../fragment/Container";
import Grade from 'grade-js';
import SideBarOptions from "../fragment/SideBarOptions";
import {PlaylistPlay} from "@material-ui/icons";

function Profile() {

    const {playlists} = useSelector(state => state.musicReducer);
    const [mostPlayed, setMostPlayed] = useState([]);

    function sortByProperty(property) {
        return function (a, b) {
            if (a[property] > b[property])
                return 1;
            else if (a[property] < b[property])
                return -1;

            return 0;
        }
    }

    useEffect(() => {
        setMostPlayed(playlists.sort(sortByProperty("timesPlayed")));
    }, [playlists]);

    useEffect(() => {
        Grade(document.querySelectorAll('.gradient-wrap'))
    });

    return (
        <Container>
            <div className={"Profile"}>
                <div className="top-profile">
                    <div className="profile-detail">
                        <span className={"profile-playlist"}>
                            <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay}
                                            href={"/home/playlist/1"} title={"習作本1"}/>
                            <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay} 
                                            href={"/home/playlist/2"} title={"習作本2"}/>
                            <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay}
                                            href={"/home/playlist/3"} title={"習作本3"}/>
                            <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay} 
                                            href={"/home/playlist/4"} title={"習作本4"}/>
                            <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay}
                                            href={"/home/playlist/5"} title={"習作本5"}/>
                            <SideBarOptions className={"lib-sub"} Icon={PlaylistPlay} 
                                            href={"/home/playlist/6"} title={"習作本6"}/>
                        </span>
                    </div>
                </div>
                <div className="bottom-profile">
                    <div>
                        <h3>Most Played</h3>
                        <div className="most-played">
                            {
                                mostPlayed.map((item, index) => (
                                    index <= 4 && <MusicCard key={item.id} music={item}/>
                                ))
                            }
                        </div>
                    </div>

                </div>
            </div>
        </Container>
    );
}

export default Profile;
