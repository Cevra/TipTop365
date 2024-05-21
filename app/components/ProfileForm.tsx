// components/ProfileForm.js
import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig"; // Adjust the path based on your project structure
import "./ProfileForm.css";
import { TimePicker } from 'react-time-picker';
// import 'react-time-picker/dist/TimePicker.css';
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";

const ProfileForm = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    phoneNumbers: "",
    availableHours: "",
    address: "",
    pricePerHour: "",
    gender: "",
    description: "",
    location: "", // Added location field
    email: "", // Added email field
    image: null,
    jobTitle: "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    if (e.target instanceof HTMLInputElement) {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    } else if (e.target instanceof HTMLTextAreaElement) {
      setFormData({ ...formData, description: e.target.value });
    } else if (e.target instanceof HTMLSelectElement) {
      setFormData({ ...formData, gender: e.target.value });
    }
  };
  const handleTimeChange = (time:string|null) => {
    if (time!== null) {
    setFormData({...formData, availableHours: time});
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const auth = getAuth();
      const user = auth.currentUser; // Get the current user
      if (user) {
        const uid = user.uid; // Get the user's UID
        const docRef = await addDoc(collection(db, "profiles"), {
          ...formData,
          uid,
        }); // Include the UID in the data
        router.push("/Profile");
      } else {
        console.error("No user is signed in.");
      }
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="profile-form mx-auto max-w-md">
      <h2 className="form-title text-center text-2xl font-bold mb-6">
        Create Your Profile
      </h2>
      <div className="form-group mb-4">
        <label
          htmlFor="name"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          placeholder="Name"
          onChange={handleChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="surname"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Surname
        </label>
        <input
          type="text"
          id="surname"
          name="surname"
          placeholder="Surname"
          onChange={handleChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="phoneNumbers"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Phone Numbers
        </label>
        <input
          type="tel"
          id="phoneNumbers"
          name="phoneNumbers"
          placeholder="Phone Numbers"
          onChange={handleChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="availableHours"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Available Hours
        </label>
        <TimePicker
          //onChange={handleTimeChange}
          value={formData.availableHours? new Date(formData.availableHours) : null}
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="address"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Address
        </label>
        <input
          type="text"
          id="address"
          name="address"
          placeholder="Address"
          onChange={handleChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="pricePerHour"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Price Per Hour
        </label>
        <input
          type="number"
          id="pricePerHour"
          name="pricePerHour"
          placeholder="Price Per Hour"
          onChange={handleChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="gender"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Gender
        </label>
        <select
          id="gender"
          name="gender"
          onChange={handleChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="jobTitle"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Job Title
        </label>
        <input
          type="text"
          id="jobTitle"
          name="jobTitle"
          placeholder="Job Title"
          onChange={handleChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="description"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Description for Profile
        </label>
        <textarea
          id="description"
          name="description"
          placeholder="Description for Profile"
          onChange={handleChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        ></textarea>
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="location"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Location
        </label>
        <input
          type="text"
          id="location"
          name="location"
          placeholder="Location"
          onChange={handleChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="form-group mb-4">
        <label
          htmlFor="email"
          className="form-label block text-sm font-medium text-gray-700"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="Email"
          onChange={handleChange}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <button
        type="submit"
        className="submit-button bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-full"
      >
        Submit
      </button>
    </form>
  );
};

export default ProfileForm;
