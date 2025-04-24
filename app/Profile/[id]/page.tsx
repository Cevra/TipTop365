"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { useParams } from "next/navigation";
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
    country: '',
    additionalInfo: '',
  });

  // Error messages in Bosnian
  const errorMessages = {
    profileNotFound: "Profil nije pronađen",
    loadingError: "Greška pri učitavanju profila",
    updateError: "Greška pri ažuriranju profila",
    imageUploadError: "Greška pri učitavanju slike",
  };

  const checkFormCompleteness = () => {
    const essentialFields = {
      profile: ['firstName', 'lastName', 'phoneNumber'],
      address: ['street', 'houseNumber', 'postalCode', 'city', 'country']
    };

    const profileComplete = essentialFields.profile.every(field => formData[field as keyof typeof formData]);
    const addressComplete = essentialFields.address.every(field => address[field as keyof Address]);

    return profileComplete && addressComplete;
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

          // Fetch address if exists
          if (userData.address) {
            const addressRef = doc(db, "addresses", userData.address);
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

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfileImage(e.target.files[0]);
    }
  };

  const handleAddressChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAddress(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

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
        if (profile.addressId) {
          // Update existing address
          await updateDoc(doc(db, "addresses", profile.addressId), {
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
          // Create new address
          const addressesRef = collection(db, "addresses");
          const newAddressRef = doc(addressesRef);
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
      }

      // Update user profile
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, updateData);

      // Update local state
      setProfile(prev => ({
        ...prev!,
        ...updateData
      }));
      
      setIsEditing(false);
      setUploadProgress(0);
      
      alert("Profil uspješno ažuriran!");
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Greška pri ažuriranju profila");
      alert("Greška pri ažuriranju profila. Pokušajte ponovo.");
    }
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
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
          {!isEditing ? (
            // Profile View
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {profile?.profileImageUrl ? (
                      <img 
                        src={profile.profileImageUrl} 
                        alt="Profilna Slika" 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl text-gray-500">
                        {profile?.email?.charAt(0)?.toUpperCase() || "K"}
                      </span>
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {profile?.firstName ? `${profile.firstName} ${profile.lastName}` : 'Novi Korisnik'}
                    </h1>
                    <p className="text-gray-500">{profile?.email}</p>
                  </div>
                </div>
                {user?.uid === params.id && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-[#02404B] text-white rounded-md hover:bg-opacity-90"
                  >
                    Uredi Profil
                  </button>
                )}
              </div>

              <div className="grid gap-4">
                <div className="border-b pb-4">
                  <h2 className="text-lg font-semibold mb-2">Kontakt Informacije</h2>
                  <p><strong>Email:</strong> {profile?.email}</p>
                  {profile?.phoneNumber && (
                    <p><strong>Telefon:</strong> {profile.phoneNumber}</p>
                  )}
                  {address && (
                    <div>
                      <p><strong>Adresa:</strong></p>
                      <p>{address.street} {address.houseNumber}</p>
                      {address.floor && <p>Sprat: {address.floor}</p>}
                      {address.apartment && <p>Stan: {address.apartment}</p>}
                      <p>{address.postalCode} {address.city}</p>
                      <p>{address.country}</p>
                      {address.additionalInfo && (
                        <p><strong>Dodatne informacije:</strong> {address.additionalInfo}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            // Edit Form
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="relative h-20 w-20">
                  <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {(profileImage ? URL.createObjectURL(profileImage) : profile?.profileImageUrl) ? (
                      <img 
                        src={profileImage ? URL.createObjectURL(profileImage) : profile?.profileImageUrl} 
                        alt="Pregled Profilne Slike" 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl text-gray-500">
                        {profile?.email?.charAt(0)?.toUpperCase() || "K"}
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2">Uredi Profil</h2>
                  <p className="text-sm text-gray-500">Klikni na sliku za promjenu profilne fotografije</p>
                </div>
              </div>

              {uploadProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                  <div 
                    className="bg-[#02404B] h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ime
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName || ''}
                    onChange={handleInputChange}
                    placeholder="Unesite ime"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prezime
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName || ''}
                    onChange={handleInputChange}
                    placeholder="Unesite prezime"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Broj Telefona
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber || ''}
                    onChange={handleInputChange}
                    placeholder="npr. +387 61 123 456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                  />
                </div>

                {/* Address Fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ulica
                  </label>
                  <input
                    type="text"
                    name="street"
                    value={address.street}
                    onChange={handleAddressChange}
                    placeholder="Naziv ulice"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kućni Broj
                  </label>
                  <input
                    type="text"
                    name="houseNumber"
                    value={address.houseNumber}
                    onChange={handleAddressChange}
                    placeholder="npr. 15A"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sprat
                  </label>
                  <input
                    type="text"
                    name="floor"
                    value={address.floor || ''}
                    onChange={handleAddressChange}
                    placeholder="npr. 3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Broj Stana
                  </label>
                  <input
                    type="text"
                    name="apartment"
                    value={address.apartment || ''}
                    onChange={handleAddressChange}
                    placeholder="npr. 24"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Poštanski Broj
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={address.postalCode}
                    onChange={handleAddressChange}
                    placeholder="npr. 71000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grad
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={address.city}
                    onChange={handleAddressChange}
                    placeholder="npr. Sarajevo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Država
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={address.country}
                    onChange={handleAddressChange}
                    placeholder="npr. Bosna i Hercegovina"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dodatne Informacije
                  </label>
                  <input
                    type="text"
                    name="additionalInfo"
                    value={address.additionalInfo || ''}
                    onChange={handleAddressChange}
                    placeholder="npr. Interfon ne radi"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#02404B] focus:border-[#02404B]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#02404B] text-white rounded-md hover:bg-opacity-90"
                >
                  Sačuvaj Promjene
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProfilePage; 