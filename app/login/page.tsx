// pages/login/index.js
'use client';

import { useRouter } from 'next/navigation'; // Corrected from 'next/navigation'
import { useState } from 'react';
import { signInWithEmail } from '@/utils/auth';
import { auth } from '@/firebaseConfig'; // Adjust the import path as necessary
import Link from 'next/link';

const Login = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignInWithEmail = async () => {
    try {
      const userCredential = await signInWithEmail(auth, email, password);
      // Redirect to home page or perform other actions upon successful login
      router.push('/');
    } catch (error) {
      console.error('Error signing in with email and password:', error);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Sign In</h2>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded" placeholder="Email" />
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mt-4">Password</label>
          <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded" placeholder="Password" />
          <button onClick={handleSignInWithEmail} className="mt-4 w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700">Sign In</button>
        </div>
        <Link href="/signUp" className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-800">Don't have an account? Sign Up</Link>
      </div>
    </div>
  );
};

export default Login;
