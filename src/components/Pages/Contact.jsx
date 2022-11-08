import React from 'react';
import './css/Contact.scss';
import Containerfull from "../fragment/Containerfull";
import Contactus from "../fragment/Contactus";
import { useState } from 'react';
import firebase from "./firebase";
import Redirectpage from '../fragment/Redirectpage';

const Contact = () => {
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
            <Contactus/>
        </Containerfull>
    );
}

export default Contact;
