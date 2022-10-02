import React, { useEffect, useState} from "react";
import './css/Home.scss';
import Navigation from "../fragment/Navigation";
import NavigationMobile from "../fragment/NavigationMobile";
import FooterMusicPlayer from "../fragment/FooterMusicPlayer";
import MusicCardContainer from "../fragment/MusicCardContainer";
import {useSelector} from "react-redux";
import CurrentPlayingLarge from "../fragment/CurrentPlayingLarge";
import Search from "./Search";
import About from "./About";
import Playlist from "../fragment/Playlist";
import {Skeleton} from "@material-ui/lab";
import Contact from "./Contact";
import UserInfo from "./UserInfo";
import FooterEmpty from "../fragment/FooterEmpty";
import AddMusic from "./AddMusic";
function getCurrPage(pathName) {
    switch (pathName) {
        case "/home":
            return <Playlist/>
        case "/home/search":
            return <Search/>
        case "/home/about":
            return <About/>
        case "/home/contact":
            return <Contact/>
        case "/home/userinfo":
            return <UserInfo/>
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

    const [screenSize, setScreenSize] = useState(true);
    const [currMusic, setCurrMusic] = useState(null);
    const [Page, setCurrPage] = useState(<MusicCardContainer/>);

    window.addEventListener("resize", handleResize);

    function handleResize() {
        setScreenSize(window.innerWidth);
    }

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
                    <>
                        {
                            screenSize <= 1200 
                                ?
                                <NavigationMobile/> 
                                :
                                <Navigation/>
                        }
                        <section className={"home-music-container"}>
                            <div className="main-home">
                                {
                                    Page
                                }
                            </div>
                        </section>
                        <section className={"copyright-container"}>
                            <div className="copyright">© 2022 AlanEnglish Inc.</div>
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
                    </>  
            }
        </div>
    );
}

export default Home;