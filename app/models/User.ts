export type UserRole = 'regular' | 'provider';

export interface UserProfile {
  uid: string;
  role: UserRole;
  email: string;
  createdAt: Date;
}

interface TimeSlot {
  start: string;
  end: string;
}

interface Availability {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

export interface ServiceProvider extends UserProfile {
  name: string;
  surname: string;
  phoneNumbers: string[];
  availability: Availability;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  pricePerHour: number;
  gender: 'male' | 'female' | 'other';
  description: string;
  location: {
    latitude: number;
    longitude: number;
  };
  images: string[];
  services: {
    id: string;
    name: string;
    description?: string;
  }[];
  rating?: {
    average: number;
    count: number;
  };
  languages?: string[];
  certifications?: string[];
}

export interface BookingRequest {
  userId: string;
  providerId: string;
  address: string;
  requestedHours: string;
  date: Date;
  specialRequests?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
} 