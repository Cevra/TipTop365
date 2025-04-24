"use client";

import React, { ChangeEvent, useState, useEffect } from "react";
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
import { getAuth } from "firebase/auth";
import { ServiceProvider } from "../models/User";
import { useAuth } from "@/contexts/AuthContext";
import "./styles.css"; // Import the new styles

interface SnackbarState {
  open: boolean;
  message: string;
  type: 'success' | 'error';
}

const ProfileDetails = () => {
  const router = useRouter();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<Partial<ServiceProvider>>({
    name: '',
    surname: '',
    phoneNumbers: [], 
    availability: {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [], 
      saturday: [],
      sunday: []
    },
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    },
    pricePerHour: 0,
    gender: 'other',
    description: '',
    location: {
      latitude: 0,
      longitude: 0
    },
    email: user?.email || '',
    services: [],
  });

  const [image, setImage] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState('');

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    type: 'success'
  });

  const handleMainFormDataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (e.target instanceof HTMLInputElement) {
      setFormData({...formData, [e.target.name]: e.target.value });
    } else if (e.target instanceof HTMLTextAreaElement) {
      setFormData({...formData, description: e.target.value });
    } else if (e.target instanceof HTMLSelectElement && e.target.name === 'gender') {
      setFormData({...formData, gender: e.target.value as 'male' | 'female' | 'other' });
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name?.trim()) {
      setSnackbar({
        open: true,
        message: 'Ime je obavezno polje',
        type: 'error'
      });
      return false;
    }

    if (!formData.surname?.trim()) {
      setSnackbar({
        open: true,
        message: 'Prezime je obavezno polje',
        type: 'error'
      });
      return false;
    }

    if (formData.phoneNumbers?.length === 0) {
      setSnackbar({
        open: true,
        message: 'Broj telefona je obavezno polje',
        type: 'error'
      });
      return false;
    }

    if (formData.address?.street === '' || formData.address?.city === '' || formData.address?.state === '' || formData.address?.zipCode === '') {
      setSnackbar({
        open: true,
        message: 'Adresa je obavezno polje',
        type: 'error'
      });
      return false;
    }

    if (!formData.gender) {
      setSnackbar({
        open: true,
        message: 'Spol je obavezno polje',
        type: 'error'
      });
      return false;
    }

    if (!formData.description?.trim()) {
      setSnackbar({
        open: true,
        message: 'Opis je obavezno polje',
        type: 'error'
      });
      return false;
    }

    if (formData.location?.latitude === 0 || formData.location?.longitude === 0) {
      setSnackbar({
        open: true,
        message: 'Lokacija je obavezno polje',
        type: 'error'
      });
      return false;
    }

    if (!formData.pricePerHour || Number(formData.pricePerHour) <= 0) {
      setSnackbar({
        open: true,
        message: 'Cijena po satu mora biti veća od 0',
        type: 'error'
      });
      return false;
    }

      if (!formData.availability) {
      setSnackbar({
        open: true,
        message: 'Dostupni termini su obavezno polje',
        type: 'error'
      });
      return false;
    }

    if (!formData.services || formData.services.length === 0) {
      setSnackbar({
        open: true,
        message: 'Morate odabrati barem jednu uslugu',
        type: 'error'
      });
      return false;
    }

    return true;
  };

  useEffect(() => {
    if (snackbar.open) {
      const timer = setTimeout(() => {
        setSnackbar(prev => ({ ...prev, open: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [snackbar.open]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (!user) {
      router.push('/login');
      return;
    }

    if (!validateForm()) {
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

      await addDoc(collection(db, "providers"), {
        ...formData,
        uid: user.uid,
        role: 'provider',
        image: finalImageUrl,
        createdAt: new Date(),
      });

      const auth = getAuth();
      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          role: 'provider'
        });
      }

      setSnackbar({
        open: true,
        message: 'Uspješno ste se registrovali kao čistač/ica!',
        type: 'success'
      });

      router.push('/provider-dashboard');
    } catch (error) {
      console.error("Error creating provider profile: ", error);
      setSnackbar({
        open: true,
        message: 'Došlo je do greške prilikom registracije',
        type: 'error'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Centered Snackbar */}
      {snackbar.open && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div
            className={`${
              snackbar.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } text-white px-6 py-3 rounded-lg shadow-lg text-center max-w-sm mx-4`}
          >
            {snackbar.message}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="profile-form max-w-2xl mx-auto px-6 py-8 rounded-lg shadow-md">
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
              placeholder="Name"
              onChange={handleMainFormDataChange}
              required
              className="form-input-custom"
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
              placeholder="Surname"
              onChange={handleMainFormDataChange}
              required
              className="form-input-custom"
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
              placeholder="Phone Number"
              onChange={handleMainFormDataChange}
              required
              className="form-input-custom"
            />
          </div>

          <div className="form-group">
            <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
              Profile Image
            </label>
            <input
              type="file"
              id="image"
              onChange={handleChange}
              className="block w-full text-sm text-gray-500 
                file:mr-4 file:py-2 file:px-4 
                file:rounded-full file:border-0 
                file:text-sm file:font-semibold 
                file:bg-indigo-50 file:text-indigo-700 
                hover:file:bg-indigo-100"
            />
            {uploadProgress > 0 && (
              <div className="mt-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="mt-1 text-sm text-gray-500">{uploadProgress}% Uploaded</p>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              id="address"
              name="address"
              placeholder="Address"
              onChange={handleMainFormDataChange}
              required
              className="form-input-custom"
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
              className="form-input-custom"
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              placeholder="Tell us about yourself"
              onChange={handleMainFormDataChange}
              required
              rows={4}
              className="form-input-custom"
            ></textarea>
          </div>

          <div className="form-group">
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              placeholder="Your location"
              onChange={handleMainFormDataChange}
              required
              className="form-input-custom"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleMainFormDataChange}
              required
              disabled
              className="form-input-custom bg-gray-50"
            />
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
              className="form-input-custom"
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
              className="form-input-custom"
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
              className="form-input-custom h-32"
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
            className="submit-button-custom"
          >
            Register as Provider
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileDetails;
