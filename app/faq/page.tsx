'use client'

import { useState } from 'react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

const FAQAccordion = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleAccordion = (index: number) => {
    setActiveIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  const accordionData = [
    {
      question: "What is Flowbite?",
      answer:
        "Flowbite is an open-source library of interactive components built on top of Tailwind CSS including buttons, dropdowns, modals, navbars, and more. Flowbite provides reusable components that help speed up the development of web interfaces.",
    },
    {
      question: "Is there a Figma file available?",
      answer:
        "Flowbite is first conceptualized and designed using the Figma software, so everything you see in the library has a design equivalent in our Figma file.",
    },
    {
      question: "What are the differences between Flowbite and Tailwind UI?",
      answer:
        "The main difference is that Flowbite's core components are open source under the MIT license, while Tailwind UI is a paid product.",
    },
  ];

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-7xl mx-auto px-6 md:px-16 lg:px-32 py-8">
          {/* Section 1 */}
          <div className="mb-10">
            <h2 className="text-[40px] font-semibold text-[#001A1E] font-roboto mb-4">Profile</h2>
            {accordionData.map((item, index) => (
              <div key={index} className="mb-4 border-b">
                <button
                  type="button"
                  className="flex justify-between w-full text-[20px] p-5 text-left text-gray-600 font-medium bg-white "
                  onClick={() => toggleAccordion(index)}
                >
                  <span>{item.question}</span>
                  <svg
                    className={`w-4 h-4 transform transition-transform ${
                      activeIndex === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {activeIndex === index && (
                  <div className="p-5 bg-white border-t-0 border-gray-200">
                    <p className="text-gray-500">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Section 2 */}
          <div className="mb-10">
            <h2 className="text-[40px] font-semibold text-[#001A1E] font-roboto mb-4">Rezervacija</h2>
            {accordionData.map((item, index) => (
              <div key={index} className="mb-4 border-b">
                <button
                  type="button"
                  className="flex justify-between w-full  p-5 text-left text-[20px] text-gray-600 font-medium bg-white border border-gray-200 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  onClick={() => toggleAccordion(index)}
                >
                  <span>{item.question}</span>
                  <svg
                    className={`w-4 h-4 transform transition-transform ${
                      activeIndex === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {activeIndex === index && (
                  <div className="p-5 bg-white border border-t-0 border-gray-200">
                    <p className="text-gray-500">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-[40px] font-semibold text-[#001A1E] font-roboto mb-4">Plaćanja</h2>
            {accordionData.map((item, index) => (
              <div key={index} className="mb-4 border-b">
                <button
                  type="button"
                  className="flex justify-between w-full text-[20px] p-5 text-left text-gray-600 font-medium bg-white border border-gray-200 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200"
                  onClick={() => toggleAccordion(index)}
                >
                  <span>{item.question}</span>
                  <svg
                    className={`w-4 h-4 transform transition-transform ${
                      activeIndex === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {activeIndex === index && (
                  <div className="p-5 bg-white border border-t-0 border-gray-200">
                    <p className="text-gray-500">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FAQAccordion;