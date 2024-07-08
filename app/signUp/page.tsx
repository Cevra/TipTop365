// pages/signup/index.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Corrected from 'next/navigation'
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebaseConfig'; // Adjust the import path as necessary
import '@/utils/hom'
const SignUp = () => {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password!== passwordConfirmation) {
      setError('Passwords do not match');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error) {
      console.error('Error creating user:', error);
      setError('SOMETHING IS WRONG');
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Sign Up</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded" placeholder="Email" required />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mt-4">Password</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded" placeholder="Password" required />
          </div>
          <div>
            <label htmlFor="passwordConfirmation" className="block text-sm font-medium text-gray-700 mt-4">Confirm Password</label>
            <input type="password" id="passwordConfirmation" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded" placeholder="Confirm Password" required />
          </div>
          {error && <p className="text-red-500 mt-2">{error}</p>}
          <button type="submit" className="mt-4 w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700">Sign Up</button>
        </form>
      </div>
    </div>
  );
};

export default SignUp;
