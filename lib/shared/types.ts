// Single source of truth for shared domain types.
// Replaces the conflicting app/models/{User,ServiceProvider,Address,Profile}.ts (E0.1).
// TODO(E1): these Firestore document shapes get superseded by Prisma models + backfill.

export type UserRole = 'regular' | 'provider';

export interface UserProfile {
  uid: string;
  role: UserRole;
  email: string;
  createdAt: Date;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export type Availability = Record<string, TimeSlot[]>;

// Shape of the Firestore `providers/{uid}` document as written by
// app/become-provider/page.tsx and read by the provider cards/lists.
export interface ServiceProvider {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: UserRole;
  profileImageUrl?: string;
  description?: string;
  phoneNumber?: string;
  pricePerHour?: number;
  gender?: 'male' | 'female' | 'other';
  services: Array<{ id: string; name: string; description?: string }>;
  availability: Availability;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  images?: string[];
  languages?: string[];
  certifications?: string[];
  rating?: {
    average: number;
    count: number;
  };
  createdAt?: unknown;
  lastUpdated?: unknown;
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

export interface Address {
  id?: string;
  street: string;
  houseNumber: string;
  floor?: string;
  apartment?: string;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  additionalInfo?: string;
}
