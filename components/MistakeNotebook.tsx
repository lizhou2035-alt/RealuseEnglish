
import React, { useState } from 'react';
import { MistakeItem } from '../types';

interface MistakeNotebookProps {
  mistakes: MistakeItem[];
  onBack: () => void;
}

export const MistakeNotebook: React.FC<MistakeNotebookProps> = ({ mistakes, onBack }) => {
  const [filter, setFilter] = useState<'all' | 'spelling' | 'grammar'>('all');

  const filteredMistakes = mistakes.filter(m => filter === 'all' || m.type === filter);

  return (
    <div className="max-w-5xl mx-auto w-full py-8 animate-fade-in">
      <div className="flex items-center mb-8 px-4">
        <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Mistake Notebook</h2>
          <p className="text-gray-500">Review your errors to improve faster.</p>
        </div>
      </div>

      <div className="px-4 mb-6 flex gap-2">
        {(['all', 'spelling', 'grammar'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-bold capitalize transition-all ${
              filter === f 
              ? 'bg-primary text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'All Mistakes' : f}
          </button>
        ))}
      </div>

      {filteredMistakes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300 mx-4">
          <div className="text-6xl mb-4">✨</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Mistakes Found</h3>
          <p className="text-gray-500">Great job! Or maybe start practicing to find some.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
          {filteredMistakes.map((mistake) => (
            <div key={mistake.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${mistake.type === 'spelling' ? 'bg-orange-400' : 'bg-red-500'}`}></div>
              
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  mistake.type === 'spelling' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                }`}>
                  {mistake.type}
                </span>
                <span className="text-xs text-gray-400">{mistake.date}</span>
              </div>

              <h3 className="text-xl font-bold text-gray-800 mb-1">{mistake.word}</h3>
              {mistake.context && <p className="text-sm text-gray-500 mb-4">{mistake.context}</p>}

              <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
                 {/* User Input */}
                 <div>
                    <span className="text-xs font-bold text-gray-400 uppercase block mb-1">You Wrote</span>
                    <p className="text-red-600 font-medium break-words">{mistake.userInput || '(No input)'}</p>
                 </div>

                 {/* Correction */}
                 <div>
                    <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Correction</span>
                    <p className="text-green-600 font-bold break-words">{mistake.correction}</p>
                 </div>

                 {/* Explanation for Grammar */}
                 {mistake.explanation && (
                     <div className="pt-2 border-t border-gray-200 mt-2">
                         <p className="text-gray-600 text-sm leading-relaxed">{mistake.explanation}</p>
                     </div>
                 )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
