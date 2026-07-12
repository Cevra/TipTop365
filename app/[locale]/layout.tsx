import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '../globals.css';
import NavBar from '@/app/components/NavBar';
import Footer from '@/app/components/Footer';
import { AuthProvider } from '@/contexts/AuthContext';
import { routing } from '@/i18n/routing';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  icons: {
    icon: ['/favicon.ico?v=4'],
    apple: ['/apple-touch-icon.png?v=4'],
    shortcut: ['/apple-touch-icon.png?v=4'],
  },
  title: 'TipTop365 — Your cleaning marketplace',
  description:
    'Connect with vetted cleaners in Bosnia. Book cleaning online with fixed, upfront pricing.',
};

// Pre-render both locales at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as never)) {
    notFound();
  }
  // Enable static rendering for this request's locale.
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable}>
      <body className={`${inter.className} bg-white dark:bg-gray-900`}>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <NavBar />
              <main className="flex-grow">{children}</main>
              <Footer />
            </div>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
