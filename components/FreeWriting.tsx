
import React, { useState, useEffect, useRef } from 'react';
import { WritingFeedback, WordData, ChatMessage } from '../types';
import { reviewWriting, chatWithAi } from '../services/geminiService';
import { TranslationReveal } from './TranslationReveal';

interface FreeWritingProps {
  theme: string;
  words: WordData[];
  onRestart: () => void;
  onRetry: (words: WordData[]) => void;
  onContinueTheme: () => void;
  onAddPoints: (points: number) => void;
}

// Helper to render bold text from markdown-style **bold**
const formatText = (text: string) => {
    if (!text) return null;
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
    });
};

export const FreeWriting: React.FC<FreeWritingProps> = ({ theme, words, onRestart, onRetry, onContinueTheme, onAddPoints }) => {
  const [text, setText] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  
  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize selected words based on localStorage
  useEffect(() => {
    try {
      const savedJson = localStorage.getItem('linguaFlow_notebook_words');
      if (savedJson) {
        const savedList: WordData[] = JSON.parse(savedJson);
        const savedSet = new Set(savedList.map(w => w.word));
        const currentSessionSaved = new Set<string>();
        
        // Mark words as selected if they are already in the notebook
        words.forEach(w => {
          if (savedSet.has(w.word)) {
            currentSessionSaved.add(w.word);
          }
        });
        setSelectedWords(currentSessionSaved);
      }
    } catch (e) {
      console.error("Failed to load notebook words", e);
    }
  }, [words]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current && chatHistory.length > 0) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isChatting]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setIsReviewing(true);
    try {
      const result = await reviewWriting(theme, text);
      setFeedback(result);

      // Scoring: 1 point per word, max 100
      const wordCount = text.trim().split(/\s+/).length;
      const pointsEarned = Math.min(wordCount, 100);
      onAddPoints(pointsEarned);

    } catch (e) {
      console.error(e);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || isChatting || !feedback) return;

      const userMsg = chatInput;
      setChatInput('');
      setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
      setIsChatting(true);

      try {
          const aiResponse = await chatWithAi(theme, text, feedback.critique, chatHistory, userMsg);
          setChatHistory(prev => [...prev, { role: 'ai', content: aiResponse }]);
      } catch (err) {
          console.error(err);
          setChatHistory(prev => [...prev, { role: 'ai', content: "Sorry, I couldn't connect to the server." }]);
      } finally {
          setIsChatting(false);
      }
  };

  const toggleWordSelection = (wordData: WordData) => {
    const word = wordData.word;
    const newSet = new Set(selectedWords);
    
    // Helper to get current notebook
    let savedList: WordData[] = [];
    try {
      savedList = JSON.parse(localStorage.getItem('linguaFlow_notebook_words') || '[]');
    } catch (e) {
      savedList = [];
    }

    if (newSet.has(word)) {
      newSet.delete(word);
      // Remove from notebook
      savedList = savedList.filter(w => w.word !== word);
    } else {
      newSet.add(word);
      // Add to notebook if not exists
      if (!savedList.find(w => w.word === word)) {
        savedList.push(wordData);
      }
    }
    
    // Save back to storage
    localStorage.setItem('linguaFlow_notebook_words', JSON.stringify(savedList));
    setSelectedWords(newSet);
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      {!feedback ? (
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Final Challenge: Free Writing</h2>
          <p className="text-gray-500 mb-6">Write a short paragraph (3-5 sentences) about <span className="font-bold text-gray-800">"{theme}"</span> using the words you just learned.</p>
          
          {/* Word List for Reference */}
          <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Vocabulary Checklist</span>
            <div className="flex flex-wrap gap-2">
                {words.map((w, i) => (
                    <span key={i} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 shadow-sm">
                        {w.word}
                    </span>
                ))}
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-64 p-5 border-2 border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-lg transition-all resize-none font-sans"
            placeholder="Start writing here..."
            disabled={isReviewing}
          />

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || isReviewing}
              className="bg-accent text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {isReviewing ? 'Analyzing...' : 'Submit for Review'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in pb-20">
          {/* Score Card */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-primary px-8 py-6 text-white flex justify-between items-center">
               <div>
                 <h2 className="text-2xl font-bold">Writing Feedback</h2>
                 <p className="opacity-90">Here is how you did</p>
               </div>
               <div className="text-center">
                 <div className="text-4xl font-black">{feedback.score}</div>
                 <div className="text-xs uppercase tracking-widest opacity-75">Score</div>
               </div>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-gray-400 uppercase text-xs font-bold tracking-wider mb-3">AI Critique</h3>
                    <p className="text-gray-700 leading-relaxed mb-2">{feedback.critique}</p>
                    <TranslationReveal text={feedback.critiqueTranslation} />
                </div>
                <div>
                    <h3 className="text-gray-400 uppercase text-xs font-bold tracking-wider mb-3">Your Text</h3>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-600 italic">
                        "{text}"
                    </div>
                </div>
            </div>
          </div>

          {/* Improved Version */}
          <div className="bg-green-50 rounded-2xl border border-green-100 p-8 shadow-sm">
             <h3 className="text-green-800 font-bold text-lg mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Better Way to Say It
             </h3>
             <p className="text-xl text-gray-800 font-medium leading-relaxed">
                {feedback.improvedVersion}
             </p>
             <TranslationReveal text={feedback.improvedVersionTranslation} className="mt-4" />
          </div>

          {/* AI Discussion Chat */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>💬</span> Discuss with AI Tutor
              </h3>
              <div className="space-y-4 mb-4 max-h-60 overflow-y-auto pr-2">
                  {chatHistory.length === 0 && (
                      <p className="text-sm text-gray-400 italic">Have questions about the feedback? Ask here! (English preferred)</p>
                  )}
                  {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
                              msg.role === 'user' 
                                  ? 'bg-primary text-white rounded-br-none' 
                                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
                          }`}>
                              {formatText(msg.content)}
                          </div>
                      </div>
                  ))}
                   {isChatting && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-none">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></span>
                                </div>
                            </div>
                        </div>
                    )}
                  <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleChatSubmit} className="relative">
                  <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask for more tips or clarification..."
                      className="w-full pl-4 pr-12 py-3 border border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                      disabled={isChatting}
                  />
                  <button 
                      type="submit"
                      disabled={!chatInput.trim() || isChatting}
                      className="absolute right-2 top-2 bottom-2 px-3 text-primary hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                  </button>
              </form>
          </div>
          
          {/* Word Review Section */}
          <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex flex-col items-center mb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">Session Vocabulary Review</h3>
                  <p className="text-gray-400 text-sm mb-2 text-center">Tap the bookmark icon to add words to your notebook.</p>
                  {selectedWords.size > 0 && (
                      <div className="bg-blue-50 text-primary px-4 py-1 rounded-full text-sm font-bold animate-fade-in">
                          {selectedWords.size} words saved to Notebook
                      </div>
                  )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                  {words.map((w, idx) => {
                      const isSelected = selectedWords.has(w.word);
                      return (
                          <div 
                            key={idx} 
                            onClick={() => toggleWordSelection(w)}
                            className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all group ${isSelected ? 'border-primary bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-primary/50 hover:shadow-sm'}`}
                          >
                              <div className="flex justify-between items-start mb-2">
                                  <h4 className={`font-bold text-lg ${isSelected ? 'text-primary' : 'text-gray-800'}`}>{w.word}</h4>
                                  <div className={`p-1.5 rounded-full transition-colors ${isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-300 group-hover:text-primary'}`}>
                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                           <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                                       </svg>
                                  </div>
                              </div>
                              <p className="text-gray-500 text-sm mb-1">/{w.phonetic}/</p>
                              <TranslationReveal text={w.translation} />
                              
                              <div className="absolute bottom-2 right-3 text-xs font-bold text-gray-300 select-none pointer-events-none">
                                  {idx + 1}
                              </div>
                          </div>
                      );
                  })}
              </div>
              
              {/* Navigation Buttons */}
              <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <button
                      onClick={onContinueTheme}
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                      </svg>
                      Learn More Words
                      <span className="text-xs font-normal opacity-80 block -mt-0.5">(Same Topic)</span>
                    </button>

                    <button
                    onClick={onRestart}
                    className="bg-white text-gray-600 border border-gray-300 px-6 py-3 rounded-xl font-medium hover:border-primary hover:text-primary hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Start New Topic
                    </button>
                  </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};
