import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAc8xh5pAHv11oBUxml08e6jJ9sZ0IxMlc",
  authDomain: "route-pulse-79e75.firebaseapp.com",
  databaseURL:
    "https://route-pulse-79e75-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "route-pulse-79e75",
  storageBucket: "route-pulse-79e75.firebasestorage.app",
  messagingSenderId: "1068034518399",
  appId: "1:1068034518399:web:671b876c6054e56b4bbe4a",
  measurementId: "G-HTK6R4EVBW",
};

const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);
export const auth = getAuth(app);
export const db = getFirestore(app);