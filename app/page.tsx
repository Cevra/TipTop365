'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, DocumentData } from "firebase/firestore";
import { db } from '@/firebaseConfig';
import { ProfileData } from './models/Profile';
import HeroSection from './components/HeroSection';
import ServiceGrid from './components/ServiceGrid';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const q = query(collection(db, "profiles"));
        const querySnapshot = await getDocs(q);
        const profilesData = querySnapshot.docs.map(doc => {
          const rawData = doc.data() as DocumentData;
          return rawData as ProfileData;
        });
        setProfiles(profilesData);
      } catch (error) {
        console.error("Error fetching profiles:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchProfiles();
    }
  }, [authLoading, router]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#02404B]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-inherit flex flex-col">
      <HeroSection />
      <ServiceGrid profiles={profiles} />
    </div>
  );
}