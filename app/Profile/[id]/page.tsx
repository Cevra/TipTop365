'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { Profile } from '@/app/models/Profile';
import NavBar from '@/app/components/NavBar';
import Footer from '@/app/components/Footer';

export default function ProfilePage() {
  const params = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!params.id) return;
      
      try {
        const docRef = doc(db, 'profiles', params.id as string);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const profileData = docSnap.data() as Profile;
          setProfile(profileData);
        } else {
          console.log("No such profile!");
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [params.id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!profile) {
    return <div>Profile not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="relative w-full aspect-[4/3] mb-6">
            {profile.image && (
              <img
                src={profile.image}
                alt={`${profile.name} ${profile.surname}`}
                className="rounded-lg object-cover w-full h-full"
              />
            )}
          </div>
          
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            {profile.name} {profile.surname}
          </h1>
          
          <div className="grid gap-4">
            <p><strong>Phone:</strong> {profile.phoneNumbers}</p>
            <p><strong>Available Hours:</strong> {profile.availableHours}</p>
            <p><strong>Address:</strong> {profile.address}</p>
            <p><strong>Price per Hour:</strong> {profile.pricePerHour}</p>
            <p><strong>Gender:</strong> {profile.gender}</p>
            <p><strong>Description:</strong> {profile.description}</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
} 