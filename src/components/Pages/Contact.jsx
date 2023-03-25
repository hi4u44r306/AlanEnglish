import React from 'react';
import './css/Contact.scss';
import Containerfull from "../fragment/Containerfull";
import Contactus from "../fragment/Contactus";
import firebase from "./firebase";

const Contact = () => {

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {

    } else {
      // 使用者未登入
      window.location = '/'
    }
  });
  return (
    <Containerfull>
      <Contactus />
    </Containerfull>
  );
}

export default Contact;
