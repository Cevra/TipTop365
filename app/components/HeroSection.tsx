'use client';

import Image from 'next/image';

const HeroSection = () => {
  return (
    <div className="relative h-[400px] md:h-[600px]">
      <div className="flex justify-between items-center h-full">
        <div className="font-sans container mx-auto px-4 py-16 text-left relative z-10 lg:w-1/2">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-8">
            Payments tool for software companies
          </h1>
          <p className="text-xl md:text-2xl font-medium text-gray-200 mb-8">
            From checkout to global sales tax compliance, companies around the world use Flowbite to simplify their payment stack.
          </p>
          <a href="#" className="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-center text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 dark:focus:ring-primary-900 rounded-lg shadow-md transition duration-300">
            Get started
            <svg className="w-5 h-5 ml-2 -mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
            </svg>
          </a>
        </div>
        <div className="hidden lg:block lg:w-1/2">
          <Image
            src="/Homepage1.jpg"
            layout="fill"
            objectFit="cover"
            alt="Large Image Description"
          />
        </div>
      </div>
    </div>
  );
};

export default HeroSection; 