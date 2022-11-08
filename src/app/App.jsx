import React, {useEffect} from "react";
// import firebase from 'firebase/app';
import './App.scss';
import Home from "../components/Pages/Home";
import {BrowserRouter as Router, Route, Switch} from 'react-router-dom';
import Login from "../components/Pages/Login";
import Signup from "../components/Pages/Signup";
import musicDB from "../db/music";
import {useDispatch, useSelector} from "react-redux";
import {setPlaylist} from "../actions/actions";
import Leaderboard from "../components/fragment/Leaderboard";
import NavigationMobile from "../components/fragment/NavigationMobile";
import Copyright from "../components/fragment/Copyright";
import UserInfo from "../components/Pages/UserInfo";
import Contact from "../components/Pages/Contact";
import About from "../components/Pages/About";
import Dashboard from "../components/fragment/Dashboard";
// import { useState } from "react";
// import Menu from "../components/fragment/Menu";



const App = () => {

    const {language} = useSelector(state => state.musicReducer);
    // const [userid, setuserID] = useState();
    // const db = firebase.firestore();
    // const getUserInfo = (user) =>{  //從firestore取得 student 集合中選取符合user.uid的資訊
    //     if(user){
    //         db.collection('student').doc(user.uid).get().then( doc => {
    //             setuserID(doc.id)
    //         }, err =>{
    //             console.log(err.message);
    //         });
    //     }else{
    
    //     }
    //   }    
    // firebase.auth().onAuthStateChanged(user => {
    //     if(user){
    //         db.collection('student').onSnapshot(snapshot =>{
    //             getUserInfo(user);
    //         }, err =>{
    //             console.log(err.message);
    //         });
    //     }else{
    //         getUserInfo();
    //     }
    // })

    const dispatch = useDispatch();
    useEffect(()=>{
        if (language === null || language.includes("any")){
            dispatch(setPlaylist(musicDB))
        }
        else if (language.includes('hindi')){
            alert("No hindi tracks available")
        } else {
            let x = musicDB.filter((item)=>(
                item.lang && language.includes(item.lang.toLowerCase())
            ))
            dispatch(setPlaylist(x))
        }
    },[dispatch, language]);
    // const refresh = window.location.protocol + "//" + window.location.host +  window.location.pathname + `?id=${userid||''}` ;    
    // window.history.replaceState({ path: refresh }, '', refresh); 

    return (
        <>
            <Router>
                <Switch>
                    <Route path="/" exact component={Login}/>
                    <Route path="/home/signup" exact component={Signup}/>
                    {/* <Route path="/home/menu">
                        <NavigationMobile/>
                        <Menu/>
                        <Copyright/>
                    </Route> */}
                    <Route path="/home/leaderboard">
                        <NavigationMobile/>
                        <Leaderboard/>
                        <Copyright/>
                    </Route>
                    <Route path="/home/userinfo">
                        <NavigationMobile/>
                        <UserInfo/>
                        <Copyright/>
                    </Route>
                    <Route path="/home/contact">
                        <NavigationMobile/>
                        <Contact/>
                        <Copyright/>
                    </Route>
                    <Route path="/home/about">
                        <NavigationMobile/>
                        <About/>
                        <Copyright/>
                    </Route>
                    {/* <Route path="/home/game">
                        <NavigationMobile/>
                        <Game/>
                        <Copyright/>
                    </Route> */}
                    <Route path="/home/dashboard">
                        <NavigationMobile/>
                        <Dashboard/>
                        <Copyright/>
                    </Route>
                    <Route path="/home" component={Home}/>
                </Switch>
            </Router>
        </>
        
    );
}

export default App;