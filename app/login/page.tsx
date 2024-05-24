// pages/login/index.js
"use client";

import { useRouter } from "next/navigation"; // Corrected from 'next/navigation'
import { useState } from "react";
import { signInWithEmail } from "@/utils/auth";
import { auth } from "@/firebaseConfig"; // Adjust the import path as necessary
import Link from "next/link";
import logoImage from "../../public/logolight.svg";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import Image from "next/image";
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Head from 'next/head';
const Login = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignInWithEmail = async () => {
    try {
      const userCredential = await signInWithEmail(auth, email, password);
      // Redirect to home page or perform other actions upon successful login
     // router.push("/");
    } catch (error) {
      console.error("Error signing in with email and password:", error);
    }
  };
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    return emailRegex.test(email);
  }
  
  
  const handleSaveEmail = async () => {
    if (!isValidEmail(email)) {
      alert("Invalid email address. Please enter a valid email.");
      return;
    }

    const potentialCustomersCollection = collection(db, "potential customers");
    const querySnapshot = await getDocs(potentialCustomersCollection);
  
    let emailExists = false;
    querySnapshot.forEach((doc) => {
      if (doc.data().email === email) {
        emailExists = true;
      }
    });
  
    if (emailExists) {
      alert("This email address is already registered.");
      return;
    }

    try {
      const auth = getAuth();
      const docRef = await addDoc(collection(db, "potential customers"), {
        email: email,
        timestamp: Date.now(),
      });
      console.log("Document written with ID: ", docRef.id);
      alert("Vaš mail je sačuvan!");

      setEmail("");
    } catch (error) {
      console.error("Error saving email to Firestore:", error);
      alert("Failed to save email.");
    }
  };
  

  return (
    // <div className="min-h-screen bg-primary  flex items-center justify-center">
    //   <div className="bg-white  sm:bg-primary p-8 rounded shadow-md w-full max-w-md">
    //     <h2 className="text-2xl font-bold mb-4">Sign In</h2>
    //     <div>
    //       <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
    //       <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded" placeholder="Email" />
    //       <label htmlFor="password" className="block text-sm font-medium text-gray-700 mt-4">Password</label>
    //       <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded" placeholder="Password" />
    //       <button onClick={handleSignInWithEmail} className="mt-4 w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700">Sign In</button>
    //     </div>
    //     <Link href="/signUp" className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-800">Don't have an account? Sign Up</Link>
    //   </div>
    // </div>
    // <div className="min-h-screen bg-gradient-to-r from-green-800 via-purple-800 to-blue-700 flex items-center justify-center">
    //   <div className="bg-white p-8 rounded shadow-md w-full max-w-md text-center">
    //     <h1 className="text-6xl font-bold mb-4">COMING SOON</h1>
    //     <p className="text-xl font-semibold mb-8">Our website is currently under construction. Please check back later!</p>

    //   </div>
    // </div>
    <div className="w-full min-h-screen bg-gradient-to-r from-cyan-950 to-cyan-700 flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="flex justify-center items-center mb-8 mt-12">
        <Image
          src={logoImage.src} // Ensure this path is correct
          alt="Company Logo"
          layout="intrinsic"
          width={240}
          height={120}
          className="sm:w-80 sm:h-52"
        />
      </div>

      {/* Other content */}
      <div className="text-center">
        <div className="text-gray-100 text-6xl sm:text-8xl  mt-12  font-bold font-Roboto">
          Uskoro stiže
        </div>

        <div className="text-white mt-12 text-2xl sm:text-4xl font-normal font-Roboto">
          Budite prvi koji će saznati kada stranica bude aktivna.
        </div>
        <div className="flex mx-4 items-center flex-col sm:flex-row sm:items-center sm:justify-center justify-center sm:space-x-12">
          <div className="w-10/12   justify-start items-start inline-flex">
            <input
            
              type="email"
              name="email"
              autoComplete="email"
              required
              className="w-full px-4 py-3 sm:mt-10 mt-12 sm:px-4 text-black border-slate-100  border-collapse-0 bg-zinc-100 rounded-[62px] justify-start items-start inline-flex"
              placeholder="E-mail adresa"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveEmail();
                }}}
            />
          </div>
          <div className="w-10/12 sm:w-2/12 px-4 sm:px-4 py-3 sm:mt-10 mt-6 bg-cyan-950 rounded-[62px] justify-start items-start inline-flex">
            <button
              onClick={handleSaveEmail}
              className="w-full text-center text-gray-100 text-base font-normal font-Roboto"
            >
              Pošalji
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
