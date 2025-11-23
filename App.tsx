
import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { ThemeSelector } from './components/ThemeSelector';
import { WordLearning } from './components/WordLearning';
import { ArticleView } from './components/ArticleView';
import { FreeWriting } from './components/FreeWriting';
import { Notebook } from './components/Notebook';
import { AppStage, WordData, ArticleData, DifficultyLevel, LearningSession } from './types';
import { generateVocabulary, generateArticle, generateWordDetails } from './services/geminiService';

function App() {
  const [stage, setStage] = useState<AppStage>(AppStage.THEME_SELECTION);
  const [theme, setTheme] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('B2');
  const [words, setWords] = useState<WordData[]>([]);
  const [learningList, setLearningList] = useState<WordData[]>([]);
  const [historyWords, setHistoryWords] = useState<Set<string>>(new Set());
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [customWordInput, setCustomWordInput] = useState('');
  
  const [learningHistory, setLearningHistory] = useState<LearningSession[]>([]);

  // Points State
  const [points, setPoints] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [sessionFinalScore, setSessionFinalScore] = useState(0);

  // Ref for scrolling to the bottom of the list when adding words
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    const stored = localStorage.getItem('linguaFlow_history');
    if (stored) {
        try {
            setLearningHistory(JSON.parse(stored));
        } catch (e) {
            console.error("Failed to parse history", e);
        }
    }
  }, []);

  // Trigger article generation when entering the stage
  useEffect(() => {
    if (stage === AppStage.ARTICLE_GENERATION) {
        const fetchArticle = async () => {
            // If we already have an article for this exact set of words, skip generation
            // But here we assume a new session needs a new article
            if (article) {
                setStage(AppStage.ARTICLE_STUDY);
                return;
            }

            try {
                const simpleWords = words.map(w => w.word);
                const newArticle = await generateArticle(theme, simpleWords);
                setArticle(newArticle);
                setStage(AppStage.ARTICLE_STUDY);
            } catch (error) {
                console.error("Failed to generate article:", error);
                // Fallback to writing if article fails
                setStage(AppStage.FREE_WRITING); 
            }
        };
        fetchArticle();
    }
  }, [stage, article, theme, words]);

  const saveSessionToHistory = (newTheme: string, newWords: WordData[], newDifficulty: string) => {
      if (newWords.length === 0) return;
      
      const newSession: LearningSession = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString(),
          theme: newTheme,
          words: newWords,
          difficulty: newDifficulty
      };

      const updatedHistory = [newSession, ...learningHistory];
      setLearningHistory(updatedHistory);
      localStorage.setItem('linguaFlow_history', JSON.stringify(updatedHistory));
  };

  const handleThemeSelect = async (selectedTheme: string, selectedDifficulty: DifficultyLevel) => {
    setTheme(selectedTheme);
    setDifficulty(selectedDifficulty);
    setIsLoading(true);
    // Reset history for new theme
    const newHistory = new Set<string>();
    setLearningList([]);
    
    // Reset points for new session
    setPoints(0);
    
    try {
      const generatedWords = await generateVocabulary(selectedTheme, selectedDifficulty, []);
      
      generatedWords.forEach(w => newHistory.add(w.word.toLowerCase()));
      setHistoryWords(newHistory);
      setWords(generatedWords);
      setStage(AppStage.VOCAB_PREVIEW);
    } catch (error) {
      console.error("Error generating vocabulary:", error);
      alert("Failed to generate lesson. Please check your API key or try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCustomSession = async (inputString: string) => {
    setIsLoading(true);
    setPoints(0); // Reset points

    const wordList = inputString.split(/[,\s\n\t\u3000\uFF0C\u3001\u2013\u2014-]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);
    
    if (wordList.length === 0) {
        setIsLoading(false);
        return;
    }

    const distinctWords = [...new Set(wordList)];
    setTheme("Custom Session");
    setDifficulty("B2"); // Default
    
    try {
        // Fetch details for all words in parallel
        const promises = distinctWords.map(w => generateWordDetails(w, "General", "B2"));
        const results = await Promise.all(promises);
        
        setWords(results);
        setLearningList([]); // Reset learning list so user interacts only with the grid
        setHistoryWords(new Set(results.map(w => w.word.toLowerCase())));
        setStage(AppStage.VOCAB_PREVIEW);
    } catch (error) {
        console.error("Error creating custom session:", error);
        alert("Failed to fetch details for some words.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegenerateWords = async () => {
      setIsLoading(true);
      try {
          const excludeList = Array.from(historyWords) as string[];
          const generatedWords = await generateVocabulary(theme, difficulty, excludeList);
          
          // Add new words to history
          const updatedHistory = new Set(historyWords);
          generatedWords.forEach(w => updatedHistory.add(w.word.toLowerCase()));
          setHistoryWords(updatedHistory);
          
          setWords(generatedWords);
          
          // Scroll to top of grid to see new words
          window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
          console.error("Error generating words:", error);
          alert("Failed to generate new words.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleAddBatch = async () => {
    if (words.length === 0) return;
    
    // Add current words to learning list
    setLearningList(prev => [...prev, ...words]);
    
    // Automatically fetch next batch
    await handleRegenerateWords();
  };

  const handleAddCustomWord = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!customWordInput.trim()) return;

      setIsAddingWord(true);
      try {
           // Split input by commas, spaces, newlines, chinese comma, etc.
           const wordList = customWordInput.split(/[,\s\n\t\u3000\uFF0C\u3001\u2013\u2014-]+/)
                .map(w => w.trim())
                .filter(w => w.length > 0);

           const distinctWords = [...new Set(wordList)];
           
           if (distinctWords.length === 0) return;

           const promises = distinctWords.map(w => generateWordDetails(w, theme || "General", difficulty));
           const results = await Promise.all(promises);

           setWords(prev => [...prev, ...results]);
           setHistoryWords(prev => {
               const next = new Set(prev);
               results.forEach(r => next.add(r.word.toLowerCase()));
               return next;
           });
           setCustomWordInput('');
      } catch (error) {
          console.error("Error adding custom word:", error);
          alert("Failed to add word info. Please check if the word is valid.");
      } finally {
          setIsAddingWord(false);
      }
  };

  const handleDeleteWord = (index: number) => {
    setWords(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartLearning = () => {
    // Combine accumulated learning list with current grid words
    const combined = [...learningList, ...words];
    
    // De-duplicate in case of overlap
    const uniqueMap = new Map();
    combined.forEach(w => uniqueMap.set(w.word, w));
    const finalWords = Array.from(uniqueMap.values());

    if (finalWords.length === 0) {
        alert("You need at least one word to start.");
        return;
    }

    setWords(finalWords); 
    // Save to history
    saveSessionToHistory(theme || "Custom Session", finalWords, difficulty);
    setStage(AppStage.WORD_LEARNING);
  };

  const handleWordsComplete = async () => {
    setStage(AppStage.ARTICLE_GENERATION);
  };

  const handleArticleComplete = () => {
    setStage(AppStage.FREE_WRITING);
  };

  const handleContinueTheme = async () => {
      triggerCelebration(() => {
          // Move current words to 'Already Added' list (learningList)
          setLearningList(prev => {
              const existing = new Set(prev.map(w => w.word));
              const uniqueCurrent = words.filter(w => !existing.has(w.word));
              return [...prev, ...uniqueCurrent];
          });

          setIsLoading(true);
          setArticle(null); // Clear previous article
          setWords([]); // Clear grid while loading

          // Reset points for next session? The prompt implies "enter next theme" after score shows.
          // Usually "Continue Theme" keeps score, but prompt said "Finish theme show score then enter next".
          // I will reset points to keep the "Finish" feeling distinct.
          setPoints(0); 

          const next = async () => {
             try {
                // Update exclusion list with all currently known words
                const excludeSet = new Set(historyWords);
                words.forEach(w => excludeSet.add(w.word.toLowerCase()));
                setHistoryWords(excludeSet);

                // Generate new words
                const generatedWords = await generateVocabulary(theme, difficulty, Array.from(excludeSet));
                
                // Add newly generated words to history
                const finalHistory = new Set(excludeSet);
                generatedWords.forEach(w => finalHistory.add(w.word.toLowerCase()));
                setHistoryWords(finalHistory);

                setWords(generatedWords);
                setStage(AppStage.VOCAB_PREVIEW);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (error) {
                console.error("Error continuing theme:", error);
                alert("Failed to generate more words. Please try again.");
            } finally {
                setIsLoading(false);
            }
          }
          next();
      });
  };

  const handleReset = () => {
     // Trigger celebration only if coming from a completed state? 
     // If clicking header reset during selection, no celebration.
     // If clicking "Start New Topic" in FreeWriting, celebration first.
     
     // Direct reset:
     setStage(AppStage.THEME_SELECTION);
     setTheme('');
     setWords([]);
     setLearningList([]);
     setHistoryWords(new Set());
     setArticle(null);
     setIsLoading(false);
     setPoints(0);
  };

  const handleFinishSession = () => {
      triggerCelebration(() => {
          handleReset();
      });
  };

  const triggerCelebration = (callback: () => void) => {
      setSessionFinalScore(points);
      setShowCelebration(true);
      // Wait for animation then callback
      setTimeout(() => {
          setShowCelebration(false);
          callback();
      }, 3500);
  };

  const handleOpenNotebook = () => {
      setStage(AppStage.NOTEBOOK);
  };

  const handleLoadSession = (session: LearningSession) => {
      setTheme(session.theme);
      setWords(session.words);
      setLearningList([]); // Reset learning list so edits to 'words' are respected
      setDifficulty(session.difficulty as DifficultyLevel);
      setStage(AppStage.VOCAB_PREVIEW);
      setPoints(0);
  };

  const handlePracticeReview = (selectedWords: WordData[]) => {
     setWords(selectedWords);
     setLearningList([]); // Reset learning list
     // We go back to preview so the user can see their list and hit start
     setStage(AppStage.VOCAB_PREVIEW);
     window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleAddPoints = (amount: number) => {
      setPoints(prev => prev + amount);
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-gray-800 font-sans relative">
      <Header onReset={handleReset} points={points} />
      
      {/* Celebration Overlay */}
      {showCelebration && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 animate-fade-in backdrop-blur-sm">
              <div className="text-center text-white p-8 animate-bounce-in">
                  <div className="text-8xl mb-4 animate-wiggle">🎉</div>
                  <h2 className="text-4xl font-bold mb-2">Theme Completed!</h2>
                  <div className="text-2xl opacity-90 mb-8">You did a great job.</div>
                  <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl transform hover:scale-105 transition-transform">
                      <div className="text-sm uppercase tracking-widest font-bold text-yellow-300 mb-2">Total Score</div>
                      <div className="text-7xl font-black text-yellow-400 drop-shadow-md">{sessionFinalScore}</div>
                  </div>
              </div>
              {/* Simple CSS Confetti dots */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(50)].map((_, i) => (
                      <div 
                        key={i}
                        className="absolute w-3 h-3 rounded-full"
                        style={{
                            backgroundColor: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][Math.floor(Math.random() * 5)],
                            left: `${Math.random() * 100}%`,
                            top: `-10%`,
                            animation: `fall ${2 + Math.random() * 3}s linear forwards`,
                            animationDelay: `${Math.random() * 2}s`
                        }}
                      />
                  ))}
              </div>
              <style>{`
                @keyframes fall {
                    to { transform: translateY(110vh) rotate(720deg); }
                }
                @keyframes bounce-in {
                    0% { transform: scale(0.5); opacity: 0; }
                    60% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); }
                }
                @keyframes wiggle {
                    0%, 100% { transform: rotate(-3deg); }
                    50% { transform: rotate(3deg); }
                }
              `}</style>
          </div>
      )}

      <main className="container mx-auto px-4 py-8 pb-32">
        {stage === AppStage.THEME_SELECTION && (
          <ThemeSelector 
            onSelectTheme={handleThemeSelect} 
            onStartCustom={handleStartCustomSession}
            history={learningHistory}
            onLoadSession={handleLoadSession}
            onOpenNotebook={handleOpenNotebook}
            isLoading={isLoading} 
          />
        )}
        
        {stage === AppStage.NOTEBOOK && (
            <Notebook 
                history={learningHistory} 
                onLoadSession={handleLoadSession} 
                onBack={handleReset} 
            />
        )}

        {stage === AppStage.VOCAB_PREVIEW && (
           <div className="max-w-5xl mx-auto">
             
             {/* Top Section: Accumulated List */}
             {learningList.length > 0 && (
                 <div className="mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                            Already Added ({learningList.length})
                        </h3>
                    </div>
                    <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
                        {learningList.map((w, i) => (
                            <div key={i} className="flex-shrink-0 bg-green-50 text-green-800 border border-green-100 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap">
                                {i + 1}. {w.word}
                            </div>
                        ))}
                    </div>
                 </div>
             )}

             <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 relative">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Build Your Lesson</h2>
                        <p className="text-gray-500 mt-1">
                            Topic: <span className="font-semibold text-primary">{theme}</span> ({difficulty})
                        </p>
                    </div>
                    
                    {/* Custom Word Input */}
                    <form onSubmit={handleAddCustomWord} className="flex items-center gap-2 w-full md:w-auto">
                        <textarea 
                            value={customWordInput}
                            onChange={(e) => setCustomWordInput(e.target.value)}
                            placeholder="Add extra words here..." 
                            className="flex-1 md:w-64 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:border-primary outline-none transition-all min-h-[42px] max-h-[80px] resize-y"
                            disabled={isAddingWord || isLoading}
                        />
                        <button 
                            type="submit"
                            disabled={!customWordInput.trim() || isAddingWord || isLoading}
                            className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-md self-start"
                        >
                            {isAddingWord ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            )}
                        </button>
                    </form>
                </div>
                
                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {words.map((word, idx) => (
                    <div key={idx} className="relative group p-5 bg-white rounded-xl border border-gray-200 hover:border-primary/50 hover:shadow-md transition-all text-center flex flex-col justify-center h-full min-h-[160px]">
                      <button 
                        onClick={() => handleDeleteWord(idx)}
                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors p-1 z-10"
                        title="Remove word"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      
                      <div className="mb-4 mt-2">
                           <h3 className="font-bold text-xl text-gray-800">{word.word}</h3>
                      </div>
                      
                      <div className="flex justify-center gap-2 items-center mb-2">
                        <p className="text-xs text-gray-400 font-mono">/{word.phonetic}/</p>
                        {word.partOfSpeech && (
                          <span className="text-[10px] font-bold text-white bg-gray-400 px-1.5 py-0.5 rounded uppercase">
                            {word.partOfSpeech}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 font-medium">{word.translation}</p>

                      {/* Numbering in Bottom Right (Small Font) */}
                      <div className="absolute bottom-2 right-3 text-xs font-bold text-gray-400 select-none pointer-events-none">
                          {learningList.length + idx + 1}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col items-center space-y-4 max-w-lg mx-auto" ref={bottomRef}>
                    {theme !== "Custom Session" && (
                        <button 
                            onClick={handleAddBatch}
                            disabled={words.length === 0 || isLoading}
                            className="w-full bg-white border-2 border-primary text-primary text-lg font-bold py-3 rounded-2xl hover:bg-blue-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:transform-none"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add {words.length} More Words
                        </button>
                    )}

                    <button 
                        onClick={handleStartLearning}
                        className="w-full bg-emerald-500 text-white text-xl font-bold py-4 rounded-2xl shadow-lg hover:bg-emerald-600 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                    >
                        Start Learning ({learningList.length + words.length} Words)
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                    </button>

                    <div className="pt-2">
                        <button 
                            onClick={handleRegenerateWords}
                            disabled={isLoading || theme === "Custom Session"}
                            className="text-gray-400 font-medium hover:text-gray-600 transition-colors flex items-center gap-1 text-sm disabled:opacity-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh Batch
                        </button>
                    </div>
                </div>
             </div>
           </div>
        )}

        {stage === AppStage.WORD_LEARNING && (
           <WordLearning 
                words={words} 
                onComplete={handleWordsComplete} 
                theme={theme} 
                onAddPoints={handleAddPoints}
           />
        )}

        {stage === AppStage.ARTICLE_GENERATION && (
           <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
              <div>
                <p className="text-xl font-medium text-gray-600">Writing a short story with your words...</p>
                <p className="text-sm text-gray-400">This helps context retention!</p>
              </div>
           </div>
        )}

        {stage === AppStage.ARTICLE_STUDY && article && (
          <ArticleView 
            article={article} 
            onComplete={handleArticleComplete} 
            highlightWords={words.map(w => w.word)}
            onAddPoints={handleAddPoints}
          />
        )}

        {stage === AppStage.FREE_WRITING && (
          <FreeWriting 
            theme={theme} 
            words={words}
            onRestart={handleFinishSession} 
            onRetry={handlePracticeReview}
            onContinueTheme={handleContinueTheme}
            onAddPoints={handleAddPoints}
          />
        )}
      </main>
    </div>
  );
}

export default App;
