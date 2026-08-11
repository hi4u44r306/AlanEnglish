import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "@firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// ⭐ 一定要有 export
export const firebaseConfig = {
  apiKey: "你的原本 apiKey",
  authDomain: "alan-english-listening.firebaseapp.com",
  databaseURL: "https://alan-english-listening-default-rtdb.firebaseio.com",
  projectId: "alan-english-listening",
  storageBucket: "alan-english-listening.appspot.com",
  messagingSenderId: "1045346213843",
  appId: "你的原本 appId",
  measurementId: "G-7MW8Y5XPH0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const authentication = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const getstorage = getStorage(app);