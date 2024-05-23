import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Corrected import for Next.js
import Link from 'next/link';
import logoImage from '../../public/logo.svg'; // Adjust the path according to your project structure
import Image from 'next/image';

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    setIsOpen(!isOpen);
  };
  return (
    <nav className="navbar z-40 bg-[#02404B] w-full h-[var(--navbar-height)] z-50 flex items-center justify-between">
      <div className="w-[var(--navbar-width)] mx-auto ml-10 flex items-center">
        <Image
          src={logoImage.src} // Use the imported logoImage object
          alt="Company Logo"
          layout="fixed" // Changed to fixed to prevent scaling
          width={144} // Adjusted width to fit the navbar
          height={64} // Adjusted height to fit the navbar
        />
      </div>
      <div className="container mx-auto mr-10 px-10 flex justify-end items-center">
        {/* Mobile Menu Button */}
        <div className="lg:hidden relative">
          <button onClick={handleClick} className="focus:outline-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-6 w-6 text-black"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* Dropdown Menu */}
          <div className={`absolute top-full left--1 right-0 mt-2 w-32 bg-[#016577] rounded-md shadow-lg transform overflow-auto translate-x-1/10 ${isOpen? 'block' : 'hidden'}`}>
            <div className="space-y-1">
              <Link href="/" passHref>
                <span className="block px-3 py-2 rounded-md text-base font-medium text-white">Home</span>
              </Link>
              <Link href="/Profile" passHref>
                <span className="block px-3 py-2 rounded-md text-base font-medium text-black">Profile</span>
              </Link>
              <Link href="/page2" passHref>
                <span className="block px-3 py-2 rounded-md text-base font-medium text-white">Page 2</span>
              </Link>
              {/* Add more links as needed */}
            </div>
          </div>
        </div>
  
        {/* Desktop Menu */}
        <div className="hidden lg:flex space-x-16 mr-11 items-center font-bold">
          <Link href="/page1" passHref>
            <span className="text-emerald-950 hover:text-gray-300">Postani dio ekipe</span>
          </Link>
          <Link href="/page2" passHref>
            <span className="text-emerald-950 hover:text-gray-300">Usluge</span>
          </Link>
          <Link href="/page2" passHref>
            <span className="text-emerald-950 hover:text-gray-300">O nama</span>
          </Link> <Link href="/page2" passHref>
            <span className="text-emerald-950 hover:text-gray-300">Pomoć</span>
          </Link> <Link href="/page2" passHref>
            <span className="text-emerald-950 hover:text-gray-300">Login</span>
          </Link>
          {/* Add more links as needed */}
        </div>
      </div>
    </nav>
  );
}
export default NavBar;
