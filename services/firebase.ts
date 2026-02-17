import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBNdIKHlKVHjqGo5uD1frymlb1mugeBfXw",
  authDomain: "wattwalkerapp.firebaseapp.com",
  projectId: "wattwalkerapp",
  storageBucket: "wattwalkerapp.firebasestorage.app",
  messagingSenderId: "57159750417",
  appId: "1:57159750417:web:eb1593d57cad5ab7d2f2b0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();