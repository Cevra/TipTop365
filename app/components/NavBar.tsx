'use client';

import { Disclosure, Menu, Transition } from '@headlessui/react'
import { Bars3Icon, XMarkIcon, UserCircleIcon, BellIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import Image from 'next/image'
import logoImage from '../../public/logo.svg'
import { tree } from 'next/dist/build/templates/app-page'

const NavBar = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    console.log(isMenuOpen)
  }, [isMenuOpen])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user)
    })
    return () => unsubscribe()
  }, [])

  const handleClickLogo = () => {
    router.push('/')
  }

  return (
    <nav className="bg-white shadow-sm relative z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <div className="flex items-center justify-between w-full">
            {/* Logo - centered on mobile */}
            <div className="flex shrink-0 items-center md:ml-0 absolute left-1/2 transform -translate-x-1/2 md:relative md:left-0 md:transform-none" onClick={handleClickLogo}>
              <Image
                src={logoImage.src}
                alt="Company Logo"
                width={144}
                height={64}
              />
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:ml-12 md:flex md:space-x-8">
              <Link
                href="/"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                  pathname === '/' 
                    ? 'border-[#00A6FB] text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Home
              </Link>
              <Link
                href="/page2"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                  pathname === '/page2' 
                    ? 'border-[#00A6FB] text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Usluge
              </Link>
              <Link
                href="/aboutUs"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                  pathname === '/aboutUs' 
                    ? 'border-[#00A6FB] text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                O nama
              </Link>
              <Link
                href="/help"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                  pathname === '/help' 
                    ? 'border-[#02404B] text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Pomoć
              </Link>
            </div>

            {/* Mobile menu button - moved to right */}
            <div className="flex md:hidden ml-auto">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#00A6FB]"
              >
                <span className="sr-only">Open main menu</span>
                {isMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center gap-x-4">
              {!isAuthenticated ? (
                <>
                  <Link href="/login" className="relative inline-flex items-center gap-x-2 rounded-md bg-[#02404B] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-opacity-90">
                    Postani dio ekipe
                    <span className="text-lg">+</span>
                  </Link>
                  <Link
                    href="/login"
                    className="relative inline-flex items-center justify-center rounded-full bg-gray-100 p-2 text-gray-400 hover:bg-gray-200"
                  >
                    <UserCircleIcon className="h-10 w-10" aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-x-4">
                  <button className="relative inline-flex items-center justify-center rounded-full bg-gray-100 p-2 text-gray-400 hover:bg-gray-200">
                    <BellIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                  <Menu as="div" className="relative">
                    <Menu.Button className="relative flex rounded-full bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-hidden">
                      <img
                        src="/default-avatar.jpg"
                        alt="user photo"
                        className="h-10 w-10 rounded-full"
                      />
                    </Menu.Button>
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5">
                      <Menu.Item>
                        {({ active }) => (
                          <Link href="/ProfileDetails" className={`block px-4 py-2 text-sm text-gray-700 ${active ? 'bg-gray-100' : ''}`}>
                            Profil
                          </Link>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <Link href="/settings" className={`block px-4 py-2 text-sm text-gray-700 ${active ? 'bg-gray-100' : ''}`}>
                            Postavke
                          </Link>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <button
               //                 onClick={handleSignOut}
                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${active ? 'bg-gray-100' : ''}`}
                          >
                            Odjava
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Menu>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu panel - updated to dropdown */}
      <Transition
        show={isMenuOpen}
        enter="transition duration-200 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-100 ease-in"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
        className="absolute top-full inset-x-0 md:hidden"
      >
        <div className="bg-white shadow-lg">
          <div className="space-y-1 px-2 pt-2 pb-3">
            {/* Navigation Links */}
            <Link
              href="/"
              className={`block rounded-md px-3 py-2 text-base font-medium ${
                pathname === '/'
                  ? 'bg-blue-50 text-[#00A6FB]'
                  : 'text-gray-900 hover:bg-gray-50 hover:text-gray-900'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/page2"
              className={`block rounded-md px-3 py-2 text-base font-medium ${
                pathname === '/page2'
                  ? 'bg-blue-50 text-[#00A6FB]'
                  : 'text-gray-900 hover:bg-gray-50 hover:text-gray-900'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Usluge
            </Link>
            <Link
              href="/aboutUs"
              className={`block rounded-md px-3 py-2 text-base font-medium ${
                pathname === '/aboutUs'
                  ? 'bg-blue-50 text-[#00A6FB]'
                  : 'text-gray-900 hover:bg-gray-50 hover:text-gray-900'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              O nama
            </Link>
            <Link
              href="/help"
              className={`block rounded-md px-3 py-2 text-base font-medium ${
                pathname === '/help'
                  ? 'bg-blue-50 text-[#00A6FB]'
                  : 'text-gray-900 hover:bg-gray-50 hover:text-gray-900'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Pomoć
            </Link>
          </div>

          {/* User Section */}
          <div className="border-t border-gray-200 pt-4 pb-3">
            {isAuthenticated ? (
              <>
                <div className="flex items-center px-4">
                  <div className="shrink-0">
                    <img
                      src="/default-avatar.jpg"
                      alt="user photo"
                      className="h-10 w-10 rounded-full"
                    />
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">Korisnički profil</div>
                    <div className="text-sm font-medium text-gray-500">name@example.com</div>
                  </div>
                  <button className="ml-auto relative shrink-0 rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:ring-2 focus:ring-[#00A6FB] focus:ring-offset-2">
                    <span className="absolute -inset-1.5" />
                    <span className="sr-only">View notifications</span>
                    <BellIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-3 space-y-1 px-2">
                  <Link
                    href="/ProfileDetails"
                    className="block rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profil
                  </Link>
                  <Link
                    href="/settings"
                    className="block rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Postavke
                  </Link>
                  <button
                    // onClick={handleSignOut}
                    className="block w-full text-left rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Odjava
                  </button>
                </div>
              </>
            ) : (
              <div className="px-4">
                <Link
                  href="/login"
                  className="block w-full text-center rounded-md bg-[#02404B] px-3 py-2 text-base font-medium text-white hover:bg-opacity-90"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Postani dio ekipe
                  <span className="ml-1">+</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </Transition>
    </nav>
  )
}

export default NavBar