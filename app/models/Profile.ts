// Define an interface for the profile data
export interface Profile {
  image?: string; // Optional if the image might not always be present
  // Define other properties as needed
  name: string;
  surname: string;
  phoneNumbers: string;
  availableHours: string;
  address: string;
  pricePerHour: string;
  gender: string;
  description: string;
  // Add other fields as necessary
}
export interface Service {
  type: string;
  price: string;
  [key: string]: string | number; // Index signature
}

export interface FormData {
  name: string;
  surname: string;
  phoneNumbers: string;
  availableHours: string;
  address: string;
  pricePerHour: string;
  gender: string;
  description: string;
  location: string;
  email: string;
  image?: string; // Assuming image is not implemented yet
  jobTitle: string;
 // services: Service[]; // Array of services
}
export interface FileChangeEvent extends React.ChangeEvent<HTMLInputElement> {}

export interface ProfileData {
  name: string;
  surname: string;
  pricePerHour: number;
  availableHours: string;
  description: string;
  uid: string;
  // Add other fields as necessary
}
