import React from 'react';
import { LearningSession } from '../types';

interface NotebookProps {
  history: LearningSession[];
  onLoadSession: (session: LearningSession) => void;
  onBack: () => void;
}

export const Notebook: React.FC<NotebookProps> = ({ history, onLoadSession, onBack }) => {
  return (
    <div className="max-w-5xl mx-auto w-full py-8">
        <div className="flex items-center mb-8">
            <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
            </button>
            <div>
                <h2 className="text-3xl font-bold text-gray-900">Your Notebook</h2>
                <p className="text-gray-500">Review your past learning sessions.</p>
            </div>
        </div>

        {history.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                <div className="text-6xl mb-4">📓</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Notebook is Empty</h3>
                <p className="text-gray-500">Start a lesson to save words here!</p>
                <button onClick={onBack} className="mt-6 px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary/90">
                    Start Learning
                </button>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map((session) => (
                    <div key={session.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className="inline-block px-2 py-1 text-xs font-bold bg-blue-50 text-blue-600 rounded mb-2">
                                    {session.difficulty || 'Custom'}
                                </span>
                                <h3 className="text-xl font-bold text-gray-800 line-clamp-1" title={session.theme}>{session.theme}</h3>
                                <p className="text-xs text-gray-400 mt-1">{session.date}</p>
                            </div>
                            <div className="bg-gray-50 text-gray-600 font-bold px-3 py-1 rounded-lg text-sm">
                                {session.words.length}
                            </div>
                        </div>
                        
                        <div className="flex-1 mb-6">
                            <div className="flex flex-wrap gap-2">
                                {session.words.slice(0, 5).map((w, i) => (
                                    <span key={i} className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                        {w.word}
                                    </span>
                                ))}
                                {session.words.length > 5 && (
                                    <span className="text-sm text-gray-400 px-1">+{session.words.length - 5} more</span>
                                )}
                            </div>
                        </div>

                        <button 
                            onClick={() => onLoadSession(session)}
                            className="w-full py-3 rounded-xl border border-primary text-primary font-bold hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            Review Session
                        </button>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};