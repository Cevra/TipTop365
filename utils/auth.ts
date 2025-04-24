import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, Auth, ConfirmationResult } from 'firebase/auth';

export const signInWithEmail = async (auth: Auth, email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in with email and password", error);
    throw error;
  }
};

export const confirmPhoneNumber = async (confirmationResult: ConfirmationResult, code: string) => {
  try {
    const userCredential = await confirmationResult.confirm(code);
    return userCredential.user;
  } catch (error) {
    console.error("Error confirming phone number", error);
    throw error;
  }
};

export const signUpWithEmail = async (auth: Auth, email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error creating user with email and password", error);
    throw error;
  }
};

export const logout = async (auth: Auth) => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
