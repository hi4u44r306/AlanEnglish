import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// ⭐ 一定要有 export
export const firebaseConfig = {
  apiKey: "AIzaSyAKut6TW8-AHuUmbkgFRECuamobNXknZgk",
  authDomain: "alan-english-listening.firebaseapp.com",
  projectId: "alan-english-listening",
  appId: "1:1045346213843:web:b2a25425a24e9bc9331926"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const authentication = getAuth(app);
