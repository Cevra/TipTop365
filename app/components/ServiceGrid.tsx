'use client';

import { ProfileData } from '../models/Profile';
import ServiceCard from './ServiceCard';

interface ServiceGridProps {
  profiles: ProfileData[];
}

const ServiceGrid = ({ profiles }: ServiceGridProps) => {
  return (
    <section className="bg-white dark:bg-gray-900">
      <div className="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
        <div className="mx-auto max-w-screen-sm text-center mb-8 lg:mb-16">
          <h2 className="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
            Naši Pružaoci Usluga
          </h2>
          <p className="font-light text-gray-500 lg:mb-16 sm:text-xl dark:text-gray-400">
            Pronađite savršenog pružaoca usluga za vaše potrebe
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {profiles.map((profile) => (
            <ServiceCard key={profile.uid} profile={profile} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceGrid; 