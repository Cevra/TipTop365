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