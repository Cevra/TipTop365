"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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

const ProfilePage = () => {
  const params = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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

  // Error messages in Bosnian
  const errorMessages = {
    profileNotFound: "Profil nije pronađen",
    loadingError: "Greška pri učitavanju profila",
    updateError: "Greška pri ažuriranju profila",
    imageUploadError: "Greška pri učitavanju slike",
  };

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
        } else if (user && user.uid === params.id) {
          const initialProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            role: 'user',
          };
          setProfile(initialProfile);
          setFormData(initialProfile);
        } else {
          setError(errorMessages.profileNotFound);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(errorMessages.loadingError);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndAddress();
  }, [params.id, user]);

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
      // Format phone number with +3876 prefix
      if (value.startsWith('+3876')) {
        // Allow only numbers after +3876 prefix and limit to total length of 12 (+3876 + 7 digits)
        const numbersOnly = value.replace(/[^\d+]/g, '');
        if (numbersOnly.length <= 12) {
          setFormData(prev => ({
            ...prev,
            [name]: numbersOnly
          }));
        }
      } else {
        // If user is typing a new number, add the prefix
        const numbersOnly = value.replace(/[^\d]/g, '');
        if (numbersOnly.length <= 7) {
          setFormData(prev => ({
            ...prev,
            [name]: `+3876${numbersOnly}`
          }));
        }
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
    if (address.street && !validateStreet(address.street)) {
      setSnackbar({
        open: true,
        message: "Ulica ne može biti duža od 30 karaktera",
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

    if (address.postalCode && !validatePostalCode(address.postalCode)) {
      setSnackbar({
        open: true,
        message: "Poštanski broj mora imati tačno 5 brojeva",
        type: 'error'
      });
      return false;
    }

    if (address.city && !validateCity(address.city)) {
      setSnackbar({
        open: true,
        message: "Grad mora imati između 3 i 20 karaktera",
        type: 'error'
      });
      return false;
    }

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
        message: "Broj sprata ne može biti duži od 5 karaktera",
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

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (!validateForm()) {
      return;
    }

    try {
      // Prepare update data starting with form data
      const updateData: Partial<UserProfile> = {
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
      };

      // Only include phoneNumber if it exists
      if (formData.phoneNumber) {
        updateData.phoneNumber = formData.phoneNumber;
      }

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
      } else if (profile.profileImageUrl) {
        // Keep existing profile image if there is one
        updateData.profileImageUrl = profile.profileImageUrl;
      }

      // Handle address
      const hasAddressData = Object.values(address).some(value => value !== '');
      if (hasAddressData) {
        try {
          if (profile.addressId) {
            // First check if the address document exists
            const addressDoc = await getDoc(doc(db, "address", profile.addressId));
            
            if (addressDoc.exists()) {
              // Update existing address
              await updateDoc(doc(db, "address", profile.addressId), {
                street: address.street || '',
                houseNumber: address.houseNumber || '',
                floor: address.floor || '',
                apartment: address.apartment || '',
                postalCode: address.postalCode || '',
                city: address.city || '',
                state: address.state || '',
                country: address.country || '',
                additionalInfo: address.additionalInfo || ''
              });
              updateData.addressId = profile.addressId;
            } else {
              // Create new address if the old one doesn't exist
              const addressRef = collection(db, "address");
              const newAddressRef = doc(addressRef);
              await setDoc(newAddressRef, {
                street: address.street || '',
                houseNumber: address.houseNumber || '',
                floor: address.floor || '',
                apartment: address.apartment || '',
                postalCode: address.postalCode || '',
                city: address.city || '',
                state: address.state || '',
                country: address.country || '',
                additionalInfo: address.additionalInfo || ''
              });
              updateData.addressId = newAddressRef.id;
            }
          } else {
            // Create new address
            const addressRef = collection(db, "address");
            const newAddressRef = doc(addressRef);
            await setDoc(newAddressRef, {
              street: address.street || '',
              houseNumber: address.houseNumber || '',
              floor: address.floor || '',
              apartment: address.apartment || '',
              postalCode: address.postalCode || '',
              city: address.city || '',
              state: address.state || '',
              country: address.country || '',
              additionalInfo: address.additionalInfo || ''
            });
            updateData.addressId = newAddressRef.id;
          }
        } catch (err) {
          console.error("Error handling address:", err);
          throw err;
        }
      }

      // Update user profile
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, updateData);

      // Update local state
      setProfile(prev => ({
        ...prev!,
        ...updateData
      }));
      
      setSnackbar({
        open: true,
        message: "Profil uspješno ažuriran!",
        type: 'success'
      });
      setIsEditing(false);
      setUploadProgress(0);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Greška pri ažuriranju profila");
      setSnackbar({
        open: true,
        message: "Greška pri ažuriranju profila. Pokušajte ponovo.",
        type: 'error'
      });
    }
  };

  const isProfileComplete = (): boolean => {
    if (!profile) return false;
    
    const requiredFields = [
      profile.firstName,
      profile.lastName,
      profile.phoneNumber,
      address.street,
      address.houseNumber,
      address.postalCode,
      address.city
    ];

    return requiredFields.every(field => field && field.trim() !== '');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#02404B]"></div>
      </div>
    );
  }

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

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-10 max-w-7xl mx-auto">
          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-6 sm:gap-0 mb-8 sm:mb-12">
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 sm:gap-10">
              <div className="relative group">
                <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden ring-4 ring-[#02404B]/10">
                  {profile?.profileImageUrl ? (
                    <img 
                      src={profile.profileImageUrl} 
                      alt="Profilna Slika" 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl sm:text-5xl text-gray-500">
                      {profile?.email?.charAt(0)?.toUpperCase() || "K"}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                  {profile?.firstName ? `${profile.firstName} ${profile.lastName}` : 'Novi Korisnik'}
                </h1>
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 text-base sm:text-lg text-gray-600">
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {profile?.email}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-full ${
                      isProfileComplete() 
                        ? 'bg-[#02404B]/10 text-[#02404B]'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {isProfileComplete() ? 'Profil popunjen' : 'Profil nije popunjen'}
                    </span>
                    <span className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-full ${
                      profile?.role === 'provider'
                        ? 'bg-[#02404B]/10 text-[#02404B]'
                        : 'bg-[#02404B]/5 text-[#02404B]'
                    }`}>
                      {profile?.role === 'provider' ? 'Čistač' : 'Korisnik'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {user && profile && user.uid === profile.uid && (
              <Link
                href={`/profile/${profile.uid}/edit`}
                className="relative inline-flex items-center gap-x-3 rounded-lg bg-[#02404B] px-8 sm:px-10 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-sm hover:bg-opacity-90 transition-colors w-full sm:w-auto justify-center"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Uredi Profil
              </Link>
            )}
          </div>

          {/* Profile Content */}
          <div className="grid gap-8 sm:gap-12">
            {/* Contact Information */}
            <div className="border-b pb-8 sm:pb-10">
              <h2 className="text-xl sm:text-2xl font-semibold mb-6 sm:mb-8 text-gray-900 flex items-center gap-3">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#02404B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Kontakt Informacije
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                {profile?.phoneNumber && (
                  <div className="bg-gray-50 p-6 sm:p-8 rounded-xl">
                    <span className="text-base sm:text-lg text-gray-500">Telefon</span>
                    <p className="text-lg sm:text-xl text-gray-900 font-medium mt-2">{profile.phoneNumber}</p>
                  </div>
                )}
                {profile?.email && (
                  <div className="bg-gray-50 p-6 sm:p-8 rounded-xl">
                    <span className="text-base sm:text-lg text-gray-500">Email</span>
                    <p className="text-lg sm:text-xl text-gray-900 font-medium mt-2">{profile.email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Address Information */}
            {address && (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-6 sm:mb-8 text-gray-900 flex items-center gap-3">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#02404B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Adresa
                </h2>
                <div className="bg-gray-50 p-6 sm:p-10 rounded-xl space-y-6 sm:space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                    <div>
                      <span className="text-base sm:text-lg text-gray-500">Ulica i broj</span>
                      <p className="text-lg sm:text-xl text-gray-900 font-medium mt-2">
                        {address.street} {address.houseNumber}
                      </p>
                    </div>
                    {(address.floor || address.apartment) && (
                      <div>
                        <span className="text-base sm:text-lg text-gray-500">Sprat/Stan</span>
                        <p className="text-lg sm:text-xl text-gray-900 font-medium mt-2">
                          {address.floor && `Sprat ${address.floor}`}
                          {address.floor && address.apartment && ', '}
                          {address.apartment && `Stan ${address.apartment}`}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-base sm:text-lg text-gray-500">Grad i poštanski broj</span>
                      <p className="text-lg sm:text-xl text-gray-900 font-medium mt-2">
                        {address.postalCode} {address.city}
                      </p>
                    </div>
                    <div>
                      <span className="text-base sm:text-lg text-gray-500">Država</span>
                      <p className="text-lg sm:text-xl text-gray-900 font-medium mt-2">{address.country}</p>
                    </div>
                  </div>
                  {address.additionalInfo && (
                    <div className="border-t pt-6 sm:pt-8 mt-6 sm:mt-8">
                      <span className="text-base sm:text-lg text-gray-500">Dodatne informacije</span>
                      <p className="text-lg sm:text-xl text-gray-900 mt-2">{address.additionalInfo}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage; 