"use client";

import React, { ChangeEvent, useState } from "react";
import { storage } from "@/firebaseConfig";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTaskSnapshot,
} from "firebase/storage";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { useRouter } from "next/navigation";
import { ServiceProvider } from "../models/User";
import { useAuth } from "@/contexts/AuthContext";

const BecomeProvider = () => {
  const router = useRouter();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<Partial<ServiceProvider>>({
    name: '',
    surname: '',
    phoneNumbers: '',
    availableHours: '',
    address: '',
    pricePerHour: '',
    gender: '',
    description: '',
    location: '',
    email: user?.email || '',
    image: '',
    services: [],
  });

  const [image, setImage] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleMainFormDataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({...formData, [e.target.name]: e.target.value });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      let finalImageUrl = '';
      
      if (image) {
        const storageRef = ref(storage, `provider-images/${user.uid}/${image.name}`);
        const uploadTask = uploadBytesResumable(storageRef, image);
        
        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot: UploadTaskSnapshot) => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadProgress(progress);
            },
            reject,
            async () => {
              finalImageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(finalImageUrl);
            }
          );
        });
      }

      // Create provider profile
      await addDoc(collection(db, "providers"), {
        ...formData,
        uid: user.uid,
        role: 'provider',
        image: finalImageUrl,
        createdAt: new Date(),
      });

      // Update user role
      await updateDoc(doc(db, "users", user.uid), {
        role: 'provider'
      });

      router.push('/provider-dashboard');
    } catch (error) {
      console.error("Error becoming provider: ", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-8 bg-white rounded-lg shadow-md">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Become a Service Provider
        </h2>
        
        <div className="space-y-6">
          <div className="form-group">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Enter your name"
              onChange={handleMainFormDataChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
            />
          </div>

          <div className="form-group">
            <label htmlFor="surname" className="block text-sm font-medium text-gray-700 mb-1">
              Surname
            </label>
            <input
              type="text"
              id="surname"
              name="surname"
              placeholder="Enter your surname"
              onChange={handleMainFormDataChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumbers" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumbers"
              name="phoneNumbers"
              placeholder="Enter your phone number"
              onChange={handleMainFormDataChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
            />
          </div>

          <div className="form-group">
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              placeholder="Enter your location"
              onChange={handleMainFormDataChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
            />
          </div>

          <div className="form-group">
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              onChange={handleMainFormDataChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              placeholder="Describe your experience and services"
              onChange={handleMainFormDataChange}
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
            />
          </div>

          <div className="form-group">
            <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
              Profile Image
            </label>
            <input
              type="file"
              id="image"
              accept="image/*"
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
            />
            {uploadProgress > 0 && (
              <div className="mt-2">
                <div className="bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-[#02404B] h-2.5 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="pricePerHour" className="block text-sm font-medium text-gray-700 mb-1">
              Price per Hour (BAM)
            </label>
            <input
              type="number"
              id="pricePerHour"
              name="pricePerHour"
              placeholder="Enter your hourly rate"
              onChange={handleMainFormDataChange}
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
            />
          </div>

          <div className="form-group">
            <label htmlFor="availableHours" className="block text-sm font-medium text-gray-700 mb-1">
              Available Hours
            </label>
            <input
              type="text"
              id="availableHours"
              name="availableHours"
              placeholder="e.g., Mon-Fri 9AM-5PM"
              onChange={handleMainFormDataChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
            />
          </div>

          <div className="form-group">
            <label htmlFor="services" className="block text-sm font-medium text-gray-700 mb-1">
              Services Offered
            </label>
            <select
              multiple
              id="services"
              name="services"
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setFormData(prev => ({ ...prev, services: selected }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#02404B] focus:border-[#02404B] h-32"
            >
              <option value="regular-cleaning">Regular Cleaning</option>
              <option value="deep-cleaning">Deep Cleaning</option>
              <option value="window-cleaning">Window Cleaning</option>
              <option value="move-in-out">Move In/Out Cleaning</option>
              <option value="office-cleaning">Office Cleaning</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">Hold Ctrl/Cmd to select multiple services</p>
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 text-lg font-semibold text-white bg-[#02404B] rounded-md hover:bg-opacity-90 transition-opacity"
          >
            Register as Provider
          </button>
        </div>
      </form>
    </div>
  );
};

export default BecomeProvider; 