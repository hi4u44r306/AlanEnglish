import React, { useEffect, useState } from "react";
import './App.scss';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from "../components/Pages/Login";
import Signup from "../components/Pages/Signup";
import musicDB from "../db/music";
import { useDispatch, useSelector } from "react-redux";
import { setPlaylist } from "../actions/actions";
import Leaderboard from "../components/fragment/Leaderboard";
import UserInfo from "../components/Pages/UserInfo";
import Contact from "../components/Pages/Contact";
import About from "../components/Pages/About";
import Dashboard from "../components/fragment/Dashboard";
import Home from "../components/Pages/Home"
import { Helmet } from 'react-helmet';
import SolvePage from "../components/Pages/SolvePage";
// import TeachingResources from "../components/Pages/TeachingResources";
import Showcase from "../components/Pages/Showcase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, } from "firebase/firestore";
import { onValue, ref } from "firebase/database";
import Playlist from "../components/fragment/Playlist";
import Containerfull from "../components/fragment/Containerfull";
import { authentication, db, rtdb } from "../components/Pages/firebase-config";
import Search from "../components/Pages/Search";
// import Homework from "../components/Pages/Homework";
// import Makehomework from "../components/Pages/Makehomework";


const App = () => {

    const { language } = useSelector(state => state.musicReducer);

    onAuthStateChanged(authentication, user => {
        if (user) {
            localStorage.setItem('ae-useruid', user.uid);
            const studentDocRef = doc(db, 'student', user.uid);
            getDoc(studentDocRef).then(docSnapshot => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    localStorage.setItem('ae-class', data.class || '');
                    localStorage.setItem('ae-username', data.name);
                    localStorage.setItem('ae-totaltimeplayed', data.totaltimeplayed);
                }
            });
            const teacherDocRef = doc(db, 'teacher', user.uid);
            getDoc(teacherDocRef).then(docSnapshot => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    localStorage.setItem('ae-teacherschool', data.school || '');
                }
            });
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
        } else {
            localStorage.setItem('ae-class', '');
            localStorage.setItem('ae-useruid', '');
            localStorage.setItem('ae-username', '');
            localStorage.setItem('ae-totaltimeplayed', '');
            localStorage.setItem('ae-teacherschool', '');
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
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/solve" element={<SolvePage />} />
                    <Route path="/showcase" element={<Showcase />} />
                    <Route path="/home/leaderboard" element={
                        <Containerfull>
                            <Leaderboard />
                        </Containerfull>
                    } />

                    {/* <Route path="/home/teachingresources" element={
                        <React.Fragment>
                            <StudentNavigationBar />
                            <TeachingResources />
                        </React.Fragment>
                    } /> */}

                    <Route path="/home/userinfo" element={
                        <Containerfull>
                            <UserInfo />
                        </Containerfull>
                    } />
                    <Route path="/home/contact" element={
                        <Containerfull>
                            <Contact />
                        </Containerfull>
                    } />
                    <Route path="/home/about" element={
                        <Containerfull>
                            <About />
                        </Containerfull>
                    } />
                    <Route path="/home/dashboard" element={
                        <Containerfull>
                            <Dashboard />
                        </Containerfull>
                    } />
                    <Route path="/home" element={
                        <Containerfull>
                            <Home />
                        </Containerfull>
                    } />
                    <Route path="/home/search" element={
                        <Containerfull>
                            <Search />
                        </Containerfull>
                    } />
                    <Route path="/home/playlist/:playlistId" element={
                        <Containerfull>
                            <Playlist />
                        </Containerfull>
                    } />
                </Routes>
            </Router>
        </>

    );
}

export default App;