

// FIX: Changed the import for `firebase/app` to a named import for `initializeApp` to align with the Firebase v9+ modular SDK.
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp, updateDoc, increment, collection, query, where, orderBy, addDoc, Timestamp, deleteDoc, getDocs, limit, getDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCDWPdrUuM9wid5FBCJ6Ttqbwlz21w7tXQ",
  authDomain: "assistende-de-ia.firebaseapp.com",
  projectId: "assistende-de-ia",
  storageBucket: "assistende-de-ia.appspot.com",
  messagingSenderId: "1044507979301",
  appId: "1:1044507979301:web:da477270978fe0460499cc",
  measurementId: "G-CY5QZPXSCP"
};

// Initialize Firebase
// FIX: Used initializeApp directly from the named import.
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Export firebase auth functions to be used in components
export {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    doc,
    onSnapshot,
    setDoc,
    serverTimestamp,
    updateDoc,
    increment,
    ref,
    uploadBytes,
    getDownloadURL,
    collection,
    query,
    where,
    orderBy,
    addDoc,
    Timestamp,
    deleteDoc,
    getDocs,
    limit,
    getDoc
};