// components/ProfileForm.js

"use client";
import React, { ChangeEvent, useState } from "react";
import { storage } from "@/firebaseConfig";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTaskSnapshot,
} from "firebase/storage";

import { collection, addDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig"; // Adjust the path based on your project structure
import "./ProfileForm.css";
import { TimePicker } from 'react-time-picker';
// import 'react-time-picker/dist/TimePicker.css';
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { FormData } from "../models/Profile";
import ImageUpload from "../uplaodImage/page";

const ProfileForm = () => {
  const router = useRouter();
 const [formData, setFormData] = useState<FormData>({
  name: '',
  surname: '',
  phoneNumbers: '',
  availableHours: '',
  address: '',
  pricePerHour: '',
  gender: '',
  description: '',
  location: '',
  email: '',
  image: '',
  jobTitle: '',
  //services: [{ type: '', price: '' }], // Initialize with an empty service object
});

  const handleMainFormDataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (e.target instanceof HTMLInputElement) {
      setFormData({...formData, [e.target.name]: e.target.value });
    } else if (e.target instanceof HTMLTextAreaElement) {
      setFormData({...formData, description: e.target.value });
    } else if (e.target instanceof HTMLSelectElement && e.target.name === 'gender') {
      setFormData({...formData, gender: e.target.value });
    }
  };
  
  const [image, setImage] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (image) {
      const storageRef = ref(storage, `images/${image.name}`);
      const uploadTask = uploadBytesResumable(storageRef, image);
      uploadTask.on(
        "state_changed",
        (snapshot: UploadTaskSnapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (error) => {
          console.log(error.message);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setImageUrl(url);
          // Update formData.image with the URL
          setFormData({...formData, image: url });
          // Proceed with form submission
          try {
            const auth = getAuth();
            const user = auth.currentUser; // Get the current user
            if (user) {
              const uid = user.uid; // Get the user's UID
              const docRef = await addDoc(collection(db, "profiles"), {
               ...formData,
                uid,
                image: imageUrl
              }); // Include the UID in the data
              // router.push(`/Profile/${docRef.id}`); // Navigate to the profile page
              router.push(`/Profile`); // Navigate to the profile page

            } else {
              console.error("No user is signed in.");
            }
          } catch (e) {
            console.error("Error adding document: ", e);
          }
        }
      );
    } else {
      // If no image is selected, proceed with form submission without uploading an image
      try {
        const auth = getAuth();
        const user = auth.currentUser; // Get the current user
        if (user) {
          const uid = user.uid; // Get the user's UID
          const docRef = await addDoc(collection(db, "profiles"), {
           ...formData,
            uid,
          }); // Include the UID in the data
          // router.push(`/Profile/${docRef.id}`); // Navigate to the profile page
          router.push(`/Profile`); // Navigate to the profile page

        } else {
          console.error("No user is signed in.");
        }
      } catch (e) {
        console.error("Error adding document: ", e);
      }
    }
  };
  

  return (
    <form onSubmit={handleSubmit} className="profile-form mx-auto max-w-md">
      <h2 className="form-title text-center text-2xl font-bold mb-6">
        Create Your Profile
      </h2>
      <div className="form-group mb-4">
        <label
          htmlFor="name"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          placeholder="Name"
          onChange={handleMainFormDataChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="surname"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Surname
        </label>
        <input
          type="text"
          id="surname"
          name="surname"
          placeholder="Surname"
          onChange={handleMainFormDataChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="phoneNumbers"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Phone Number
        </label>
        <input
          type="tel"
          id="phoneNumbers"
          name="phoneNumbers"
          placeholder="Phone Number"
          onChange={handleMainFormDataChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />

      </div>
      <div className="form-group mb-4">
        <label htmlFor="image" className="form-label block text-sm font-medium text-gray-700">
          Upload Image
        </label>
        <input type="file" id="image" onChange={handleChange} className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        {uploadProgress > 0 && <p>{uploadProgress}% Uploaded</p>}
      </div>

      <div className="form-group mb-4">
        <label
          htmlFor="address"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Address
        </label>
        <input
          type="text"
          id="address"
          name="address"
          placeholder="Address"
          onChange={handleMainFormDataChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      {/* <div className="form-group mb-4">
        <label
          htmlFor="pricePerHour"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Price Per Hour
        </label>
        <input
          type="number"
          id="pricePerHour"
          name="pricePerHour"
          placeholder="Price Per Hour"
          onChange={handleMainFormDataChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        /> 
      </div>*/}
      <div className="form-group mb-4">
        <label
          htmlFor="gender"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Gender
        </label>
        <select
          id="gender"
          name="gender"
          onChange={handleMainFormDataChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>
      {/* <div className="form-group mb-4">
        <label
          htmlFor="jobTitle"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Job Title
        </label>
        <input
          type="text"
          id="jobTitle"
          name="jobTitle"
          placeholder="Job Title"
          onChange={handleMainFormDataChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div> */}
      <div className="form-group mb-4">
        <label
          htmlFor="description"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Description for Profile
        </label>
        <textarea
          id="description"
          name="description"
          placeholder="Description for Profile"
          onChange={handleMainFormDataChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        ></textarea>
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="location"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Location
        </label>
        <input
          type="text"
          id="location"
          name="location"
          placeholder="Location"
          onChange={handleMainFormDataChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="email"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="Email"
          onChange={handleMainFormDataChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <button
        type="submit"
        className="submit-button bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-full"
        
      >
        Submit
      </button>
    </form>
  );
};

export default ProfileForm;
