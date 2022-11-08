import React from 'react';
import './css/About.scss';
import Containerfull from "../fragment/Containerfull";
import Developer from "../fragment/Developer";
import firebase from "./firebase";
import { useState } from 'react';
import Redirectpage from '../fragment/Redirectpage';

const About = () => {
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
    if(!auth) return <Redirectpage/>
    return (
        <Containerfull>
            <div className={"About"}>
                <Developer/>
            </div>
        </Containerfull>
    );
}

export default About;
