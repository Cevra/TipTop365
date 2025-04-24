"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebaseConfig';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#02404B]"></div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 