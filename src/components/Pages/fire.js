import firebase from 'firebase';

var firebaseConfig = {
    apiKey: "AIzaSyAEDlCj0bsRoiacVPhFHff_eb0RfqeB8uA",
    authDomain: "alan-english-listening.firebaseapp.com",
    projectId: "alan-english-listening",
    storageBucket: "alan-english-listening.appspot.com",
    messagingSenderId: "1045346213843",
    appId: "1:1045346213843:web:b2a25425a24e9bc9331926",
    measurementId: "G-7MW8Y5XPH0"
  };

const fire = firebase.initializeApp(firebaseConfig);

export default fire;