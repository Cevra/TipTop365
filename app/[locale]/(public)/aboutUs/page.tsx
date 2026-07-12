'use client';
import Image from 'next/image';
import Head from 'next/head';

export default function AboutUs() {
  return (
    <>
      <Head>
        <title>About Us | Tip Top 365</title>
        <meta name="description" content="Learn about Tip Top 365's mission, values, and how we work." />
      </Head>

      {/* Hero Section */}
      <div className="relative h-[300px] w-full">
        <Image
          src="/Homepage1.jpg" // Koristimo postojeću sliku
          alt="Tip Top 365 Team"
          fill
          className="object-cover brightness-50"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center">
            Dobrodošli u Tip Top 365
          </h1>
        </div>
      </div>

      <main className="container mx-auto px-4 py-12">
        {/* About Section */}
        <section className="max-w-4xl mx-auto mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-[#02404B] mb-6 text-center">O Nama</h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              Osnovani 2024. godine kao dio Innovation Nation takmičenja, Tip Top 365 je vaše novo omiljeno rješenje za sve potrebe čišćenja. Naša platforma povezuje osobe koje traže usluge čišćenja sa pouzdanim i provjerenim čistačima, stvarajući obostrano korisno okruženje.
            </p>
          </div>
        </section>

        {/* Mission Section with Icon */}
        <section className="max-w-4xl mx-auto mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-[#02404B] rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl text-white">🎯</span>
              </div>
              <h2 className="text-3xl font-bold text-[#02404B]">Naša Misija</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Naša misija je olakšati život svima koji trebaju pomoć oko čišćenja. Kroz digitalne inovacije, omogućujemo jednostavan pristup uslugama čišćenja jednim klikom, istovremeno pružajući priliku vrijednim radnicima da pronađu posao u svojoj blizini.
            </p>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-[#02404B] text-center mb-10">Kako Funkcionišemo</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-[#02404B] rounded-full flex items-center justify-center mr-4">
                  <span className="text-xl text-white">👤</span>
                </div>
                <h3 className="text-xl font-semibold">Za Korisnike</h3>
              </div>
              <p className="text-gray-700">
                Registrujte se, pretražujte profile čistača, čitajte recenzije i pronađite savršenu osobu za vaše potrebe čišćenja.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-[#02404B] rounded-full flex items-center justify-center mr-4">
                  <span className="text-xl text-white">🧹</span>
                </div>
                <h3 className="text-xl font-semibold">Za Čistače</h3>
              </div>
              <p className="text-gray-700">
                Predstavite svoje vještine, postavite cijene i pronađite poslove u svojoj blizini kroz našu jednostavnu platformu.
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-[#02404B] text-center mb-10">Naše Vrijednosti</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🌟",
                title: "Pouzdanost",
                description: "Svi naši čistači prolaze temeljit proces provjere kako bi osigurali najviši nivo profesionalizma."
              },
              {
                icon: "💫",
                title: "Jednostavnost",
                description: "Samo nekoliko klikova vas dijeli od čistog prostora ili novog posla."
              },
              {
                icon: "✨",
                title: "Kvaliteta",
                description: "Osiguravamo vrhunsku kvalitetu usluga kroz sistem ocjenjivanja i recenzija."
              }
            ].map((value, index) => (
              <div key={index} className="bg-white rounded-lg shadow-lg p-6 text-center transform hover:scale-105 transition-transform duration-300">
                <div className="text-4xl mb-4">{value.icon}</div>
                <h3 className="text-xl font-semibold text-[#02404B] mb-3">{value.title}</h3>
                <p className="text-gray-700">{value.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-[#02404B] text-center mb-8">Zašto Odabrati Tip Top 365?</h2>
            <div className="grid gap-4">
              {[
                "Brza i laka registracija u nekoliko jednostavnih koraka",
                "Provjereni i pouzdani čistači sa verifikovanim profilima",
                "Sistem recenzija i ocjena za informisano odlučivanje",
                "24/7 korisnička podrška za sva vaša pitanja"
              ].map((item, index) => (
                <div key={index} className="flex items-center p-4 bg-gray-50 rounded-lg">
                  <svg className="w-6 h-6 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}