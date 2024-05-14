// utils/auth.js
import { auth } from '/firebaseConfig'; // Adjust the import path as necessary
import { signInWithEmailAndPassword } from 'firebase/auth';

export const signInWithEmail = async (auth,email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in with email and password", error);
    throw error;
  }
};

export const confirmPhoneNumber = async (confirmationResult, code) => {
  try {
    const userCredential = await confirmationResult.confirm(code);
    return userCredential.user;
  } catch (error) {
    console.error("Error confirming phone number", error);
    throw error;
  }
};
