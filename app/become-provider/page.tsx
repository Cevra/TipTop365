"use client";

import React, { ChangeEvent, useState, useEffect } from "react";
import { storage } from "@/firebaseConfig";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTaskSnapshot,
} from "firebase/storage";
import { collection, addDoc, updateDoc, doc, getDocs } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { useRouter } from "next/navigation";
import { ServiceProvider } from "../models/User";
import { useAuth } from "@/contexts/AuthContext";

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface TimeSlot {
  start: string;
  end: string;
}

type Availability = {
  [K in DayOfWeek]: TimeSlot[];
};

interface SnackbarState {
  open: boolean;
  message: string;
  type: 'success' | 'error';
}

const BecomeProvider = () => {
  const router = useRouter();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<Partial<ServiceProvider>>({
      pricePerHour: 0,
      availability: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
      },
    services: [], 
    rating: { average: 0, count: 0 },
    languages: [],
    certifications: [], 
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
    },
    images: [],
    description: '',
    location: {
      latitude: 0,
      longitude: 0,
    },
  });

  const [documents, setDocuments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedServices, setSelectedServices] = useState<Array<{ id: string; name: string }>>([]);
  const [availability, setAvailability] = useState<Availability>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  });

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    type: 'success'
  });

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const servicesRef = collection(db, "services");
        await getDocs(servicesRef);
        const servicesData = [
          { id: 'airbnbCleaning', name: 'Airbnb Cleaning' },
          { id: 'apartmentCleaning', name: 'Apartment Cleaning' },
          { id: 'officeCleaning', name: 'Office Cleaning' },
          { id: 'windowCleaning', name: 'Window Cleaning' }
        ];
        setServices(servicesData);
      } catch (error) {
        console.error("Error fetching services: ", error);
      }
    };

    fetchServices();
  }, []);

  useEffect(() => {
    setFormData(prev => ({ ...prev, services: selectedServices }));
  }, [selectedServices]);

  const handleMainFormDataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'number' ? Number(value) : value;
    
    setFormData(prev => {
      const newState = {
        ...prev,
        [name]: finalValue
      };
      console.log('Updated formData:', newState); // Debug log
      return newState;
    });
  };

  const handleDocumentsChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(Array.from(e.target.files));
    }
  };

  // Validation functions
  const validateHourlyRate = (rate: number): boolean => {
    return rate > 0 && rate <= 100; // Reasonable range for hourly rate in BAM
  };

  const validateAvailability = (availability: Availability): boolean => {
    // Check if at least one day has time slots
    return Object.values(availability).some(slots => slots.length > 0);
  };

  const validateTimeSlots = (slots: TimeSlot[]): boolean => {
    return slots.every(slot => {
      const start = new Date(`1970-01-01T${slot.start}`);
      const end = new Date(`1970-01-01T${slot.end}`);
      return end > start;
    });
  };

  const validateServices = (services: Array<{ id: string; name: string }>): boolean => {
    return services.length > 0;
  };

  // Snackbar effect
  useEffect(() => {
    if (snackbar.open) {
      const timer = setTimeout(() => {
        setSnackbar(prev => ({ ...prev, open: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [snackbar.open]);

  const validateForm = (): boolean => {
    console.log('Current formData:', formData); // Debug log

    // Check hourly rate
    if (!formData.pricePerHour) {
      setSnackbar({
        open: true,
        message: 'Cijena po satu je obavezno polje',
        type: 'error'
      });
      return false;
    }

    if (!validateHourlyRate(formData.pricePerHour)) {
      setSnackbar({
        open: true,
        message: 'Cijena po satu mora biti između 1 i 100 BAM',
        type: 'error'
      });
      return false;
    }

    // Check availability
    if (!validateAvailability(availability)) {
      setSnackbar({
        open: true,
        message: 'Morate odabrati barem jedan termin dostupnosti',
        type: 'error'
      });
      return false;
    }

    // Validate time slots
    for (const [day, slots] of Object.entries(availability)) {
      if (slots.length > 0 && !validateTimeSlots(slots)) {
        setSnackbar({
          open: true,
          message: `Nevažeći termini za ${formatDayName(day)}`,
          type: 'error'
        });
        return false;
      }
    }

    // Check services
    if (!validateServices(selectedServices)) {
      setSnackbar({
        open: true,
        message: 'Morate odabrati barem jednu uslugu',
        type: 'error'
      });
      return false;
    }

    // Check description
    if (!formData.description?.trim()) {
      console.log('Description validation failed:', formData.description); // Debug log
      setSnackbar({
        open: true,
        message: 'Opis usluga je obavezno polje',
        type: 'error'
      });
      return false;
    }

    // Removed document validation
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (!user) {
      router.push('/login');
      return;
    }

    // Validate all required fields
    if (!validateForm()) {
      return;
    }

    try {
      const documentUrls: string[] = [];
      
      // Upload all documents
      if (documents.length > 0) {
        for (const document of documents) {
          const storageRef = ref(storage, `provider-documents/${user.uid}/${document.name}`);
          const uploadTask = uploadBytesResumable(storageRef, document);
          
          await new Promise((resolve, reject) => {
            uploadTask.on(
              "state_changed",
              (snapshot: UploadTaskSnapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                setUploadProgress(progress);
              },
              reject,
              async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                documentUrls.push(url);
                resolve(url);
              }
            );
          });
        }
      }

      // Filter out empty days before saving
      const filteredAvailability = Object.entries(availability).reduce((acc, [day, slots]) => {
        if (slots.length > 0) {
          acc[day as DayOfWeek] = slots;
        }
        return acc;
      }, {} as Availability);

      // Create provider profile
      await addDoc(collection(db, "providers"), {
        ...formData,
        availability: filteredAvailability,
        services: selectedServices,
        uid: user.uid,
        role: 'provider',
        documentsUrls: documentUrls,
        createdAt: new Date(),
        lastUpdated: new Date(),
      });

      // Update user role
      await updateDoc(doc(db, "users", user.uid), {
        role: 'provider'
      });

      setSnackbar({
        open: true,
        message: 'Uspješno ste se registrovali kao čistač/ica!',
        type: 'success'
      });

      router.push('/provider-dashboard');
    } catch (error) {
      console.error("Error becoming provider: ", error);
      setSnackbar({
        open: true,
        message: 'Došlo je do greške prilikom registracije',
        type: 'error'
      });
    }
  };

  const toggleService = (service: { id: string; name: string }) => {
    setSelectedServices(prev => {
      const isSelected = prev.some(s => s.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  // Helper function to format day names
  const formatDayName = (day: string) => {
    const dayNames = {
      monday: 'Ponedjeljak',
      tuesday: 'Utorak',
      wednesday: 'Srijeda',
      thursday: 'Četvrtak',
      friday: 'Petak',
      saturday: 'Subota',
      sunday: 'Nedjelja'
    };
    return dayNames[day as keyof typeof dayNames];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top-middle Snackbar */}
      {snackbar.open && (
        <div className="fixed inset-0 flex items-start justify-center z-50 pointer-events-none pt-4">
          <div
            className={`${
              snackbar.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } text-white px-6 py-3 rounded-lg shadow-lg text-center max-w-sm mx-4`}
          >
            {snackbar.message}
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              Postanite Čistač/ica
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="pricePerHour" className="block text-sm font-medium text-gray-700 mb-2">
                    Cijena po satu (BAM)
                  </label>
                  <input
                    type="number"
                    id="pricePerHour"
                    name="pricePerHour"
                    placeholder="Unesite vašu satnicu"
                    onChange={handleMainFormDataChange}
                    required
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#02404B] focus:ring-[#02404B] sm:text-sm placeholder:text-gray-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dostupnost
                  </label>
                  <div className="space-y-4 border rounded-lg p-4">
                    {(Object.keys(availability) as DayOfWeek[]).map((day) => (
                      <div key={day} className="border-b last:border-b-0 pb-4 last:pb-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium">{formatDayName(day)}</h3>
                          <button
                            type="button"
                            onClick={() => setAvailability(prev => ({
                              ...prev,
                              [day]: [...prev[day], { start: '09:00', end: '17:00' }]
                            }))}
                            className="text-sm text-[#02404B] hover:text-opacity-80 flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Dodaj termin
                          </button>
                        </div>
                        <div className="space-y-2">
                          {availability[day].map((slot, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="time"
                                value={slot.start}
                                onChange={(e) => {
                                  const newAvailability = {...availability};
                                  newAvailability[day][index].start = e.target.value;
                                  setAvailability(newAvailability);
                                }}
                                className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-[#02404B] focus:ring-[#02404B] sm:text-sm"
                              />
                              <span className="text-gray-500">do</span>
                              <input
                                type="time"
                                value={slot.end}
                                onChange={(e) => {
                                  const newAvailability = {...availability};
                                  newAvailability[day][index].end = e.target.value;
                                  setAvailability(newAvailability);
                                }}
                                className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-[#02404B] focus:ring-[#02404B] sm:text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newAvailability = {...availability};
                                  newAvailability[day] = newAvailability[day].filter((_, i) => i !== index);
                                  setAvailability(newAvailability);
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                                aria-label="Remove time slot"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          {availability[day].length === 0 && (
                            <p className="text-sm text-gray-500 italic">Nema definisanih termina</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Usluge koje nudite
                  </label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {selectedServices.map(service => (
                        <div
                          key={service.id}
                          className="bg-[#02404B] text-white px-3 py-1 rounded-full flex items-center gap-2"
                        >
                          <span>{service.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleService(service)}
                            className="hover:text-red-300 focus:outline-none"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="border border-gray-300 rounded-md p-2">
                      <div className="grid grid-cols-2 gap-2">
                        {services.map(service => (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggleService(service)}
                            className={`p-2 rounded-md text-left transition-colors ${
                              selectedServices.some(s => s.id === service.id)
                                ? 'bg-[#02404B] text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                          >
                            {service.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Opis usluga
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    placeholder="Opišite vaše usluge i iskustvo"
                    onChange={handleMainFormDataChange}
                    required
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#02404B] focus:ring-[#02404B] sm:text-sm placeholder:text-gray-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="documents" className="block text-sm font-medium text-gray-700 mb-2">
                    Dokumenti za verifikaciju
                  </label>
                  <input
                    type="file"
                    id="documents"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleDocumentsChange}
                    className="mt-1 block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-[#02404B] file:text-white
                      hover:file:bg-opacity-90"
                  />
                  <p className="mt-1 text-sm text-gray-500">Dodajte potvrdu o nekažnjavanju i druge relevantne dokumente</p>
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
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row-reverse sm:justify-start gap-3">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2 bg-[#02404B] text-white rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors"
                  >
                    Registrujte se kao čistač/ica
                  </button>
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="w-full sm:w-auto px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Odustani
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default BecomeProvider; 