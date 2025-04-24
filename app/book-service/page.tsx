"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

const BookingForm = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    address: '',
    requestedHours: '',
    date: '',
    specialRequests: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      await addDoc(collection(db, "bookings"), {
        userId: user.uid,
        ...formData,
        status: 'pending',
        createdAt: new Date(),
      });
      
      router.push('/bookings');
    } catch (error) {
      console.error('Error creating booking:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-8 bg-white rounded-lg shadow-md">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Book Cleaning Service
        </h2>
        
        <div className="space-y-6">
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="form-input-custom"
              required
            />
          </div>

          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requested Hours
            </label>
            <input
              type="text"
              value={formData.requestedHours}
              onChange={(e) => setFormData({...formData, requestedHours: e.target.value})}
              className="form-input-custom"
              required
            />
          </div>

          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              className="form-input-custom"
              required
            />
          </div>

          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Requests
            </label>
            <textarea
              value={formData.specialRequests}
              onChange={(e) => setFormData({...formData, specialRequests: e.target.value})}
              className="form-input-custom"
              rows={4}
            />
          </div>

          <button
            type="submit"
            className="submit-button-custom"
          >
            Submit Booking Request
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookingForm; 