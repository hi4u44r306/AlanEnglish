// import firebase from 'firebase';
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/storage';
import "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAEDlCj0bsRoiacVPhFHff_eb0RfqeB8uA",
  authDomain: "alan-english-listening.firebaseapp.com",
  databaseURL: "https://alan-english-listening-default-rtdb.firebaseio.com",
  projectId: "alan-english-listening",
  storageBucket: "alan-english-listening.appspot.com",
  messagingSenderId: "1045346213843",
  appId: "1:1045346213843:web:b2a25425a24e9bc9331926",
  measurementId: "G-7MW8Y5XPH0"
  };

const fire = firebase.initializeApp(firebaseConfig);


export default fire;
