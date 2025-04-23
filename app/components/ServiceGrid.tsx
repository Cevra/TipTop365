'use client';

import Image from 'next/image';
import { ProfileData } from '../models/Profile';
import Link from 'next/link';

const ServiceCard = ({ 
  name, 
  surname, 
  description, 
  pricePerHour,
  uid,
}: ProfileData) => {
  return (
    <Link href={`/profile/${uid}`} className="block">
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 max-w-sm cursor-pointer">
        <div className="p-3 gap-3">
          <div className="relative w-full aspect-[4/3] mb-3">
            <Image
              src="/cleaning_template_img.png"
              alt={`${name} ${surname}`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="rounded-lg object-cover"
              priority
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">{`${name} ${surname}`}</h3>
            <h4 className="text-base font-medium text-gray-900 uppercase">Cleaning Services</h4>
            <p className="text-sm text-gray-600">{description}</p>
            <div className="flex justify-between items-center mt-3">
              <div className="flex items-center">
                <span className="text-primary-700 font-bold text-lg">BAM {pricePerHour}</span>
                <span className="text-sm text-gray-500 ml-1">-Po satu</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-600">Ocjena 4.5/5</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

interface ServiceGridProps {
  profiles: ProfileData[];
  title?: string;
}

const ServiceGrid = ({ profiles, title = "Preporučeno za Vas:" }: ServiceGridProps) => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-4xl font-bold text-gray-800 mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((profile, index) => (
          <ServiceCard
            key={index}
            {...profile}
          />
        ))}
      </div>
      <div className="flex justify-center mt-8">
        <button className="bg-teal-700 hover:bg-teal-800 text-white font-medium py-3 px-8 rounded-full transition-colors duration-300 shadow-md hover:shadow-lg" onClick={() => alert("Ne radi trenutno, povezi u buducnosti")}>
          Pogledajte sve
        </button>
      </div>
    </div>
  );
};

export default ServiceGrid; 