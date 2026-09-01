import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAaVSb70OFIoX48T9GbLmTcdXOSvKv2pRk",
  apiKey: "AIzaSyAaVSb70OFIoX48T9GbLmTcdXOSvKv2pRk",
  authDomain: "zona1561-4de30.firebaseapp.com",
  projectId: "zona1561-4de30",
  storageBucket: "zona1561-4de30.firebasestorage.app",
  messagingSenderId: "451366030738",
  appId: "1:451366030738:web:d5906d9dd487e8c248054b"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
