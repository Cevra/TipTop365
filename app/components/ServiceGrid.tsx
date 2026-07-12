'use client';

import { ServiceProvider } from '@/lib/shared/types';
import ServiceCard from './ServiceCard';
import { useState } from 'react';

interface ServiceGridProps {
  providers: ServiceProvider[];
}

const ServiceGrid = ({ providers }: ServiceGridProps) => {
  console.log("ServiceGrid received providers:", providers);
  const [showAll, setShowAll] = useState(false);
  
  const mobileLimit = 6;
  const desktopLimit = 12;
  
  // Determine how many providers to show based on screen size and showAll state
  const getVisibleProviders = () => {
    if (showAll) return providers;
    
    // Use client-side check for window width
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const limit = isMobile ? mobileLimit : desktopLimit;
    
    return providers.slice(0, limit);
  };
  
  const visibleProviders = getVisibleProviders();
  const hasMoreToShow = providers.length > visibleProviders.length;
  
  return (
    <section className="bg-white dark:bg-gray-900">
      <div className="py-8 px-4 sm:px-6 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
        <div className="mx-auto max-w-screen-sm text-center mb-8 lg:mb-16">
          <h2 className="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
            Naši Čistači
          </h2>
          <p className="font-light text-gray-500 lg:mb-16 sm:text-xl dark:text-gray-400">
            Pronađite savršenog čistača za vaš dom ili poslovni prostor
          </p>
        </div>
        
        {providers.length > 0 ? (
          <>
            <div className="grid gap-6 mx-2 sm:mx-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleProviders.map((provider) => (
                <ServiceCard key={provider.uid} provider={provider} />
              ))}
            </div>
            
            {(providers.length > mobileLimit || providers.length > desktopLimit) && (
              <div className="flex justify-center mt-8">
                <button 
                  onClick={() => setShowAll(!showAll)}
                  className="px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded transition-colors duration-300"
                >
                  {showAll ? "Prikaži manje" : "Prikaži više"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Nema dostupnih čistača</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default ServiceGrid; 