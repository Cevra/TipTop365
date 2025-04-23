'use client'

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import logoImage from "../../public/logolight.svg";
import ig from "../../public/ig.svg";
import fb from "../../public/fb.svg";
import Image from "next/image";
const Footer = () => {
  const router = useRouter();
  const handleClickLogo = () => {
    // Programmatically navigate to the homepage
    router.push("/");
  };

  return (
    <footer className="bg-primary w-full h-[361px] mx-auto px-10 py-8">
      <div className="container mx-auto mt-10 flex flex-col justify-between">
        {/* Logo Section */}

        {/* Columns */}
        <div className="flex justify-around ">
          {/* Column 1 */}
          <div onClick={handleClickLogo} className="flex items-start flex-col">
            <Image
              src={logoImage.src}
              alt="Company Logo"
              width={144}
              height={64}
            />
            <h2 className=" mt-6 text-white text-lg">
              Vaš dom zaslužuje najbolju njegu.
              <br />
              <br />
              Naša platforma vam nudi vrhunske usluge
              <br />
              čišćenja koje garantuju besprekornu
              <br />
              čistoću i miris svježine.
            </h2>
          </div>
          <div className="flex items-start flex-col">
            <h2 className="text-[#26B7D1] text-lg font-semibold mb-2">
              Informacije i kontakt
            </h2>
            <Link href="/aboutUs" passHref>
              <span className="block  py-2 rounded-md text-base font-medium text-white">
                O nama
              </span>
            </Link>{" "}
            <Link href="/aboutUs" passHref></Link>
            <Link href="/privatnost-podataka" passHref>
              <span className="block  py-2 rounded-md text-base font-medium text-white">
                Privatnost podataka
              </span>
            </Link>
            <Link href="/opsti-uslovi-korishtenja" passHref>
              <span className="block  py-2 rounded-md text-base font-medium text-white">
                Opšti uslovi korištenja
              </span>
            </Link>
          </div>

          {/* Column 2 */}
          <div className="flex items-start flex-col">
            {" "}
            <h3 className="text-[#26B7D1] text-lg font-semibold mb-2">FAQ</h3>
            <Link href="/faq" passHref>
              <span className="block  py-2 rounded-md text-base font-medium text-white">
                Profil
              </span>
            </Link>
            <Link href="/faq" passHref>
              <span className="block  py-2 rounded-md text-base font-medium text-white">
                Rezervacije
              </span>
            </Link>
            <Link href="/faq" passHref>
              <span className="block  py-2 rounded-md text-base font-medium text-white">
                Plaćanja
              </span>
            </Link>
          </div>

          {/* Column 3 */}
          <div className="flex items-start flex-col">
            <h3 className="text-[#26B7D1] text-lg font-semibold mb-2">Pomoć</h3>
            <Link href="/podrska-korisnicima" passHref>
              <span className="block  py-2 rounded-md text-base font-medium text-white">
                Podrška korisnicima
              </span>
            </Link>
            <Link href="/koristi-ustege" passHref>
              <span className="block  py-2 rounded-md text-base font-medium text-white">
                Korištenje usluga
              </span>
            </Link>

            <Link href="/postani-radnik" passHref>
              <span className="block  py-2 rounded-md text-base font-medium text-white">
                Postani radnik
              </span>
            </Link>
          </div>
        </div>

        {/* Copyright and Social Media Icons */}
        <div className="mt-8 flex items-start px-20 justify-between flex-row">
          <p className="text-[#26B7D1] text-xs">
            &copy; 2024 Vaše Firma. Sva prava rezervirana.
          </p>
          <div className="flex space-x-4">
            <a href="#" target="_blank" rel="noopener noreferrer">
              <img src={fb.src} alt="Facebook" width="40" height="40" />
            </a>
            <a
              href="https://www.instagram.com/tiptop.365/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src={ig.src} alt="Instagram" width="40" height="40" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
