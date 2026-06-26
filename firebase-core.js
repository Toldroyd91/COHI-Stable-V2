import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your exact secure configuration
const appConfig = { 
    apiKey: "AIzaSyD-QrqKxjes9f1TgyJOffiQzSMRncf84L0", 
    authDomain: "cohi-survey-engine.firebaseapp.com", 
    projectId: "cohi-survey-engine" 
};

// Singleton pattern: Only initialize once
export const app = !getApps().length ? initializeApp(appConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export all required modules so your app-survey, app-vault, and app-dashboard can use them safely
export { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp 
};
