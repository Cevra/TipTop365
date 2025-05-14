"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ServiceCategory {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  features: string[];
  priceRange: string;
}

const ServicesPage = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const serviceCategories: ServiceCategory[] = [
    {
      id: 'regular',
      title: 'Redovno Čišćenje',
      description: 'Održavanje čistoće vašeg doma na sedmičnoj ili mjesečnoj bazi',
      imageUrl: '/regular-cleaning.jpg',
      features: [
        'Usisavanje i brisanje podova',
        'Brisanje prašine',
        'Čišćenje kupatila',
        'Čišćenje kuhinje',
        'Mijenjanje posteljine'
      ],
      priceRange: '10-15 KM/h'
    },
    {
      id: 'deep',
      title: 'Dubinsko Čišćenje',
      description: 'Temeljno čišćenje svih površina i teško dostupnih mjesta',
      imageUrl: '/deep-cleaning.jpg',
      features: [
        'Dubinsko čišćenje tepiha',
        'Pranje prozora',
        'Čišćenje iza namještaja',
        'Dezinfekcija površina',
        'Uklanjanje kamenca'
      ],
      priceRange: '15-20 KM/h'
    },
    {
      id: 'moving',
      title: 'Čišćenje Nakon Selidbe',
      description: 'Kompletno čišćenje prostora prije ili nakon selidbe',
      imageUrl: '/moving-cleaning.jpg',
      features: [
        'Detaljno čišćenje svih prostorija',
        'Uklanjanje tragova selidbe',
        'Čišćenje ormara i ladica',
        'Priprema za nove stanare',
        'Završno poliranje'
      ],
      priceRange: '20-25 KM/h'
    },
    {
      id: 'airbnb',
      title: 'Airbnb Čišćenje',
      description: 'Profesionalno čišćenje za iznajmljivače',
      imageUrl: '/airbnb-cleaning.jpg',
      features: [
        'Brza promjena posteljine',
        'Priprema za nove goste',
        'Održavanje inventara',
        'Osvježavanje prostora',
        'Dostupnost 7 dana u sedmici'
      ],
      priceRange: '15-20 KM/h'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Naše Usluge</h1>
          <p className="text-xl text-gray-600">
            Profesionalne usluge čišćenja prilagođene vašim potrebama
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {serviceCategories.map((category) => (
            <div
              key={category.id}
              className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
            >
              <div className="relative h-48">
                <Image
                  src={category.imageUrl}
                  alt={category.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {category.title}
                </h3>
                <p className="text-gray-600 mb-4">{category.description}</p>
                <div className="space-y-2">
                  {category.features.map((feature, index) => (
                    <div key={index} className="flex items-center">
                      <svg
                        className="h-5 w-5 text-green-500 mr-2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span className="text-sm text-gray-600">{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <p className="text-lg font-semibold text-gray-900">
                    Cijena: {category.priceRange}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Zašto odabrati naše usluge?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-white rounded-lg shadow">
              <div className="text-4xl mb-4">🌟</div>
              <h3 className="text-xl font-semibold mb-2">Provjereni Čistači</h3>
              <p className="text-gray-600">
                Svi naši čistači prolaze temeljitu provjeru i verifikaciju
              </p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">Fleksibilnost</h3>
              <p className="text-gray-600">
                Prilagođavamo se vašem rasporedu i potrebama
              </p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow">
              <div className="text-4xl mb-4">💯</div>
              <h3 className="text-xl font-semibold mb-2">Garantovan Kvalitet</h3>
              <p className="text-gray-600">
                100% garancija na zadovoljstvo našim uslugama
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServicesPage; 