import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAm3mmfBPSDT12FvL3C8ghhO-eZKGxhy9s",
  authDomain: "gen-lang-client-0730106196.firebaseapp.com",
  projectId: "gen-lang-client-0730106196",
  storageBucket: "gen-lang-client-0730106196.firebasestorage.app",
  messagingSenderId: "974317429927",
  appId: "1:974317429927:web:979646441f42e792dc2782",
  measurementId: "G-K502FQE110"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();