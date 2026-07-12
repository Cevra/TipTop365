'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';

const HeroSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const router = useRouter();
  const { user } = useAuth();

  const handleBecomeProvider = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    router.push('/become-provider');
  };

  const images = [
    {
      url: '/Homepage1.jpg',
      title: 'Čišćenje stanova',
      description: 'Profesionalne usluge čišćenja'
    },
    {
      url: '/Homepage1.jpg',
      title: 'Čišćenje ureda',
      description: 'Profesionalne usluge čišćenja'
    },
    {
      url: '/Homepage1.jpg',
      title: 'Airbnb čišćenje',
      description: 'Profesionalne usluge čišćenja'
    },
    {
      url: '/Homepage1.jpg',
      title: 'Dubinsko čišćenje',
      description: 'Profesionalne usluge čišćenja'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % images.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="relative bg-white w-full overflow-hidden">
      <div className="mx-auto w-full max-w-screen-2xl flex flex-col lg:grid lg:grid-cols-2">
        <div className="px-6 py-6 order-2 lg:order-1 lg:px-20 lg:py-32 flex items-center justify-center h-full">
          <div className="mx-auto max-w-xl lg:mx-0">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-pretty text-gray-900 text-center lg:text-left">
              Čistoća je pola zdravlja
            </h1>
            <p className="mt-8 text-lg md:text-xl font-medium text-pretty text-gray-600 text-center lg:text-left">
              Prepustite čišćenje profesionalcima. Naši provjereni čistači pružaju vrhunsku uslugu čišćenja za vaš dom ili poslovni prostor.
            </p>
            <div className="mt-10 flex items-center justify-center lg:justify-start gap-x-8">
              <button className="hidden lg:block px-6 py-3 bg-[#02404B] text-white text-lg font-semibold rounded-lg hover:bg-opacity-90 transform hover:scale-105 transition-all duration-300 shadow-lg">
                Rezerviši odmah
              </button>
              <button 
                onClick={handleBecomeProvider} 
                className="group text-lg font-semibold text-gray-900 hover:text-[#02404B] transition-colors duration-300"
              >
                Postani čistač 
                <span className="inline-block ml-2 transform group-hover:translate-x-1 transition-transform duration-200">→</span>
              </button>
            </div>
          </div>
        </div>

        <div className="relative w-full order-1 lg:order-2">
          <div className="h-[60vh] sm:h-[70vh] lg:h-[85vh]">
            {images.map((image, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  currentSlide === index ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div className="relative h-full group">
                  {/* Left click area */}
                  <div 
                    className="absolute left-0 top-0 h-full w-1/2 z-10 cursor-pointer" 
                    onClick={prevSlide}
                    aria-label="Prethodna slika"
                  />
                  {/* Right click area */}
                  <div 
                    className="absolute right-0 top-0 h-full w-1/2 z-10 cursor-pointer" 
                    onClick={nextSlide}
                    aria-label="Sljedeća slika"
                  />
                  {/* Arrow Buttons */}
                  <button
                    onClick={prevSlide}
                    className="hidden lg:block absolute left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/40 transition-all duration-300 backdrop-blur-sm z-20"
                    aria-label="Prethodna slika"
                  >
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextSlide}
                    className="hidden lg:block absolute right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/40 transition-all duration-300 backdrop-blur-sm z-20"
                    aria-label="Sljedeća slika"
                  >
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <Image
                    src={image.url}
                    alt={image.title}
                    fill
                    className="object-cover"
                    priority={index === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60">
                    <div className="absolute inset-0 flex flex-col items-center py-16 lg:py-20 lg:px-12">
                      <div className="flex flex-col items-center w-full mt-32 lg:mt-0 lg:justify-center lg:h-full">
                        <h3 className="text-3xl font-bold mb-3 text-white text-center max-w-[80%]">{image.title}</h3>
                        <p className="text-lg text-white text-center max-w-[70%] opacity-90">{image.description}</p>
                      </div>
                      <div className="lg:hidden flex-1 flex items-center">
                        <button className="px-8 py-3.5 bg-[#02404B] text-white text-lg font-semibold rounded-lg hover:bg-opacity-90 transform hover:scale-105 transition-all duration-300 shadow-lg">
                          Rezerviši odmah
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-3">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentSlide === index 
                      ? 'w-8 bg-white' 
                      : 'w-2 bg-white/50 hover:bg-white/70'
                  }`}
                  aria-label={`Slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;