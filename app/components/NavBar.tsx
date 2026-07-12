'use client';

import { Menu, Transition } from '@headlessui/react'
import { Bars3Icon, XMarkIcon, UserCircleIcon, BellIcon } from '@heroicons/react/24/outline'
import { useState, Fragment, useEffect } from 'react'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/firebaseConfig'
import Image from 'next/image'
import logoImage from '../../public/logo.svg'
import { useAuth } from '@/contexts/AuthContext'
import { logout } from '@/utils/auth'
import { endSession } from '@/utils/session'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebaseConfig'

const NavBar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showSnackbar, setShowSnackbar] = useState(false)
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.uid) {
        const userRef = doc(db, "users", user.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          setProfile(userSnap.data())
        }
      }
    }

    fetchProfile()
  }, [user])

  const handleSignOut = async () => {
    try {
      await logout(auth)
      await endSession()
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const userEmail = user?.email || 'name@example.com'
  const userPhotoUrl = profile?.profileImageUrl || `https://ui-avatars.com/api/?name=${userEmail?.charAt(0) || 'U'}&background=02404B&color=fff`

  const handleClickLogo = () => {
    router.push('/')
  }

  const handleBecomeProvider = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    router.push('/become-provider');
  };

  const handleProfileClick = () => {
    if (user?.uid) {
      router.push(`/profile/${user.uid}`);
      setIsMenuOpen(false);
    }
  };

  const handleBellClick = () => {
    setShowSnackbar(true)
    setTimeout(() => setShowSnackbar(false), 3000) // Hide after 3 seconds
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
                className="cursor-pointer"
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
                href="/usluge"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                  pathname === '/usluge' 
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
              {pathname !== '/' && (
                <button
                  onClick={handleBecomeProvider}
                  className="relative inline-flex items-center gap-x-2 rounded-md bg-[#02404B] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-opacity-90"
                >
                  Postani čistač
                  <span className="text-lg">+</span>
                </button>
              )}
              
              {!user ? (
                <Link
                  href="/login"
                  className="relative inline-flex items-center justify-center rounded-full bg-gray-100 p-2 text-gray-400 hover:bg-gray-200"
                >
                  <UserCircleIcon className="h-10 w-10" aria-hidden="true" />
                </Link>
              ) : (
                <div className="flex items-center gap-x-4">
                  <button
                    onClick={handleBellClick}
                    className="relative inline-flex items-center justify-center rounded-full bg-gray-100 p-2 text-gray-400 hover:bg-gray-200"
                  >
                    <BellIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                  <Menu as="div" className="relative">
                    <Menu.Button className="relative flex rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                      <img
                        src={userPhotoUrl}
                        alt="Profile"
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5">
                        <Menu.Item>
                          {({ active }) => (
                            <button 
                              onClick={handleProfileClick}
                              className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${active ? 'bg-gray-100' : ''}`}
                            >
                              Profil
                            </button>
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
                              onClick={handleSignOut}
                              className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${active ? 'bg-gray-100' : ''}`}
                            >
                              Odjava
                            </button>
                          )}
                        </Menu.Item>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu panel */}
      <Transition
        as="div"
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
          <div className="space-y-1 px-2 pb-3 pt-2 flex flex-col items-center">
            {/* Navigation Links */}
            <Link
              href="/"
              className={`block rounded-md px-3 py-2 text-base font-medium text-center w-full ${
                pathname === '/'
                  ? 'bg-blue-50 text-[#00A6FB]'
                  : 'text-gray-900 hover:bg-gray-50 hover:text-gray-900'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/usluge"
              className={`block rounded-md px-3 py-2 text-base font-medium text-center w-full ${
                pathname === '/usluge'
                  ? 'bg-blue-50 text-[#00A6FB]'
                  : 'text-gray-900 hover:bg-gray-50 hover:text-gray-900'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Usluge
            </Link>
            <Link
              href="/aboutUs"
              className={`block rounded-md px-3 py-2 text-base font-medium text-center w-full ${
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
              className={`block rounded-md px-3 py-2 text-base font-medium text-center w-full ${
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
            {pathname !== '/' && (
              <div className="px-4 mb-3">
                <button
                  onClick={handleBecomeProvider}
                  className="block w-full text-center rounded-md bg-[#02404B] px-3 py-2 text-base font-medium text-white hover:bg-opacity-90"
                >
                  Postani dio ekipe
                  <span className="ml-1">+</span>
                </button>
              </div>
            )}
            
            {user ? (
              <>
                <div className="flex flex-col items-center px-4 mb-3">
                  <div className="flex flex-col items-center">
                    <img
                      src={userPhotoUrl}
                      alt="Profile"
                      className="h-10 w-10 rounded-full object-cover mb-2"
                    />
                    <div className="text-sm font-medium text-gray-500">{userEmail}</div>
                  </div>
                  <button
                    onClick={handleBellClick}
                    className="ml-auto relative shrink-0 rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:ring-2 focus:ring-[#00A6FB] focus:ring-offset-2"
                  >
                    <BellIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-3 space-y-1 px-2 flex flex-col items-center">
                  <button
                    onClick={handleProfileClick}
                    className="block w-full text-center rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  >
                    Profil
                  </button>
                  <Link
                    href="/settings"
                    className="block w-full text-center rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Postavke
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-center rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  >
                    Odjava
                  </button>
                </div>
              </>
            ) : (
              <div className="px-4">
                <Link
                  href="/login"
                  className="block w-full text-center rounded-md border border-[#02404B] px-3 py-2 text-base font-medium text-[#02404B] hover:bg-gray-50"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Prijavi se
                </Link>
              </div>
            )}
          </div>
        </div>
      </Transition>

      {showSnackbar && (
        <div className="fixed top-20 right-4 bg-gray-800 text-white px-6 py-3 rounded-md shadow-lg transition-all">
          NEMA NISTA STO NISI IMPLEMENTIRAO BRETEŽ
        </div>
      )}
    </nav>
  )
}

export default NavBar