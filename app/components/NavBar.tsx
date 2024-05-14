import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import logoImage from '../../public/logo.svg'; // Adjust the path according to your project structure

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="bg-[#02404B] w-full z-50">
      <div className="container mx-auto px-10 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" passHref>
          <img src={logoImage} alt="Logo" className="text-white text-xl font-semibold" />
        </Link>

        {/* Mobile Menu Button */}
        <div className="lg:hidden relative">
          <button onClick={handleClick} className="focus:outline-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-6 w-6 text-white"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* Dropdown Menu */}
          <div className={`absolute top-full left--1 right-0 mt-2 w-32 bg-[#016577] rounded-md shadow-lg transform overflow-auto translate-x-1/10 ${isOpen? 'block' : 'hidden'}`}>
            <div className=" space-y-1">
              <Link href="/" passHref>
                <span className="block px-3 py-2 rounded-md text-base font-medium text-white">Home</span>
              </Link>
              <Link href="/Profile" passHref>
                <span className="block px-3 py-2 rounded-md text-base font-medium text-white">Profile</span>
              </Link>
              <Link href="/page2" passHref>
                <span className="block px-3 py-2 rounded-md text-base font-medium text-white">Page 2</span>
              </Link>
              {/* Add more links as needed */}
            </div>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex space-x-10">
          <Link href="/page1" passHref>
            <span className="text-white hover:text-gray-300">Page 1</span>
          </Link>
          <Link href="/page2" passHref>
            <span className="text-white hover:text-gray-300">Page 2</span>
          </Link>
          {/* Add more links as needed */}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
