
"use client";

import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from '@/firebaseConfig'; // Adjust the path based on your project structure
import { Profile } from '../models/Profile'; // Import the Profile interface
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { auth } from '@/firebaseConfig'; // Adjust the path based on your project structure
import { useRouter } from 'next/navigation';
import NavBar from '../components/NavBar';
import Image from 'next/image';

const UserProfile = () => {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const auth = getAuth();
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          // Assuming you have a way to get the uid from the user object or another source
          const uid = user.uid; // This should be the uid you want to use to fetch the profile
          const q = query(collection(db, "profiles"), where("uid", "==", uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const profileData = querySnapshot.docs[0].data() as Profile;
            setProfile(profileData);
          } else {
    router.push('/ProfileDetails');

            console.log("No such document!");
          }
        } else {
          console.log("User is signed out!");
        }
      });
    };

    fetchProfile();
  }, []);
  if (!profile) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-md bg-white  shadow-md overflow-hidden ">
      <NavBar/>

      <div className="md:flex justify-center items-center">
        <div className=" items-center">
        <Image src="/path/to/image.jpg" alt="Description" width={500} height={300} />        </div>
        <div className="p-8">
          <div className="text-center uppercase tracking-wide text-sm text-indigo-500 font-semibold">{profile.name}'s Profile</div>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.surname}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.phoneNumbers}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.availableHours}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.address}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.pricePerHour}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.gender}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.description}</p>
          {/* Add more fields as necessary */}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;