export type UserRole = 'regular' | 'provider';

export interface UserProfile {
  uid: string;
  role: UserRole;
  email: string;
  createdAt: Date;
}

export interface ServiceProvider extends UserProfile {
  name: string;
  surname: string;
  phoneNumbers: string;
  availableHours: string;
  address: string;
  pricePerHour: string;
  gender: string;
  description: string;
  location: string;
  image: string;
  services: string[];
  rating?: number;
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