// ==========================================================
// MENUJU ASN - FIREBASE CONFIG & CLOUD SERVICES
// Shared Firebase Backend with 'cpns_' namespacing
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager, 
    enableIndexedDbPersistence, 
    collection, addDoc, query, where, orderBy, limit, getDocs, deleteDoc, writeBatch, doc, getDoc, updateDoc, setDoc, onSnapshot, arrayUnion, deleteField 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "AIzaSyAC4Tskg8XC1N0a13xcsV3A1Mq_8mDnY-A",
    authDomain: "menuju-asn.web.app",
    projectId: "simulasi-cbt-cakim-2026",
    storageBucket: "simulasi-cbt-cakim-2026.firebasestorage.app",
    messagingSenderId: "209182753461",
    appId: "1:209182753461:web:1aa2201fa7c73e581234fc",
    measurementId: "G-NDNKMSMWV2"
};

// 👑 ADMIN & EDITOR RESMI MENUJU ASN
export const ADMIN_EMAILS = ["ilhamnp22@gmail.com", "inurprtma22@gmail.com"]; 
export const EDITOR_EMAILS = [];

// 🔒 PREFIX NAMESPACING FIRESTORE (ANTI-BENTROK DENGAN PRO-TAMA)
export const COLLECTIONS = {
    ROOMS: "cpns_rooms",
    SESSIONS: "cpns_tryout_sessions",
    USERS: "cpns_users",
    SETTINGS: "cpns_settings",
    PACKAGES: "cpns_packages"
};

export const app = initializeApp(firebaseConfig);

let dbInstance;
try {
    dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });
    console.log("✅ [MENUJU ASN] Offline persistence Firebase aktif (Multi-tab cache)");
} catch (e) {
    console.warn("[MENUJU ASN] Inisialisasi persistentLocalCache dialihkan ke fallback:", e);
    dbInstance = getFirestore(app);
}

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = dbInstance;
export { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile };
export { collection, addDoc, query, where, orderBy, limit, getDocs, deleteDoc, writeBatch, doc, getDoc, updateDoc, setDoc, onSnapshot, arrayUnion, deleteField };
