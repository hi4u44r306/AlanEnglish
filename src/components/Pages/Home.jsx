import React, { useEffect, useState} from "react";
import './css/Home.scss';
import NavigationMobile from "../fragment/NavigationMobile";
import FooterMusicPlayer from "../fragment/FooterMusicPlayer";
import MusicCardContainer from "../fragment/MusicCardContainer";
import {useSelector} from "react-redux";
import CurrentPlayingLarge from "../fragment/CurrentPlayingLarge";
import Search from "./Search";
import Playlist from "../fragment/Playlist";
import {Skeleton} from "@material-ui/lab";
import FooterEmpty from "../fragment/FooterEmpty";
import AddMusic from "./AddMusic";
import Copyright from "../fragment/Copyright";
function getCurrPage(pathName) {
    switch (pathName) {
        case "/home":
            return <Playlist/>
        case "/home/search":
            return <Search/>
        case "/home/addmusic":
            return <AddMusic/>
        default:
            if (pathName.startsWith("/home/playlist/")) {
                return <Playlist/>
            }
            return null
    }
}

function Home() {

    const [currMusic, setCurrMusic] = useState(null);
    const [Page, setCurrPage] = useState(<MusicCardContainer/>);

    let pathname = window.location.pathname;
    useEffect(() => {
        setCurrPage(getCurrPage(pathname))
    }, [pathname]);

    const {playing, bannerOpen} = useSelector(state => state.musicReducer);

    useEffect(() => {
        setCurrMusic(playing)
    }, [playing])

    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        setLoaded(true)
    }, []);


    return (
        <div className={"home-container"}>
            {
                !loaded ?
                    <div className="Home-skeleton">
                        <Skeleton variant={"rect"} height={"100vh"}/>
                    </div>
                    :
                    <div>
                        <NavigationMobile/>
                        <section className={"home-music-container"}>
                            <div className="main-home">
                                {
                                    Page
                                }
                                <Copyright/>
                                {/* <div className={"copyright"}>© 2022 AlanEnglish Inc.</div> */}
                            </div>
                        </section>
                        {
                            bannerOpen
                            &&
                            <section className="current-large-banner">
                                <CurrentPlayingLarge/>
                            </section>
                        }
                        <React.Fragment>
                            {
                                currMusic
                                ?
                                <FooterMusicPlayer music={currMusic}/>
                                :
                                <FooterEmpty/>
                            }
                        </React.Fragment> 
                    </div>  
            }
        </div>
    );
}

export default Home;