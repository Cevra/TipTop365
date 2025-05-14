'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, getDoc, doc } from "firebase/firestore";
import { db } from '@/firebaseConfig';
import HeroSection from './components/HeroSection';
import ServiceGrid from './components/ServiceGrid';
import { useAuth } from '@/contexts/AuthContext';
import { ServiceProvider } from './models/ServiceProvider';

export default function Home() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        console.log("Starting to fetch providers...");
        
        // Fetch from providers collection directly
        const providersRef = collection(db, "providers");
        const providersSnapshot = await getDocs(providersRef);
        
        console.log("Found providers:", providersSnapshot.size);

        const providersData = providersSnapshot.docs.map(doc => {
          const data = doc.data();
          console.log("Provider data:", data);
          
          return {
            uid: doc.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            profileImageUrl: data.profileImageUrl || '',
            description: data.description || '',
            services: data.services || [],
            phoneNumber: data.phoneNumber || '',
            pricePerHour: data.pricePerHour || 0,
            address: data.address || {},
            availability: data.availability || {},
            rating: data.rating || { average: 0, count: 0 },
            createdAt: data.createdAt,
            lastUpdated: data.lastUpdated
          } as ServiceProvider;
        });

        console.log("Final providers data:", providersData);
        setProviders(providersData);
      } catch (error) {
        console.error("Error fetching providers:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchProfiles();
    }
  }, [authLoading]);

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
      {providers.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-600">
            Trenutno nema dostupnih čistača
          </h2>
          <p className="mt-2 text-gray-500">
            Budite prvi koji će se pridružiti našoj platformi!
          </p>
        </div>
      ) : (
        <ServiceGrid providers={providers} />
      )}
    </div>
  );
}