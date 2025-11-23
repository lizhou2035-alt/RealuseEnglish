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
          <span className="text-2xl">🌍</span>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-gray-800 tracking-tight leading-none">RealUse English</h1>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">From words to real-world English</span>
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