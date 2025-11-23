import React, { useState } from 'react';

interface TranslationRevealProps {
  text: string;
  className?: string;
}

export const TranslationReveal: React.FC<TranslationRevealProps> = ({ text, className = "" }) => {
  const [show, setShow] = useState(false);

  if (!text) return null;

  if (show) {
    return (
      <div 
        onClick={() => setShow(false)} 
        className={`animate-fade-in cursor-pointer hover:opacity-80 ${className}`}
        title="Click to hide"
      >
        <p className="text-gray-500 text-sm leading-relaxed">{text}</p>
      </div>
    );
  }

  return (
    <button 
        onClick={(e) => { e.stopPropagation(); setShow(true); }} 
        className={`text-xs font-bold text-gray-400 hover:text-primary transition-colors flex items-center gap-1 mt-1 select-none ${className}`}
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        Translate
    </button>
  );
};