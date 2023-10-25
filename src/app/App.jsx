import React, { useEffect } from "react";
import firebase from 'firebase/app';
import 'firebase/firestore'
import './App.scss';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
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
import StudentNavigationBar from "../components/fragment/StudentNavigationBar";
import { Helmet } from 'react-helmet';
import SolvePage from "../components/Pages/SolvePage";
import News from "../components/Pages/News";
import TeachingResources from "../components/Pages/TeachingResources";
import Showcase from "../components/Pages/Showcase";
// import Homework from "../components/Pages/Homework";
// import Makehomework from "../components/Pages/Makehomework";


const App = () => {

    const { language } = useSelector(state => state.musicReducer);
    const db = firebase.firestore();
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            localStorage.setItem('ae-useruid', user.uid);
            db.collection('student').doc(user.uid).get().then(doc => {
                localStorage.setItem('ae-class', doc.data().class || '')
                localStorage.setItem('ae-username', doc.data().name)
                localStorage.setItem('ae-totaltimeplayed', doc.data().totaltimeplayed)
            })
            db.collection('teacher').doc(user.uid).get().then(doc => {
                localStorage.setItem('ae-teacherschool', doc.data().school || '')
            })
            var PostRef = firebase.database().ref('TeachingResources/');

            PostRef.on('value', (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const dataArray = Object.entries(data).map(([date, details]) => ({
                        date,
                        ...details,
                    }));


                    // Store the data in localStorage
                    localStorage.setItem('teachingResourcesData', JSON.stringify(dataArray));
                } else {
                    const placeholderData = {
                        description: "This is a placeholder node.",
                        timestamp: "2023-10-19 12:00:00"
                    };

                    // Store the placeholder data in localStorage
                    localStorage.setItem('teachingResourcesData', JSON.stringify(placeholderData));
                }
            });
        } else {
            localStorage.setItem('ae-class', '')
            localStorage.setItem('ae-useruid', '');
            localStorage.setItem('ae-username', '')
            localStorage.setItem('ae-totaltimeplayed', '')
            localStorage.setItem('ae-teacherschool', '')
        }
    })

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
                <Switch>
                    <Route path="/" exact component={Login} />
                    <Route path="/home/signup" exact component={Signup} />
                    <Route path="/solve" exact component={SolvePage} />
                    <Route path="/showcase" exact component={Showcase} />
                    <Route path="/home/leaderboard">
                        <StudentNavigationBar />
                        <Leaderboard />
                    </Route>
                    <Route path="/home/teachingresources">
                        <StudentNavigationBar />
                        <TeachingResources />
                    </Route>
                    <Route path="/home/userinfo">
                        <StudentNavigationBar />
                        <UserInfo />
                    </Route>
                    <Route path="/home/contact">
                        <StudentNavigationBar />
                        <Contact />
                    </Route>
                    <Route path="/home/about">
                        <StudentNavigationBar />
                        <About />
                    </Route>
                    <Route path="/home/dashboard">
                        <StudentNavigationBar />
                        <Dashboard />
                    </Route>
                    <Route path="/home/news">
                        <StudentNavigationBar />
                        <News />
                    </Route>
                    <Route path="/home" component={Home} />
                </Switch>
            </Router>
        </>

    );
}

export default App;