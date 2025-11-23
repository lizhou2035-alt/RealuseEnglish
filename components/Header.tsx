
import React from 'react';

interface HeaderProps {
  onReset: () => void;
  points: number;
}

export const Header: React.FC<HeaderProps> = ({ onReset, points }) => {
  return (
    <header className="bg-surface shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onReset}>
           {/* Custom Green Globe Logo */}
           <div className="w-10 h-10 relative">
               <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                   <circle cx="20" cy="20" r="20" fill="#10B981" />
                   <path d="M5 20C5 20 12 16 20 16C28 16 35 20 35 20" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                   <path d="M20 5C20 5 16 12 16 20C16 28 20 35 20 35" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                   <path d="M5 20C5 28.2843 11.7157 35 20 35C28.2843 35 35 28.2843 35 20C35 11.7157 28.2843 5 20 5C11.7157 5 5 11.7157 5 20Z" stroke="white" strokeWidth="2"/>
                   
                   {/* Chat bubble overlay */}
                   <g transform="translate(18, 8)">
                       <path d="M0 6C0 2.68629 2.68629 0 6 0H14C17.3137 0 20 2.68629 20 6V12C20 15.3137 17.3137 18 14 18H6L0 22V6Z" fill="white"/>
                       <circle cx="6" cy="9" r="2" fill="#10B981"/>
                       <circle cx="12" cy="9" r="2" fill="#10B981"/>
                       <circle cx="18" cy="9" r="2" fill="#10B981"/>
                   </g>
                   
                   {/* Arrow swoosh */}
                   <path d="M8 30C8 30 15 35 25 32L30 28" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                   <path d="M28 28H30V30" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
               </svg>
           </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight leading-none">RealUse English</h1>
            {/* Slogan moved to home page, simplified header text */}
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
          <span className="text-xl">⭐</span>
          <span className="font-bold text-yellow-700">{points} Points</span>
        </div>
      </div>
    </header>
  );
};
