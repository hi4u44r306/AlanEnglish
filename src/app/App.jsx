import React, {useEffect} from "react";
import './App.scss';
import Home from "../components/Pages/Home";
import {BrowserRouter as Router, Route, Switch} from 'react-router-dom';
import Login from "../components/Pages/Login";
import Signup from "../components/Pages/Signup";
import {ThemeContext, themes} from "../api/Theme";
import musicDB from "../db/music";
import {useDispatch, useSelector} from "react-redux";
import {setPlaylist} from "../actions/actions";
import Leaderboard from "../components/fragment/Leaderboard";
import NavigationMobile from "../components/fragment/NavigationMobile";
import Copyright from "../components/fragment/Copyright";
import UserInfo from "../components/Pages/UserInfo";
import Contact from "../components/Pages/Contact";
import About from "../components/Pages/About";
import Game from "../components/fragment/Game";


const App = () => {

    const {language} = useSelector(state => state.musicReducer);

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

    return (
        <ThemeContext.Provider value={themes.light}>
            <>
                <Router>
                    <Switch>
                        <Route path="/" exact component={Login}/>
                        <Route path="/home/signup" exact component={Signup}/>
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
                        <Route path="/home/game">
                            <NavigationMobile/>
                            <Game/>
                            <Copyright/>
                        </Route>
                        <Route path="/home" component={Home}/>
                    </Switch>
                </Router>
            </>
        </ThemeContext.Provider>
        
    );
}

export default App;