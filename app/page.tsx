'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig'; 
import NavBar from './components/NavBar';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/')
      } else {
        router.push('/login');
      }
    });
  }, [router]);

  const goToProfile = () => {
    router.push('/Profile');
  };

  return (

    <div className="min-h-screen bg-white flex flex-col">
      <NavBar/>
      <div className="flex-grow scrollbar-hide overflow-x-scroll p-4">
        {/* Recommended Posts Section with custom scrollbar and arrows */}
        <div className="scroll-container scrollbar-hide flex space-x-4 scrollbar-hide">
          {/* Simulated Posts */}
          {[...Array(10)].map((_, index) => (
            <div key={index} className="bg-slate-100 p-4 rounded shadow-md fade">
              <h2 className="text-xl font-bold">Recommended Post {index + 1}</h2>
              <p>Post content...</p>
            </div>
          ))}
          <div className="scroll-arrow scroll-arrow-left"></div>
          <div className="scroll-arrow scroll-arrow-right"></div>
        </div>
      </div>
      <div className="flex-grow overflow-y-scroll p-4">
        {/* User Profiles Section */}
        <div className="space-y-4">
          {/* Simulated User Profiles */}
          {[...Array(20)].map((_, index) => (
            <div key={index} className="bg-slate-100 p-4 rounded shadow-md fade">
              <h2 className="text-xl font-bold">User Profile {index + 1}</h2>
              <p>User profile content...</p>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Welcome to the Home Page</h1>
        <button onClick={goToProfile} className="bg-primary text-white py-2 px-4 rounded hover:bg-secondary">Profile</button>
      </div>
    </div>
  );
}
