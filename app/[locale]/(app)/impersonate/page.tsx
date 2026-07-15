'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/firebaseConfig';

// E9.4: lands here from the admin users table with a one-shot custom token.
// Signs into Firebase, exchanges the ID token (which carries impersonatedBy)
// for the session cookie, then enters the app as the target user.
export default function ImpersonatePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const t = useTranslations('Impersonation');
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = searchParams.token;
    if (!token) {
      setError(true);
      return;
    }
    (async () => {
      try {
        const credential = await signInWithCustomToken(auth, token);
        const idToken = await credential.user.getIdToken();
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error('session');
        window.location.href = '/';
      } catch {
        setError(true);
      }
    })();
  }, [searchParams.token]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-gray-600">
      {error ? t('error') : t('working')}
    </main>
  );
}
