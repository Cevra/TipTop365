'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ServiceProvider } from '../models/ServiceProvider';

interface ServiceCardProps {
  provider: ServiceProvider;
}

const ServiceCard = ({ provider }: ServiceCardProps) => {
  // Get first letter of name for fallback avatar
  const nameInitial = provider.firstName ? provider.firstName[0].toUpperCase() : '?';
  
  // Use display name if available, otherwise combine first and last name
  const displayName = `${provider.firstName} ${provider.lastName}`;
  
  // Truncate description to prevent overflow
  const truncateDescription = (text: string, maxLength: number = 100) => {
    if (!text) return 'No description provided';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 flex flex-col h-full">
      {/* Image at top */}
      <Link href={`/profile/${provider.uid}`} className="block">
        {provider.profileImageUrl ? (
          <img 
            className="w-full h-64 object-cover rounded-t-lg"
            src={provider.profileImageUrl}
            alt={displayName}
          />
        ) : (
          <div className="w-full h-64 rounded-t-lg bg-gradient-to-r from-teal-500 to-cyan-600 flex items-center justify-center">
            <span className="text-6xl font-bold text-white">
              {nameInitial}
            </span>
          </div>
        )}
      </Link>
      
      <div className="px-5 py-4 flex-grow flex flex-col">
        <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          <Link href={`/profile/${provider.uid}`}>
            {displayName}
          </Link>
        </h3>
        
        {/* Service tags in two equal rows */}
        <div className="grid grid-cols-2 gap-2 my-3">
          {provider.services?.map((service, index) => (
            <span 
              key={index} 
              className="px-3 py-1 text-sm font-medium rounded-full bg-gradient-to-r from-green-400 to-emerald-500 text-white text-center truncate"
            >
              {service.name}
            </span>
          ))}
        </div>
        
        <p className="mt-2 mb-4 font-light text-gray-600 dark:text-gray-400 line-clamp-3 overflow-hidden">
          {truncateDescription(provider.description || '')}
        </p>
        
      
      </div>
      
      {/* Booking button at bottom */}
      <div className="px-5 pb-4">
        <Link href={`/booking/${provider.uid}`}>
          <button className="w-full bg-[#02404B] hover:bg-[#035e6e] text-white font-bold py-2 px-4 rounded transition-all duration-300 shadow-md hover:shadow-lg">
            Rezerviši
          </button>
        </Link>
      </div>
    </div>
  );
};

export default ServiceCard; 