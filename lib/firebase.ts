// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA6hGJ1RI4UznlWo_QVhhqOt7arSwszG3U",
  authDomain: "test-adem-f51d8.firebaseapp.com",
  projectId: "test-adem-f51d8",
  storageBucket: "test-adem-f51d8.firebasestorage.app",
  messagingSenderId: "823932103890",
  appId: "1:823932103890:web:d0a995d60375953d37110b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);