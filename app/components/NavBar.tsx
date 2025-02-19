import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; // Corrected import for Next.js
import Link from 'next/link';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig'; 
import logoImage from '../../public/logo.svg'; // Adjust the path according to your project structure
import Image from 'next/image';

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // State to track authentication status
  

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, []);
  const router = useRouter();
  const handleClickLogo = () => {
    // Programmatically navigate to the homepage
    router.push('/');
  };

  const handleClick = () => {
    setIsOpen(!isOpen);
  };
  return (
<nav className="navbar z-40 bg-white w-full  flex items-center justify-between bg-[#FFFFFF]">
<div onClick={handleClickLogo} className="w-[var(--navbar-width)] mx-auto ml-10 flex items-center">
        <Image
          src={logoImage.src} // Use the imported logoImage object
          alt="Company Logo"
          layout="fixed" // Changed to fixed to prevent scaling
          width={144} // Adjusted width to fit the navbar
          height={64} // Adjusted height to fit the navbar
        />
      </div>
      <div className="container mx-auto mr-1 px-10 flex justify-end items-center">
        {/* Mobile Menu Button */}
        <div className="lg:hidden relative justify-end">
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
          <div className={`absolute top-full left--12 right-0 mt-2 w-32  bg-[#fff] rounded-md justify-center shadow-lg transform overflow-auto translate-x-1/10 ${isOpen? 'block' : 'hidden'}`}>
            <div className="space-y-12">
            <Link href={isAuthenticated ? "/Profile" : "/Profile"} passHref>
          <button className="bg-[#02404B] text-white py-1 w-full px-4 rounded hover:bg-secondary">Postani dio ekipe</button>
          </Link>
          <Link href="/page2" passHref>
            <button className=" bg-white font-bold text-[#02404B]  w-32 py-2 h-12 px-4  hover:bg-secondary">Usluge</button>
          </Link>
          <Link href="/aboutUs" passHref>
            <button className="bg-white  font-bold text-[#02404B] py-2 w-32 px-4 h-12 hover:bg-secondary">O nama</button>
          </Link> <Link href="/aboutUs" passHref>
            <button className="bg-white font-bold text-[#02404B] py-2 w-32 px-4  hover:bg-secondary">Pomoć</button>
          </Link> <Link href={isAuthenticated ? "/ProfileDetails" : "/login"} passHref>
            <button className="bg-white font-bold text-[#02404B]  w-32 py-2 h-12 px-4  hover:bg-secondary">Login</button>
          </Link>
              {/* Add more links as needed */}
            </div>
          </div>
        </div>
  
        {/* Desktop Menu */}
        <div className="hidden lg:flex space-x-16 mr-11 items-center font-bold">
          <Link href={isAuthenticated ? "/Profile" : "/login"} passHref>
          <button className="bg-[#02404B] text-white w-40  py-2 px-2 rounded hover:bg-secondary">Postani dio ekipe</button>
          </Link>
          <Link href="/page2" passHref>
            <span className="text-emerald-950 hover:text-gray-300">Usluge</span>
          </Link>
          <Link href="/aboutUs" passHref>
            <span className="text-emerald-950 hover:text-gray-300">O nama</span>
          </Link> <Link href="/aboutUs" passHref>
            <span className="text-emerald-950 hover:text-gray-300">Pomoć</span>
          </Link> <Link href={isAuthenticated ? "/ProfileDetails" : "/login"} passHref>
            <span className="text-emerald-950 hover:text-gray-300">Login</span>
          </Link>
          {/* Add more links as needed */}
        </div>
      </div>
    </nav>
  );
}
export default NavBar;
