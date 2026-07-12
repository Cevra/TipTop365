'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ServiceProvider } from '@/lib/shared/types';

interface ServiceCardProps {
  provider: ServiceProvider;
}

const ServiceCard = ({ provider }: ServiceCardProps) => {
  // Get first letter of name for fallback avatar
  const nameInitial = provider.firstName ? provider.firstName[0].toUpperCase() : '?';
  
  // Add array of gradient combinations
  const gradientColors = [
    'from-indigo-600 to-purple-600',
    'from-rose-500 to-orange-500',
    'from-cyan-500 to-blue-500',
    'from-emerald-500 to-teal-500',
    'from-fuchsia-500 to-pink-500'
  ];
  
  // Get a consistent gradient based on the provider's ID or name
  const gradientIndex = provider.uid ? 
    provider.uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradientColors.length :
    0;
  
  // Use display name if available, otherwise combine first and last name
  const displayName = `${provider.firstName} ${provider.lastName}`;
  // Format price with 2 decimal places if available
  const pricePerHour = provider.pricePerHour 
    ? `${Number(provider.pricePerHour).toFixed(2)} KM/H` 
    : 'N/A';
  // Helper function to render stars based on rating
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const partialFill = (rating % 1) * 100;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <svg 
            key={i}
            className="w-7 h-7 text-yellow-300 me-1" // Increased size from w-4 h-4
            aria-hidden="true" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="currentColor" 
            viewBox="0 0 22 20"
          >
            <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
          </svg>
        );
      } else if (i === fullStars && partialFill > 0) {
        stars.push(
          <svg 
            key={i}
            className="w-7 h-7 text-yellow-300 me-1" // Increased size from w-4 h-4
            aria-hidden="true" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="currentColor" 
            viewBox="0 0 22 20"
          >
            <defs>
              <linearGradient id={`partial-star-gradient-${i}`}>
                <stop offset={`${partialFill}%`} stopColor="currentColor"/>
                <stop offset={`${partialFill}%`} stopColor="#D1D5DB"/>
              </linearGradient>
            </defs>
            <path fill={`url(#partial-star-gradient-${i})`} d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
          </svg>
        );
      } else {
        stars.push(
          <svg 
            key={i}
            className="w-7 h-7 text-gray-200 me-1 dark:text-gray-600" // Changed colors
            aria-hidden="true" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="currentColor" 
            viewBox="0 0 22 20"
          >
            <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z"/>
          </svg>
        );
      }
    }
    return stars;
  };

  const rating = provider.rating?.average || 3.65;

  return (
    <div className="bg-white border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 flex flex-col h-full overflow-hidden rounded">
      {/* Image at top */}
      <Link href={`/profile/${provider.uid}`} className="block">
        {provider.profileImageUrl ? (
          <div className="flex items-center justify-center h-80 overflow-hidden">
            <img 
              className="w-full h-full object-cover object-center rounded-t-lg"
              src={provider.profileImageUrl}
              alt={displayName}
            />
          </div>
        ) : (
          <div className={`w-full h-80 bg-gradient-to-r ${gradientColors[gradientIndex]} flex items-center justify-center`}>
            <span className="text-6xl font-bold text-white">
              {nameInitial}
            </span>
          </div>
        )}
      </Link>
      
      <div className="px-5 py-4 flex-grow flex flex-col">
        {/* Name and price row */}
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            <Link href={`/profile/${provider.uid}`}>
              {displayName}
            </Link>
          </h3>
          <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
           {pricePerHour}
          </span>
        </div>
        
        {/* Service tags in two equal rows */}
        <div className="grid grid-cols-2 gap-2 my-3 mb-8">
          {provider.services?.map((service, index) => (
            <span 
              key={index} 
              className="px-3 py-1 text-sm font-medium rounded-full bg-fresh-400 text-white text-center truncate"
            >
              {service.name}
            </span>
          ))}
        </div>
        {/* Description with 3-line clamp - temporarily commented out
        <p className="mt-2 mb-4 font-light text-gray-600 dark:text-gray-400 line-clamp-3 overflow-hidden">
          {truncateDescription(provider.description || '')}
        </p> 
        */}
        {/* Rating Stars just above the button */}
        <div className="flex justify-center items-center mt-auto mb-2">
          {renderStars(rating)}
          <p className="ms-1 text-m font-medium text-gray-500 dark:text-gray-400">
            {rating.toFixed(2)}
          </p>
        </div>
      </div>
      
      {/* Booking button at bottom */}
      <div className="px-5 pb-4">
        <Link href={`/booking/${provider.uid}`} className="block">
          <button className="w-full bg-fresh-500 hover:bg-primary-800 text-white font-bold py-2 px-4 rounded transition-all duration-300 shadow-md hover:shadow-lg">
            Rezerviši
          </button>
        </Link>
      </div>
    </div>
  );
};

export default ServiceCard; 