export interface ServiceProvider {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string;
  description?: string;
  phoneNumber?: string;
  services: Array<{
    id: string;
    name: string;
  }>;
  availability: {
    [key: string]: Array<{
      start: string;
      end: string;
    }>;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  rating?: {
    average: number;
    count: number;
  };
  createdAt: any;
  lastUpdated: any;
} 