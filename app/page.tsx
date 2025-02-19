'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react'; // Import useState
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig'; 
import NavBar from './components/NavBar';
import { collection, getDocs, query, DocumentData } from "firebase/firestore"; // Import Firestore functions
import { db } from '@/firebaseConfig'; // Adjust the path based on your project structure
import { Profile, ProfileData } from './models/Profile';
import Image from 'next/image';
import Footer from './components/Footer';

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoading(false); // Set loading 
      if (user) {
        router.push('/');
      } else {
        // router.push('/login');
      }
    });

    // Fetch user profiles
    const fetchProfiles = async () => {
      const q = query(collection(db, "profiles")); // Query to fetch all profiles
      const querySnapshot = await getDocs(q);
      const profilesData = querySnapshot.docs.map(doc => {
        const rawData = doc.data() as DocumentData;
        // Attempt to cast rawData to ProfileData. Handle missing fields as needed.
        return rawData as ProfileData;
      });
      setProfiles(profilesData); // Update state with fetched profiles
    };

    fetchProfiles(); // Call fetchProfiles directly
  }, [router]); // Ensure this effect runs only when router changes
  const goToProfile = () => {
    router.push('/Profile');
  };

  return (
    <div className="min-h-screen bg-inherit flex flex-col">
    <div className="relative -z-0 h-[400px] md:h-[600px]">
      <div className="absolute top-0 left-0 right-0 w-full z-10">
        <NavBar />
      </div>
      <div className="flex justify-between items-center h-full">
        <div className="container mx-auto px-4 py-16 text-left relative z-10 lg:w-1/2">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-8">Payments tool for software companies</h1>
          <p className="text-xl md:text-2xl font-medium text-gray-200 mb-8">From checkout to global sales tax compliance, companies around the world use Flowbite to simplify their payment stack.</p>
          <a href="#" className="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-center text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 dark:focus:ring-primary-900 rounded-lg shadow-md transition duration-300">
            Get started
            <svg className="w-5 h-5 ml-2 -mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
          </a>
          
        </div>
        <div className="hidden lg:block lg:w-1/2">
          <Image
            src="/Homepage1.jpg"
            layout="fill"
            objectFit="cover"
            alt="Large Image Description"
          />
        </div>
      </div>
    </div>


  <div className="flex-grow scrollbar-hide overflow-x-scroll p-4">
    {/* Recommended Posts Section with custom scrollbar and arrows */}
      <h2 className="text-4xl font-normal text-[#001A1E] font-weight:700; font-family: Roboto">Preporuceno za vas</h2>
    <div className="scroll-container scrollbar-hide flex space-x-4 scrollbar-hide">
      {/* Simulated Posts */}

      {profiles.map((profile, index) => (
        <div key={index} className="bg-slate-100 p-4 rounded shadow-md fade">
          <h2 className="text-xl font-bold">{profile.name} {profile.surname}</h2>
          <h2 className="text-xl font-bold">{profile.description}</h2>
          <p>{profile.pricePerHour} per hour</p>
          <p>Available: {profile.availableHours} hours per day</p>
        </div>
      ))}
      <div className="scroll-arrow scroll-arrow-left"></div>
      <div className="scroll-arrow scroll-arrow-right"></div>
    </div>
  </div>
  <div className="flex-grow w-1/2 overflow-y-scroll p-4">
    {/* User Profiles Section */}
    <div className="space-y-4">
      {/* Render user profiles */}
      {profiles.map((profile, index) => (
        <div key={index} className="bg-slate-100 p-4 rounded shadow-md fade">
          <h2 className="text-xl font-bold">{profile.name} {profile.surname}</h2>
          <p>{profile.pricePerHour} per hour</p>
          <p>Available: {profile.availableHours} hours per day</p>
          <p>{profile.description.substring(0, 100)}...</p>
        </div>
      ))}
    </div>
  </div>
  <div className="p-4">
    <h1 className="text-2xl font-bold mb-4">Welcome to the Home Page</h1>
    <button onClick={goToProfile} className="bg-primary text-white py-2 px-4 rounded hover:bg-secondary">Profile</button>
  </div>
  <Footer/>
</div>
/* <div className="w-full min-h-screen bg-gradient-to-r from-cyan-950 to-cyan-700 flex"></div> */
  );
}