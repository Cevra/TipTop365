'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ProfileData } from '../models/Profile';

interface ServiceCardProps {
  profile: ProfileData;
}

const ServiceCard = ({ profile }: ServiceCardProps) => {
  const categories = [
    { id: 'cleaning', label: 'Čišćenje' },
    { id: 'maintenance', label: 'Održavanje' },
    { id: 'gardening', label: 'Vrtlarstvo' },
    { id: 'other', label: 'Ostalo' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="p-3 gap-3">
        <div className="relative w-full aspect-[4/3] mb-3">
          <Image
            src="/cleaning_template_img.png"
            alt={`${profile.name} ${profile.surname}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="rounded-lg object-cover"
            priority
          />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-800">
            {`${profile.name} ${profile.surname}`}
          </h3>
          
          <div className="mt-4 space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center">
                <input
                  type="radio"
                  id={`${category.id}-${profile.uid}`}
                  name={`category-${profile.uid}`}
                  value={category.id}
                  className="w-4 h-4 text-blue-600"
                />
                <label 
                  htmlFor={`${category.id}-${profile.uid}`}
                  className="ml-2 text-sm font-medium text-gray-900"
                >
                  {category.label}
                </label>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-600">{profile.description}</p>
          
          <div className="flex justify-between items-center mt-3">
            <div className="flex items-center">
              <span className="text-primary-700 font-bold text-lg">
                BAM {profile.pricePerHour}
              </span>
              <span className="text-sm text-gray-500 ml-1">-Po satu</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600">Ocjena 4.5/5</span>
            </div>
          </div>

          <Link 
            href={`/profile/${profile.uid}`}
            className="mt-4 block w-full text-white bg-gradient-to-r from-[#02404B] to-[#238B9E] hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
          >
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ServiceCard; 