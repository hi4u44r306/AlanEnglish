import React, { useEffect } from "react";
import './App.scss';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from "../components/Pages/Login";
import Signup from "../components/Pages/Signup";
import musicDB from "../db/music";
import { useDispatch, useSelector } from "react-redux";
import { setPlaylist } from "../actions/actions";
import { Helmet } from 'react-helmet';
import SolvePage from "../components/Pages/SolvePage";
// import TeachingResources from "../components/Pages/TeachingResources";
import Showcase from "../components/Pages/Showcase";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import Playlist from "../components/fragment/Playlist";
import Containerfull from "../components/fragment/Containerfull";
import { authentication, rtdb } from "../components/Pages/firebase-config";
import Search from "../components/Pages/Search";
import User from "../components/Pages/User";
// import Leaderboard from "../components/Pages/Leaderboard";
import Trade from "../components/Pages/Trade";
import TradeSignup from "../components/Pages/TradeSignup";
import TradeLogin from "../components/Pages/TradeLogin";
import TradeTrack from "../components/Pages/TradeTrack";
import GetHW from "../components/Pages/GetHW";
import ControlPanel from "../components/Pages/ControlPanel";
import Developer from "../components/fragment/Developer";
// import Homework from "../components/Pages/Homework";
// import Makehomework from "../components/Pages/Makehomework";


const App = () => {

    const { language } = useSelector(state => state.musicReducer);


    onAuthStateChanged(authentication, user => {
        if (user) {
            localStorage.setItem('ae-useruid', user.uid);
            const studentDocRef = ref(rtdb, `student/${user.uid}`);
            onValue(studentDocRef, snapshot => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    localStorage.setItem('ae-class', data.class || '');
                    localStorage.setItem('ae-username', data.name.toUpperCase());
                    localStorage.setItem('ae-userimage', data.userimage || '');
                }
                else {
                    localStorage.setItem('ae-class', '');
                    localStorage.setItem('ae-username', '');
                    localStorage.setItem('ae-userimage', '');
                }
            })

            const postRef = ref(rtdb, 'TeachingResources/');
            onValue(postRef, snapshot => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const dataArray = Object.entries(data).map(([date, details]) => ({
                        date,
                        ...details,
                    }));
                    localStorage.setItem('teachingResourcesData', JSON.stringify(dataArray));
                } else {
                    const placeholderData = {
                        description: "This is a placeholder node.",
                        timestamp: "2023-10-19 12:00:00"
                    };
                    localStorage.setItem('teachingResourcesData', JSON.stringify(placeholderData));
                }
            });
        }
    });

    const dispatch = useDispatch();
    useEffect(() => {
        if (language === null || language.includes("any")) {
            dispatch(setPlaylist(musicDB))
        }
        else if (language.includes('hindi')) {
            alert("No hindi tracks available")
        } else {
            let x = musicDB.filter((item) => (
                item.lang && language.includes(item.lang.toLowerCase())
            ))
            dispatch(setPlaylist(x))
        }
    }, [dispatch, language]);



    return (
        <>
            <Router>
                <Helmet>
                    <link rel="icon" type="image/png" href={'/favicon.ico'} sizes="16x16" />
                </Helmet>
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/solve" element={<SolvePage />} />
                    <Route path="/showcase" element={<Showcase />} />
                    <Route path="/home/playlist/signup" element={
                        <Containerfull>
                            <Signup />
                        </Containerfull>
                    } />
                    {/* <Route path="/home/playlist/leaderboard" element={
                        <Containerfull>
                            <Leaderboard />
                        </Containerfull>
                    } /> */}
                    <Route path="/home/playlist/controlpanel" element={
                        <Containerfull>
                            <ControlPanel />
                        </Containerfull>
                    } />

                    {/* <Route path="/home/teachingresources" element={
                        <React.Fragment>
                            <StudentNavigationBar />
                            <TeachingResources />
                        </React.Fragment>
                    } /> */}

                    <Route path="/home/playlist/userinfo" element={
                        <Containerfull>
                            <User />
                        </Containerfull>
                    } />
                    {/* <Route path="/home/playlist/contact" element={
                        <Containerfull>
                            <Contact />
                        </Containerfull>
                    } /> */}
                    <Route path="/home/playlist/about" element={
                        <Containerfull>
                            <Developer />
                        </Containerfull>
                    } />
                    {/* <Route path="/home/playlist/dashboard" element={
                        <Containerfull>
                            <Dashboard />
                        </Containerfull>
                    } /> */}
                    {/* <Route path="/home" element={
                        <Containerfull>
                            <Home />
                        </Containerfull>
                    } /> */}
                    <Route path="/home/playlist/search" element={
                        <Containerfull>
                            <Search />
                        </Containerfull>
                    } />
                    <Route path="/home/playlist/:playlistId" element={
                        <Containerfull>
                            <Playlist />
                        </Containerfull>
                    } />
                    <Route path="/trade" element={
                        <Trade />
                    } />
                    <Route path="/tradesignup" element={
                        <TradeSignup />
                    } />
                    <Route path="/tradeLogin" element={
                        <TradeLogin />
                    } />
                    <Route path="/tradetrack" element={
                        <TradeTrack />
                    } />
                    <Route path="/getHW" element={
                        <Containerfull>
                            <GetHW />
                        </Containerfull>
                    } />
                </Routes>
            </Router>
        </>

    );
}

export default App;