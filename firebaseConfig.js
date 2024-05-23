
import { initializeApp } from 'firebase/app';
import {  getFirestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';


// Your Firebase configuration
const firebaseConfig = {
  apiKey: String(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain:String( process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId:String( process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket:String( process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId:String( process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: String(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firestore instance
export const db = getFirestore(app);

// Get Auth instance
export const auth = getAuth(app);

// Optionally, connect to an emulator for testing
// connectAuthEmulator(auth, 'http://localhost:9099');
