'use client';

import { ServiceProvider } from '../models/ServiceProvider';
import ServiceCard from './ServiceCard';

interface ServiceGridProps {
  providers: ServiceProvider[];
}

const ServiceGrid = ({ providers }: ServiceGridProps) => {
  console.log("ServiceGrid received providers:", providers);
  
  return (
    <section className="bg-white dark:bg-gray-900">
      <div className="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
        <div className="mx-auto max-w-screen-sm text-center mb-8 lg:mb-16">
          <h2 className="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
            Naši Čistači
          </h2>
          <p className="font-light text-gray-500 lg:mb-16 sm:text-xl dark:text-gray-400">
            Pronađite savršenog čistača za vaš dom ili poslovni prostor
          </p>
        </div>
        
        {providers.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {providers.map((provider) => (
              <ServiceCard key={provider.uid} provider={provider} />
            ))}
          </div>
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