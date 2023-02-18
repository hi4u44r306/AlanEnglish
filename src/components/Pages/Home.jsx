import React, { useEffect, useState } from "react";
import './css/Home.scss';
import NavigationMobile from "../fragment/NavigationMobile";
import FooterMusicPlayer from "../fragment/FooterMusicPlayer";
import MusicCardContainer from "../fragment/MusicCardContainer";
import { useSelector } from "react-redux";
import CurrentPlayingLarge from "../fragment/CurrentPlayingLarge";
import Search from "./Search";
import Playlist from "../fragment/Playlist";
import { Skeleton } from "@material-ui/lab";
import FooterEmpty from "../fragment/FooterEmpty";
import AddMusic from "./AddMusic";
import Copyright from "../fragment/Copyright";
import firebase from "./firebase";
import { toast, ToastContainer } from "react-toastify"

function getCurrPage(pathName) {
    switch (pathName) {
        case "/home":
            return <Playlist />
        case "/home/search":
            return <Search />
        case "/home/addmusic":
            return <AddMusic />
        default:
            if (pathName.startsWith("/home/playlist/")) {
                return <Playlist />
            }
            return null
    }
}

function Home() {

    const [currMusic, setCurrMusic] = useState(null);
    const [Page, setCurrPage] = useState(<MusicCardContainer />);


    const error = () => {
        toast.error('尚未登入', {
            className: "notification",
            position: "top-center",
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
        });
        setTimeout(() => {
            window.location.href = '/'
        }, 1200);
    };

    useEffect(() => {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {

            } else {
                error();
            }
        });
    }, [])


    let pathname = window.location.pathname;
    useEffect(() => {
        setCurrPage(getCurrPage(pathname))
    }, [pathname]);


    const { playing, bannerOpen } = useSelector(state => state.musicReducer);

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
                        <Skeleton variant={"rect"} height={"100vh"} />
                    </div>
                    :
                    <div>

                        <NavigationMobile />
                        <section className={"home-music-container"}>
                            <ToastContainer
                                position="top-center"
                                autoClose={2000}
                                hideProgressBar={false}
                                newestOnTop={false}
                                closeOnClick
                                rtl={false}
                                pauseOnFocusLoss
                                draggable
                                pauseOnHover
                            />
                            <div className="main-home">
                                {
                                    Page
                                }
                                <div className="main-home-copyright">
                                    <Copyright />
                                </div>
                            </div>
                        </section>
                        <section className={"home-musicplayer"}>
                            <React.Fragment>
                                {
                                    currMusic
                                        ?
                                        <FooterMusicPlayer music={currMusic} />
                                        :
                                        <FooterEmpty />
                                }
                            </React.Fragment>
                        </section>
                        {
                            bannerOpen
                            &&
                            <section className="current-large-banner">
                                <CurrentPlayingLarge />
                            </section>
                        }
                    </div>
            }
        </div>
    );
}

export default Home;