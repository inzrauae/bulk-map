
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="mb-8 text-center">
      <div className="inline-flex items-center justify-center p-3 bg-emerald-600 rounded-2xl shadow-lg mb-4">
        <i className="fa-solid fa-earth-asia text-3xl text-white animate-spin-globe"></i>
      </div>
      <h1 className="text-3xl font-bold text-white tracking-tight">
        INZRA Bulk Map Point Generator
      </h1>
      <p className="text-blue-200 mt-2 max-w-md mx-auto">
        Version 6.1 - Professional bulk coordinate generation for precise map analysis and geospatial data mapping.
      </p>
      <a 
        href="https://www.inzra.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-emerald-600 text-sm font-bold mt-2 hover:underline inline-block"
      >
        www.inzra.com
      </a>
      <span className="text-blue-300 text-sm mx-2">•</span>
      <a
        href="https://seoservice.lk"
        target="_blank"
        rel="noopener"
        className="text-emerald-600 text-sm font-bold mt-2 hover:underline inline-block"
      >
        SEO Service Sri Lanka
      </a>
    </header>
  );
};

export default Header;
