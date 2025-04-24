"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, setDoc, collection } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/firebaseConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Address } from "@/app/models/Address";

interface UserProfile {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
  profileImageUrl?: string;
  role?: 'user' | 'provider';
  createdAt?: Date;
  addressId?: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  type: 'success' | 'error';
}

const ProfileEditPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Form state
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [address, setAddress] = useState<Address>({
    street: '',
    houseNumber: '',
    floor: '',
    apartment: '',
    postalCode: '',
    city: '',
    state: '',
    country: 'Bosna i Hercegovina',
    additionalInfo: '',
  });

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    type: 'success'
  });

  // Validation functions
  const validateName = (name: string): boolean => {
    return name.length >= 3 && name.length <= 20;
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^\+3876[0-9]{7}$/;
    return phoneRegex.test(phone);
  };

  const validateStreet = (street: string): boolean => {
    return street.length > 0 && street.length <= 30;
  };

  const validateHouseNumber = (number: string): boolean => {
    return number.length > 0 && number.length <= 5;
  };

  const validateFloor = (floor: string): boolean => {
    return floor.length <= 5;
  };

  const validateApartment = (apartment: string): boolean => {
    return apartment.length <= 5;
  };

  const validatePostalCode = (code: string): boolean => {
    return /^\d{5}$/.test(code);
  };

  const validateCity = (city: string): boolean => {
    return city.length >= 3 && city.length <= 20;
  };

  const validateAdditionalInfo = (info: string): boolean => {
    return info.length >= 3 && info.length <= 30 || info.length === 0;
  };

  useEffect(() => {
    const fetchProfileAndAddress = async () => {
      if (!params.id) return;

      // Redirect if not authorized
      if (user?.uid !== params.id) {
        router.push(`/profile/${params.id}`);
        return;
      }

      try {
        const userRef = doc(db, "users", params.id as string);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data() as UserProfile;
          setProfile(userData);
          setFormData(userData);

          // Fetch address if addressId exists
          if (userData.addressId) {
            const addressRef = doc(db, "address", userData.addressId);
            const addressSnap = await getDoc(addressRef);
            if (addressSnap.exists()) {
              setAddress(addressSnap.data() as Address);
            }
          }
        } else {
          router.push(`/profile/${params.id}`);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Greška pri učitavanju profila");
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndAddress();
  }, [params.id, user, router]);

  useEffect(() => {
    if (snackbar.open) {
      const timer = setTimeout(() => {
        setSnackbar(prev => ({ ...prev, open: false }));
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [snackbar.open]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'phoneNumber') {
      // Only allow numbers and limit to 7 digits after +3876
      const numbersOnly = value.replace(/[^\d]/g, '');
      if (numbersOnly.length <= 7) {
        setFormData(prev => ({
          ...prev,
          [name]: `+3876${numbersOnly}`
        }));
      }
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfileImage(e.target.files[0]);
    }
  };

  const handleAddressChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Apply specific validations
    switch (name) {
      case 'street':
        if (value.length > 30) return;
        break;
      case 'houseNumber':
      case 'floor':
      case 'apartment':
        if (value.length > 5) return;
        break;
      case 'postalCode':
        if (!/^\d*$/.test(value) || value.length > 5) return;
        break;
      case 'city':
        if (value.length > 20) return;
        break;
      case 'additionalInfo':
        if (value.length > 30) return;
        break;
    }

    setAddress(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): boolean => {
    // Required fields validation
    if (!validateName(formData.firstName || '')) {
      setSnackbar({
        open: true,
        message: "Ime mora imati između 3 i 20 karaktera",
        type: 'error'
      });
      return false;
    }

    if (!validateName(formData.lastName || '')) {
      setSnackbar({
        open: true,
        message: "Prezime mora imati između 3 i 20 karaktera",
        type: 'error'
      });
      return false;
    }

    if (formData.phoneNumber && !validatePhoneNumber(formData.phoneNumber)) {
      setSnackbar({
        open: true,
        message: "Broj telefona mora biti u formatu +3876XXXXXXX",
        type: 'error'
      });
      return false;
    }

    // Address validations
    if (!validateStreet(address.street)) {
      setSnackbar({
        open: true,
        message: "Ulica je obavezna i ne može biti duža od 30 karaktera",
        type: 'error'
      });
      return false;
    }

    if (!validatePostalCode(address.postalCode)) {
      setSnackbar({
        open: true,
        message: "Poštanski broj mora imati tačno 5 brojeva",
        type: 'error'
      });
      return false;
    }

    if (!validateCity(address.city)) {
      setSnackbar({
        open: true,
        message: "Grad mora imati između 3 i 20 karaktera",
        type: 'error'
      });
      return false;
    }

    // Optional field validations - only validate if a value is provided
    if (address.additionalInfo && !validateAdditionalInfo(address.additionalInfo)) {
      setSnackbar({
        open: true,
        message: "Dodatne informacije moraju imati između 3 i 30 karaktera",
        type: 'error'
      });
      return false;
    }

    if (address.floor && !validateFloor(address.floor)) {
      setSnackbar({
        open: true,
        message: "Sprat ne može biti duži od 5 karaktera",
        type: 'error'
      });
      return false;
    }

    if (address.apartment && !validateApartment(address.apartment)) {
      setSnackbar({
        open: true,
        message: "Broj stana ne može biti duži od 5 karaktera",
        type: 'error'
      });
      return false;
    }

    if (address.houseNumber && !validateHouseNumber(address.houseNumber)) {
      setSnackbar({
        open: true,
        message: "Kućni broj ne može biti duži od 5 karaktera",
        type: 'error'
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (!validateForm()) {
      return;
    }

    try {
      // Prepare update data
      const updateData: Partial<UserProfile> = {
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        phoneNumber: formData.phoneNumber,
      };

      // Handle profile image
      if (profileImage) {
        const storageRef = ref(storage, `profile-images/${user.uid}/${profileImage.name}`);
        const uploadTask = uploadBytesResumable(storageRef, profileImage);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            reject,
            async () => {
              const imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              updateData.profileImageUrl = imageUrl;
              resolve(imageUrl);
            }
          );
        });
      }

      // Handle address
      try {
        if (profile.addressId) {
          // Update existing address
          await updateDoc(doc(db, "address", profile.addressId), {
            street: address.street,
            houseNumber: address.houseNumber,
            floor: address.floor,
            apartment: address.apartment,
            postalCode: address.postalCode,
            city: address.city,
            additionalInfo: address.additionalInfo
          });
          updateData.addressId = profile.addressId;
        } else {
          // Create new address
          const addressRef = collection(db, "address");
          const newAddressRef = doc(addressRef);
          await setDoc(newAddressRef, address);
          updateData.addressId = newAddressRef.id;
        }
      } catch (err) {
        console.error("Error handling address:", err);
        throw err;
      }

      // Update user profile
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, updateData);

      setSnackbar({
        open: true,
        message: "Profil uspješno ažuriran!",
        type: 'success'
      });

      // Redirect back to profile page
      router.push(`/profile/${params.id}`);
    } catch (err) {
      console.error("Error updating profile:", err);
      setSnackbar({
        open: true,
        message: "Greška pri ažuriranju profila. Pokušajte ponovo.",
        type: 'error'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#02404B]"></div>
      </div>
    );
  }

  // Update the input classes with lighter placeholder color
  const inputClasses = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#02404B] focus:ring-[#02404B] sm:text-sm placeholder:text-gray-400";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Snackbar */}
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        snackbar.open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
      }`}>
        <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          snackbar.type === 'success' 
            ? 'bg-[#02404B] text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {snackbar.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="font-medium">{snackbar.message}</span>
        </div>
      </div>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg">
          {/* Back button section */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <button
              onClick={() => router.push(`/profile/${params.id}`)}
              className="inline-flex items-center text-[#02404B] hover:text-opacity-80"
            >
              <svg 
                className="w-5 h-5 mr-1" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Nazad na profil
            </button>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Uredi Profil</h1>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6">
            {/* Profile Image Section */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profilna Slika
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {(profileImage ? URL.createObjectURL(profileImage) : profile?.profileImageUrl) ? (
                    <img 
                      src={profileImage ? URL.createObjectURL(profileImage) : profile?.profileImageUrl}
                      alt="Profilna Slika" 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl text-gray-500">
                      {profile?.email?.charAt(0)?.toUpperCase() || "K"}
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-[#02404B] file:text-white
                    hover:file:bg-opacity-90"
                />
              </div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-2 w-full">
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-2 bg-[#02404B] rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Personal Information */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ime
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName || ''}
                    onChange={handleInputChange}
                    placeholder="Unesite vaše ime"
                    className={inputClasses}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prezime
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName || ''}
                    onChange={handleInputChange}
                    placeholder="Unesite vaše prezime"
                    className={inputClasses}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Broj Telefona
                </label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={formData.phoneNumber || ''}
                  onChange={handleInputChange}
                  placeholder="+38761234567"
                  className={inputClasses}
                  required
                />
              </div>
            </div>

            {/* Address Information */}
            <div className="mt-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Adresa</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ulica
                  </label>
                  <input
                    type="text"
                    name="street"
                    value={address.street}
                    onChange={handleAddressChange}
                    placeholder="Naziv ulice"
                    className={inputClasses}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kućni Broj
                  </label>
                  <input
                    type="text"
                    name="houseNumber"
                    value={address.houseNumber}
                    onChange={handleAddressChange}
                    placeholder="Broj"
                    className={inputClasses}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sprat
                  </label>
                  <input
                    type="text"
                    name="floor"
                    value={address.floor}
                    onChange={handleAddressChange}
                    placeholder="Sprat (opcionalno)"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stan
                  </label>
                  <input
                    type="text"
                    name="apartment"
                    value={address.apartment}
                    onChange={handleAddressChange}
                    placeholder="Broj stana (opcionalno)"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Poštanski Broj
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={address.postalCode}
                    onChange={handleAddressChange}
                    placeholder="71000"
                    className={inputClasses}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grad
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={address.city}
                    onChange={handleAddressChange}
                    placeholder="Naziv grada"
                    className={inputClasses}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dodatne Informacije
                  </label>
                  <input
                    type="text"
                    name="additionalInfo"
                    value={address.additionalInfo}
                    onChange={handleAddressChange}
                    placeholder="Npr. 'Interfon ne radi', 'Pozvati na mobitel'"
                    className={inputClasses}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row-reverse sm:justify-start gap-3">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2 bg-[#02404B] text-white rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors"
                >
                  Sačuvaj Promjene
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/profile/${params.id}`)}
                  className="w-full sm:w-auto px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Odustani
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ProfileEditPage; 