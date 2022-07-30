import React, {useContext, useEffect, useState} from "react";
import './css/Home.scss';
import Navigation from "../fragment/Navigation";
import FooterMusicPlayer from "../fragment/FooterMusicPlayer";
import MusicCardContainer from "../fragment/MusicCardContainer";
import {useSelector} from "react-redux";
import {ThemeContext} from "../../api/Theme";
import Profile from "./Profile";
import AddMusic from "../fragment/AddMusic";
import FooterSelectMusic from "../fragment/FooterSelectMusic";
import CurrentPlayingLarge from "../fragment/CurrentPlayingLarge";
import Search from "./Search";
import About from "./About";
import Playlist from "../fragment/Playlist";
import {Skeleton} from "@material-ui/lab";

function getCurrPage(pathName) {
    switch (pathName) {
        case "/home":
            return <MusicCardContainer/>
        case "/home/search":
            return <Search/>
        case "/home/profile":
            return <Profile/>
        case "/home/add":
            return <AddMusic/>
        case "/home/about":
            return <About/>
        default:
            if (pathName.startsWith("/home/playlist/")) {
                return <Playlist/>
            }
            return null
    }
}

function Home() {


    const [screenSize, setScreenSize] = useState(undefined);
    const [currMusic, setCurrMusic] = useState(null);
    const [Page, setCurrPage] = useState(<MusicCardContainer/>);

    let pathname = window.location.pathname;
    useEffect(() => {
        setCurrPage(getCurrPage(pathname))
    }, [pathname]);

    window.addEventListener("resize", handleResize);

    function handleResize() {
        setScreenSize(window.innerWidth);
    }

    useEffect(() => {
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    });

    const useStyle = useContext(ThemeContext);
    const {playing, bannerOpen} = useSelector(state => state.musicReducer);


    useEffect(() => {
        setCurrMusic(playing)
    }, [playing])

    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        setLoaded(true)
    }, []);


    return (
        <div style={useStyle.component} className={"home-container"}>
            {
                !loaded ?
                    <div className="Home-skeleton">
                        <Skeleton animation={"wave"} variant={"rect"} height={"100vh"}/>
                    </div>
                    :
                    <>
                        <Navigation/>
                        <section className={"home-music-container"}>
                            
                            <div className="main-home">
                                {
                                    Page
                                }
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
                                    <FooterSelectMusic/>
                            }
                        </React.Fragment>
                    </>
            }
        </div>
    );
}

export default Home;