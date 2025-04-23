'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react'; // Import useState
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { collection, getDocs, query, DocumentData } from "firebase/firestore"; // Import Firestore functions
import { db } from '@/firebaseConfig'; // Adjust the path based on your project structure
import { ProfileData } from './models/Profile';
import HeroSection from './components/HeroSection';
import ServiceGrid from './components/ServiceGrid';

export default function Home() {
  const router = useRouter();
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

  return (
    <div className="min-h-screen bg-inherit flex flex-col">
      <HeroSection />
      <ServiceGrid profiles={profiles} />
    </div>
  );
}