import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAm3mmfBPSDT12FvL3C8ghhO-eZKGxhy9s",
  authDomain: "gen-lang-client-0730106196.firebaseapp.com",
  projectId: "gen-lang-client-0730106196",
  storageBucket: "gen-lang-client-0730106196.firebasestorage.app",
  messagingSenderId: "974317429927",
  appId: "1:974317429927:web:979646441f42e792dc2782",
  measurementId: "G-K502FQE110",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * Capacitor iOS WKWebView often misbehaves with default IndexedDB auth persistence;
 * browserLocalPersistence avoids some hangs on signInWithEmailAndPassword.
 */
function initAuth() {
  try {
    return initializeAuth(app, { persistence: browserLocalPersistence });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    if (code === "auth/already-initialized") {
      return getAuth(app);
    }
    throw e;
  }
}

export const auth = initAuth();
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
