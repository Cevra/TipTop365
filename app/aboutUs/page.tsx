'use client';
import Head from 'next/head'
import '../aboutUs/styles.css';
import NavBar from '..//components/NavBar';
import Footer from '..//components/Footer';


export default function AboutUs() {
  return (
    <>
      <Head>
        <title>About Us | Tip Top 365</title>
        <meta name="description" content="Learn about Tip Top 365's mission, values, and how we work." />
      </Head>

      <main className="container mx-auto px-6 py-10">
        <section className="mb-12">
          <h1>O Nama</h1>
          <p>Dobrodošli na Tip Top 365, vaše novo omiljeno rješenje za sve potrebe čišćenja! Osnovani smo 2024. godine kao dio Innovation Nation takmičenja, s misijom da vam pomognemo da na jednostavan, brz i efikasan način pronađete usluge čišćenja ili se registrujete kao pružatelj tih usluga. Naša platforma je osmišljena kako bi povezala osobe koje traže usluge čišćenja sa pouzdanim i provjerenim čistačima, stvarajući obostrano korisno okruženje.</p>
          <hr />
        </section>
        
        <section className="mb-12">
          <h2>Naša Misija</h2>
          <p>Naša misija je olakšati život svima koji trebaju pomoć oko čišćenja, bilo da se radi o domaćinstvu, kancelariji ili nekom drugom prostoru. U isto vrijeme, pružamo priliku vrijednim radnicima da se registruju kao čistači i pronađu posao u svojoj blizini. Tip Top 365 nastoji unijeti revoluciju u sektor čišćenja kroz digitalne inovacije, omogućujući korisnicima jednostavan pristup uslugama čišćenja jednim klikom.</p>        
          <hr />
        </section>

        <section className="mb-12">
          <h2>Kako Funkcionišemo</h2>
          <p>Na Tip Top 365 možete se registrirati na dva načina: kao korisnik koji traži usluge čišćenja ili kao čistač koji nudi svoje usluge. Proces je jednostavan i brz. Kao korisnik, možete pretraživati profile čistača, čitati recenzije i ocjene, te odabrati osobu koja najbolje odgovara vašim potrebama. Kao čistač, imate priliku predstaviti svoje vještine, postaviti cijene i pronaći poslove u svojoj blizini.</p>
          <hr />
        </section>

        <section className="mb-12">
          <h2>Naše Vrijednosti</h2>
          <div className="flex flex-col md:flex-row justify-center items-center space-y-8 md:space-y-0 md:space-x-16">
            <div className="bg-white p-4 rounded-lg shadow-md w-full md:w-auto">
              <h3 className="text-xl font-semibold mb-2">Pouzdanost</h3>
              <p className="text-gray-600">Vjerujemo u pružanje pouzdane usluge. Svi naši čistači prolaze temeljit proces provjere kako bi osigurali najviši nivo profesionalizma i povjerenja.</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md w-full md:w-auto">
              <h3 className="text-xl font-semibold mb-2">Jednostavnost</h3>
              <p className="text-gray-600">Naša platforma je dizajnirana da bude jednostavna za korištenje, bilo da tražite usluge čišćenja ili nudite svoje. Samo nekoliko klikova vas dijeli od čistog prostora ili novog posla.</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md w-full md:w-auto">
              <h3 className="text-xl font-semibold mb-2">Kvaliteta</h3>
              <p className="text-gray-600">Cilj nam je osigurati vrhunsku kvalitetu usluga čišćenja. Pružamo vam mogućnost da ocijenite usluge koje ste primili, čime kontinuirano unapređujemo našu zajednicu.</p>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2>Zašto Odabrati Tip Top 365?</h2>
          <ul>
            <li>Brzu i laku registraciju: Postanite član naše zajednice u nekoliko jednostavnih koraka.</li>
            <li>Provjerene i pouzdane čistače: Naša temeljita provjera osigurava da radite s najboljima.</li>
            <li>Recenzije i ocjene: Pročitajte iskustva drugih korisnika i donesite informisanu odluku.</li>
            <li>Korisničku podršku: Naš tim je uvijek tu da vam pomogne sa bilo kojim pitanjima ili problemima</li>
          </ul>
          <hr />

        </section>
      </main>
    </>
  )
}