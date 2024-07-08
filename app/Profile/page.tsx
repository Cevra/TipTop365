
"use client";

import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from '@/firebaseConfig'; // Adjust the path based on your project structure
import { Profile } from '../models/Profile'; // Import the Profile interface
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { auth } from '@/firebaseConfig'; // Adjust the path based on your project structure
import { useRouter } from 'next/navigation';
import NavBar from '../components/NavBar';
import { storage } from '@/firebaseConfig';
import { ref, getDownloadURL } from "firebase/storage";


const UserProfile = () => {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [services, setServices] = useState([{ type: '', price: '' }]);
  const [imageUrl, setImageUrl] = useState<string>(''); // State to hold the image URL

  useEffect(() => {
    const fetchProfile = async () => {
      const auth = getAuth();
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const uid = user.uid;
          const q = query(collection(db, "profiles"), where("uid", "==", uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const profileData = querySnapshot.docs[0].data() as Profile;
            setProfile(profileData);

            // Fetch the image URL from Firebase Storage
            const imagePath = profileData.image; // Assuming 'image' is the field storing the image path
            if (imagePath) {
              const imageRef = ref(storage, imagePath);
              getDownloadURL(imageRef).then((url) => {
                setImageUrl(url); // Update the image URL state
              }).catch((error) => {
                console.error('Failed to fetch image URL:', error);
              });
            }
          } else {
           // router.push('/ProfileDetails');
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
  const addService = () => {
    setServices([...services, { type: '', price: '' }]);
  };
  
  // const handleServiceChange = (
  //   index: number,
  //   e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  // ) => {
  //   const { name, value } = e.target;
  //   const updatedServices = [...formData.services];
  //   updatedServices[index][name] = value;
  //   setFormData({...formData, services: updatedServices });
  // };

  return (
    <div className="max-w-md bg-white  shadow-md overflow-hidden ">
      <NavBar/>

      <div className="md:flex justify-center items-center">
      <div className="items-center">
          {imageUrl && <img src={imageUrl} alt="Your Profile" />}
        </div>
        <div className="p-8">
          <div className="text-center uppercase tracking-wide text-sm text-indigo-500 font-semibold">{profile.name}'s Profile</div>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.surname}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.phoneNumbers}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.availableHours}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.address}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.pricePerHour}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.gender}</p>
          <p className="mt-2 text-center text-gray-500 font-bold">{profile.description}</p>
          {services.map((service, index) => (
  <div key={index} className="form-group mb-4">
    <label htmlFor={`serviceType-${index}`} className="form-label block text-sm font-medium text-gray-700">
      Service Type {index + 1}
    </label>
    <select
      id={`serviceType-${index}`}
      name="type"
      value={service.type}
     // onChange={(event) => handleServiceChange(index, event)}
      required
      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    >
      <option value="">Select a Service</option>
      <option value="deep cleaning of apartment">Deep Cleaning of Apartment</option>
      <option value="gardening">Gardening</option>
      <option value="wardrobe cleaning">Wardrobe Cleaning</option>
    </select>
    <label htmlFor={`servicePrice-${index}`} className="form-label block text-sm font-medium text-gray-700">
      Custom Price
    </label>
    <input
      type="number"
      id={`servicePrice-${index}`}
      name="price"
      placeholder="Custom Price"
      //onChange={(event) => handleServiceChange(index, event)}
      required
      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    />
    <button
  type="button"
  onClick={addService}
  className="add-service-button bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
>
  Add Another Service
</button>

  </div>
  
))}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;