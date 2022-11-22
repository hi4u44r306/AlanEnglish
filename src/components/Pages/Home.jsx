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
import firebase from "./firebase";
import Redirectpage from "../fragment/Redirectpage";

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
    const [auth, setAuth] = useState(false);

    firebase.auth().onAuthStateChanged((user) => {
        if(user) {
          // 使用者已登入，可以取得資料
          setAuth(true)
        } else {
          // 使用者未登入
          setAuth(false)
        }
      });

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


    if(!auth) return <Redirectpage/>
    // if(!auth) return null
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
                                <div className="main-home-copyright">
                                    <Copyright/>
                                </div>
                            </div>
                        </section>
                        <section className={"home-musicplayer"}>
                            <React.Fragment>
                                {
                                    currMusic
                                    ?
                                    <FooterMusicPlayer music={currMusic}/>
                                    :
                                    <FooterEmpty/>
                                }
                            </React.Fragment> 
                        </section>
                        {
                            bannerOpen
                            &&
                            <section className="current-large-banner">
                                <CurrentPlayingLarge/>
                            </section>
                        }
                    </div>  
            }
        </div>
    );
}

export default Home;