
import React, { useState, useEffect, useRef } from 'react';
import { WordData, SentenceFeedback, ChatMessage, PronunciationResult } from '../types';
import { generateSpeech, checkSentence, askGrammarQuestion, evaluatePronunciation } from '../services/geminiService';
import { decodeBase64, decodeAudioData, playAudioBuffer, getAudioContext, stopGlobalAudio, blobToBase64 } from '../services/audioUtils';
import { TranslationReveal } from './TranslationReveal';

interface WordLearningProps {
  words: WordData[];
  onComplete: () => void;
  theme?: string;
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

export const WordLearning: React.FC<WordLearningProps> = ({ words, onComplete, theme, onAddPoints }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [writeCount, setWriteCount] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [step, setStep] = useState<'learn' | 'write_word' | 'copy_sentence' | 'make_sentence'>('learn');
  
  // Interactive Syllable State
  const [userSplits, setUserSplits] = useState<Set<number>>(new Set());
  const [userStress, setUserStress] = useState<Set<number>>(new Set());
  
  const [sentenceInput, setSentenceInput] = useState('');
  const [feedback, setFeedback] = useState<SentenceFeedback | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [wordError, setWordError] = useState<string | null>(null);
  
  // Scoring tracking to prevent double points
  const [hasAwardedSentencePoints, setHasAwardedSentencePoints] = useState(false);
  const [hasAwardedPronunciationPoints, setHasAwardedPronunciationPoints] = useState(false);

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [pronunciationResult, setPronunciationResult] = useState<PronunciationResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Silence Detection Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isSpeakingRef = useRef(false);
  const lastSpeakingTimeRef = useRef(0);

  const currentWord = words[currentIndex];
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Audio Refs
  const currentAudioIdRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopGlobalAudio();
      stopRecording();
    };
  }, []);

  // Reset state when word changes
  useEffect(() => {
    setUserSplits(new Set());
    setUserStress(new Set());
    setCopyError(null);
    setWordError(null);
    setHasAwardedSentencePoints(false);
    setHasAwardedPronunciationPoints(false);
    setPronunciationResult(null);
    setIsRecording(false);
    setIsAnalyzingAudio(false);
    stopRecording(); // Ensure any active recording is stopped
    
    stopGlobalAudio();
    setIsPlaying(false);
    
    // Scroll the active pill into view
    if (scrollRef.current) {
        const activeButton = scrollRef.current.children[currentIndex] as HTMLElement;
        if (activeButton) {
            activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
  }, [currentIndex]);

  // Reset error when input changes
  useEffect(() => {
    setCopyError(null);
    setWordError(null);
  }, [currentInput]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current && chatHistory.length > 0) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isAsking]);

  // Audio Auto-play Effect
  useEffect(() => {
    if (step === 'learn') {
      handlePlayAudio(currentWord.word);
    } else if (step === 'write_word') {
       if (writeCount === 0 || writeCount === 2) {
         handlePlayAudio(currentWord.word);
       }
    } else if (step === 'copy_sentence') {
       handlePlayAudio(currentWord.exampleSentence);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, step, writeCount]);

  const handlePlayAudio = async (text: string) => {
    const audioId = ++currentAudioIdRef.current;

    // Indicate loading state immediately
    setIsPlaying(true);
    
    // Stop any previous audio to ensure clean slate
    stopGlobalAudio();
    
    try {
      const base64Audio = await generateSpeech(text);
      
      // Check if component is still mounted and this is the latest request
      if (!isMountedRef.current || audioId !== currentAudioIdRef.current) return;

      if (base64Audio) {
        const ctx = getAudioContext();
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx);
        
        if (!isMountedRef.current || audioId !== currentAudioIdRef.current) return;

        playAudioBuffer(audioBuffer, () => {
             if (isMountedRef.current && audioId === currentAudioIdRef.current) {
                 setIsPlaying(false);
             }
        });
      } else {
        if (isMountedRef.current) setIsPlaying(false);
      }
    } catch (e) {
      console.error(e);
      if (isMountedRef.current && audioId === currentAudioIdRef.current) {
          setIsPlaying(false);
      }
    }
  };

  const toggleRecording = async (targetText: string) => {
    if (isRecording) {
        stopRecording(targetText);
    } else {
        startRecording(targetText);
    }
  };

  const startRecording = async (targetText: string) => {
    setPronunciationResult(null);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);

        // --- Silence Detection Setup ---
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        
        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Reset detection state
        isSpeakingRef.current = false;
        lastSpeakingTimeRef.current = Date.now();
        
        const detectSilence = () => {
            if (!analyserRef.current) return;
            
            analyserRef.current.getByteTimeDomainData(dataArray);
            
            // Calculate RMS Volume
            let sum = 0;
            for(let i = 0; i < bufferLength; i++) {
                const x = (dataArray[i] - 128) / 128.0;
                sum += x * x;
            }
            const rms = Math.sqrt(sum / bufferLength);
            const THRESHOLD = 0.015; // Speaking threshold
            
            if (rms > THRESHOLD) {
                isSpeakingRef.current = true;
                lastSpeakingTimeRef.current = Date.now();
            }
            
            const now = Date.now();
            
            // If speech started and then silence for > 1.2s, stop
            if (isSpeakingRef.current && (now - lastSpeakingTimeRef.current > 1200)) {
                stopRecording(targetText);
                return;
            }
            
            // Safety timeout: If no speech for 8 seconds, stop
            if (!isSpeakingRef.current && (now - lastSpeakingTimeRef.current > 8000)) {
                stopRecording(); // Stop without analyzing
                return;
            }
            
            animationFrameRef.current = requestAnimationFrame(detectSilence);
        };
        
        detectSilence();

    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = (targetText?: string) => {
      // Clean up silence detection resources
      if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
      }
      if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
      }
      if (analyserRef.current) {
          analyserRef.current.disconnect();
          analyserRef.current = null;
      }
      if (audioContextRef.current) {
          audioContextRef.current.close().catch(e => console.error(e));
          audioContextRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          if (targetText) {
             mediaRecorderRef.current.onstop = async () => {
                 const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
                 
                 // Stop all tracks
                 mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
                 
                 handleAnalyzeAudio(audioBlob, targetText);
             };
          } else {
             // Cleanup mode: just stop tracks, don't analyze
             mediaRecorderRef.current.onstop = null;
             mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
          }
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const handleAnalyzeAudio = async (blob: Blob, targetText: string) => {
      setIsAnalyzingAudio(true);
      try {
          const base64 = await blobToBase64(blob);
          const result = await evaluatePronunciation(base64, targetText);
          if (isMountedRef.current) {
              setPronunciationResult(result);
              // Bonus points for completing pronunciation (score >= 60)
              if (result.score >= 60 && !hasAwardedPronunciationPoints) {
                  onAddPoints(5);
                  setHasAwardedPronunciationPoints(true);
              }
          }
      } catch (error) {
          console.error("Pronunciation analysis failed:", error);
          alert("Failed to analyze pronunciation. Please try again.");
      } finally {
          if (isMountedRef.current) {
              setIsAnalyzingAudio(false);
          }
      }
  };

  const handleWordInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentInput.toLowerCase().trim() === currentWord.word.toLowerCase()) {
      // Scoring: 0 & 1 are copying (+1), 2 is memory (+3)
      if (writeCount < 2) {
        onAddPoints(1);
      } else {
        onAddPoints(3);
      }

      const newCount = writeCount + 1;
      setWriteCount(newCount);
      setCurrentInput('');
      setWordError(null);
      if (newCount >= 3) {
        setStep('copy_sentence');
      }
    } else {
      setWordError("Incorrect spelling. Try again!");
      handlePlayAudio(currentWord.word);
    }
  };

  const handleCopySentenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const normalize = (s: string) => s.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").trim();
    
    const normalizedInput = normalize(currentInput);
    const normalizedTarget = normalize(currentWord.exampleSentence);

    if (normalizedInput === normalizedTarget) {
      onAddPoints(5); // Scoring: Copy sentence (+5)
      setCurrentInput('');
      setStep('make_sentence');
      setCopyError(null);
    } else {
        const clean = (s: string) => s.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ").trim();
        const targetWords = clean(currentWord.exampleSentence).split(/\s+/);
        const inputWords = clean(currentInput).split(/\s+/);
        
        let errorMsg = "The sentence is not quite right.";

        for (let i = 0; i < targetWords.length; i++) {
            if (!inputWords[i]) {
                errorMsg = `Missing word: It seems you stopped before "${targetWords[i]}".`;
                break;
            }
            if (inputWords[i] !== targetWords[i]) {
                errorMsg = `Typo detected: You wrote "${inputWords[i]}" but expected "${targetWords[i]}".`;
                break;
            }
        }
        
        if (errorMsg === "The sentence is not quite right." && inputWords.length > targetWords.length) {
             errorMsg = `Extra words detected: The sentence is longer than expected.`;
        }

        setCopyError(errorMsg);
    }
  };

  const handleMakeSentenceSubmit = async () => {
    if (!sentenceInput.trim()) return;
    setIsChecking(true);
    try {
      const result = await checkSentence(currentWord.word, sentenceInput);
      if (isMountedRef.current) {
        setFeedback(result);
        if (result.isCorrect && !hasAwardedSentencePoints) {
            onAddPoints(10); // Scoring: Make sentence (+10)
            setHasAwardedSentencePoints(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (isMountedRef.current) setIsChecking(false);
    }
  };

  const handleRetrySentence = () => {
      setSentenceInput('');
      setFeedback(null);
      setIsChecking(false);
      setChatHistory([]);
      setQuestionInput('');
      // Do not reset hasAwardedSentencePoints to prevent farming points for the same word
  };

  const handleAskSubmit = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!questionInput.trim() || isAsking || !feedback) return;

      const userQ = questionInput;
      setQuestionInput('');
      
      const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userQ }];
      setChatHistory(newHistory);
      setIsAsking(true);

      try {
          const answer = await askGrammarQuestion(currentWord.word, sentenceInput, feedback, chatHistory, userQ);
          if (isMountedRef.current) {
             setChatHistory(prev => [...prev, { role: 'ai', content: answer }]);
          }
      } catch (err) {
          console.error(err);
      } finally {
          if (isMountedRef.current) setIsAsking(false);
      }
  };

  const handleNextWord = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setStep('learn');
      resetStepState();
    } else {
      onComplete();
    }
  };
  
  const handleJumpTo = (index: number) => {
      setCurrentIndex(index);
      setStep('learn');
      resetStepState();
    };

  const resetStepState = () => {
     setWriteCount(0);
     setCurrentInput('');
     setSentenceInput('');
     setFeedback(null);
     setCopyError(null);
     setWordError(null);
     setIsPlaying(false);
     setChatHistory([]);
     setQuestionInput('');
     setHasAwardedSentencePoints(false);
     setHasAwardedPronunciationPoints(false);
     setPronunciationResult(null);
     setIsRecording(false);
  };

  const goBack = () => {
    if (step === 'write_word') {
        setStep('learn');
    } else if (step === 'copy_sentence') {
        setStep('write_word');
    } else if (step === 'make_sentence') {
        setStep('copy_sentence');
    } else if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setStep('make_sentence');
      resetStepState();
    }
  };

  const goNext = () => {
    if (step === 'learn') {
        setStep('write_word');
    } else if (step === 'write_word') {
        setStep('copy_sentence');
    } else if (step === 'copy_sentence') {
        setStep('make_sentence');
    } else {
       handleNextWord();
    }
  };

  // Syllable Interaction Handlers
  const toggleSplit = (index: number) => {
    const newSplits = new Set(userSplits);
    if (newSplits.has(index)) {
      newSplits.delete(index);
    } else {
      newSplits.add(index);
    }
    setUserSplits(newSplits);
  };

  const toggleStress = (index: number) => {
    const newStress = new Set(userStress);
    if (newStress.has(index)) {
      newStress.delete(index);
    } else {
      newStress.add(index);
    }
    setUserStress(newStress);
  };

  const showCorrectSyllables = () => {
    if (!currentWord.syllables) return;
    
    const syllableParts = currentWord.syllables.toLowerCase().split('-');
    let currentIndex = 0;
    const newSplits = new Set<number>();
    
    for (let i = 0; i < syllableParts.length - 1; i++) {
      currentIndex += syllableParts[i].length;
      newSplits.add(currentIndex - 1); 
    }
    setUserSplits(newSplits);
  };

  const progress = ((currentIndex + 1) / words.length) * 100;
  const isHiddenMode = step === 'write_word' && writeCount >= 2;

  // Recording Button Component (Used in other steps)
  const RecordButton = ({ targetText }: { targetText: string }) => (
    <div className="flex flex-col items-center">
        <button
            onClick={() => toggleRecording(targetText)}
            disabled={isAnalyzingAudio}
            className={`p-3 rounded-full transition-all transform hover:scale-110 shadow-md border-2 ${
                isRecording 
                    ? 'bg-green-600 text-white animate-pulse ring-4 ring-green-200 border-green-600' 
                    : isAnalyzingAudio
                        ? 'bg-gray-100 text-gray-400 cursor-wait border-gray-200'
                        : 'bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600'
            }`}
            title="Practice Pronunciation"
        >
            {isAnalyzingAudio ? (
                 <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : isRecording ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            )}
        </button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* Navigation Header (Not Sticky) */}
      <div className="bg-white border-b border-gray-100 mb-6 shadow-sm">
           <div className="max-w-4xl mx-auto px-4 pt-4 pb-2">
               <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-primary p-1.5 rounded-lg">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                             <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                         </svg>
                      </span>
                      <div>
                        <span className="text-xs font-bold text-gray-400 uppercase block">Review</span>
                        <span className="text-sm font-bold text-gray-800">{theme || "Vocabulary"}</span>
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <span className="text-sm font-bold text-primary">{currentIndex + 1} / {words.length}</span>
                     <button onClick={onComplete} className="text-gray-400 hover:text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                     </button>
                  </div>
               </div>
               
               {/* Progress Bar */}
               <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                   <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
               </div>

               {/* Horizontal Word List */}
               <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar scroll-smooth" ref={scrollRef}>
                   {words.map((w, i) => (
                       <button 
                         key={i}
                         onClick={() => handleJumpTo(i)} 
                         className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all
                            ${i === currentIndex 
                                ? 'bg-gray-900 text-white shadow-md' 
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}
                         `}
                       >
                          {i + 1}- {w.word}
                       </button>
                   ))}
               </div>
           </div>
      </div>

      <div className="px-4 flex items-start justify-center gap-4">
        {/* Left Arrow */}
        <button 
            onClick={goBack}
            disabled={currentIndex === 0 && step === 'learn'}
            className="mt-32 hidden md:flex p-4 rounded-full text-gray-400 hover:bg-white hover:text-primary hover:shadow-md transition-all disabled:opacity-0 disabled:cursor-not-allowed"
            aria-label="Previous Step"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
        </button>

        <div className="w-full max-w-4xl">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 min-h-[500px] relative">
            {/* Word Display */}
            <div className="flex justify-between items-start mb-8">
              <div className="w-full">
                
                {isHiddenMode ? (
                    <div className="mt-2 flex items-center space-x-3 justify-center py-8 animate-pulse">
                        <h2 className="text-5xl font-bold text-gray-300 tracking-widest">??????</h2>
                        <button 
                            onClick={() => handlePlayAudio(currentWord.word)}
                            className={`p-3 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-transform transform hover:scale-110`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          </button>
                    </div>
                ) : (
                    <div className="mt-4">
                        {/* Interactive Word Area */}
                        <div className="flex flex-col items-center">
                          
                          <div className="flex items-center select-none flex-wrap justify-center">
                            {currentWord.word.split('').map((char, idx, arr) => {
                              // Calculate which segment color to use
                              let segmentCount = 0;
                              for(let i=0; i<idx; i++) {
                                if (userSplits.has(i)) segmentCount++;
                              }
                              const segmentColor = segmentCount % 2 === 0 ? 'text-gray-800' : 'text-primary';
                              const isStressed = userStress.has(idx);

                              return (
                                <React.Fragment key={idx}>
                                  {/* The Character */}
                                  <span 
                                    onClick={() => toggleStress(idx)}
                                    className={`text-5xl md:text-6xl font-bold cursor-pointer transition-colors duration-300 hover:opacity-80
                                      ${isStressed ? 'text-[#F59E0B]' : segmentColor}
                                    `}
                                    title="Click to mark stress"
                                  >
                                    {char}
                                  </span>

                                  {/* The Splitter Gap */}
                                  {idx < arr.length - 1 && (
                                    <span 
                                      onClick={() => toggleSplit(idx)}
                                      className={`
                                        mx-1 cursor-pointer h-12 w-4 flex items-center justify-center text-2xl font-light transition-all
                                        ${userSplits.has(idx) ? 'text-gray-400' : 'text-transparent hover:text-gray-200'}
                                      `}
                                      title="Click to split syllable"
                                    >
                                      -
                                    </span>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>

                          {/* Controls for Interaction */}
                          {step === 'learn' && (
                            <div className="mt-4 flex gap-4 text-sm">
                                <button 
                                  onClick={showCorrectSyllables}
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                  </svg>
                                  Show Syllables
                                </button>
                                <button 
                                  onClick={() => { setUserSplits(new Set()); setUserStress(new Set()); }}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  Reset
                                </button>
                            </div>
                          )}

                        </div>

                        <div className="flex items-center justify-center mt-6 space-x-4">
                            {currentWord.partOfSpeech && (
                              <span className="text-xs font-bold text-white bg-gray-400 px-2 py-1 rounded uppercase">
                                {currentWord.partOfSpeech}
                              </span>
                            )}
                            <span className="text-gray-500 font-mono text-lg">/{currentWord.phonetic}/</span>
                            
                            {/* Audio Controls Row */}
                            <div className="flex items-center gap-2 ml-2">
                                <button 
                                    onClick={() => handlePlayAudio(currentWord.word)}
                                    className={`p-2 rounded-full bg-blue-50 text-primary hover:bg-blue-100 transition-colors ${isPlaying ? 'animate-pulse' : ''}`}
                                    title="Listen"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    </svg>
                                </button>
                                {/* Do NOT show record button for word on sentence copy step */}
                                {step !== 'learn' && step !== 'copy_sentence' && <RecordButton targetText={currentWord.word} />}
                            </div>
                        </div>
                    </div>
                )}
              </div>
              <div className="text-right absolute right-8 top-8 hidden md:block">
                <span className="inline-block px-3 py-1 rounded-full bg-green-50 text-secondary text-sm font-medium">
                    {step === 'learn' && 'Learn'}
                    {step === 'write_word' && 'Drill'}
                    {step === 'copy_sentence' && 'Copy'}
                    {step === 'make_sentence' && 'Create'}
                </span>
              </div>
            </div>
            
            {/* Page Number Indicator */}
            <div className="absolute bottom-4 right-6 text-gray-300 font-mono font-bold text-xl select-none">
               {currentIndex + 1} / {words.length}
            </div>

            {/* Definition Section */}
            <div className="mb-8 p-6 bg-gray-50 rounded-xl">
              <p className="text-xl text-gray-800 font-medium">{currentWord.definition}</p>
              <TranslationReveal text={currentWord.definitionTranslation || "Translation available in next update"} />
              <TranslationReveal text={`Word Meaning: ${currentWord.translation}`} className="mt-2 font-semibold text-gray-500" />
            </div>

            {/* Interaction Area */}
            <div className="space-y-6">
              
              {/* Step 1: Learn */}
              {step === 'learn' && (
                <div className="text-center space-y-6">
                  
                  {/* Recording Section */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <h3 className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-4">Speaking Practice</h3>
                      
                      <div className="flex justify-center">
                          <button
                            onClick={() => toggleRecording(currentWord.word)}
                            disabled={isAnalyzingAudio}
                            className={`
                                group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-lg text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0
                                ${isRecording 
                                    ? 'bg-green-600 ring-4 ring-green-100 animate-pulse' 
                                    : 'bg-emerald-500 hover:bg-emerald-600 ring-4 ring-emerald-100'
                                }
                                disabled:opacity-70 disabled:transform-none disabled:cursor-wait
                            `}
                          >
                             {/* Icon Logic */}
                             {isAnalyzingAudio ? (
                                 <span className="flex items-center gap-2">
                                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Analyzing...
                                 </span>
                             ) : isRecording ? (
                                 <span className="flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                    </span>
                                    Listening... (Auto-stop)
                                 </span>
                             ) : (
                                 <span className="flex items-center gap-2">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                     </svg>
                                     Tap to Record
                                 </span>
                             )}
                          </button>
                      </div>

                      {/* Result Display for Learn Step */}
                      {pronunciationResult && (
                           <div className={`mt-6 text-left p-5 rounded-xl border-l-4 ${pronunciationResult.score >= 80 ? 'bg-green-50 border-green-500' : 'bg-orange-50 border-orange-400'} animate-fade-in shadow-sm`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-bold text-gray-700">Pronunciation Score</span>
                                    <span className={`text-3xl font-black ${pronunciationResult.score >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                                        {pronunciationResult.score}
                                    </span>
                                </div>
                                <p className="text-gray-800 font-bold mb-1">{pronunciationResult.feedback}</p>
                                <TranslationReveal text={pronunciationResult.feedbackTranslation} />
                                <div className="text-sm text-gray-700 leading-relaxed bg-white/50 p-3 rounded-lg border border-gray-100 mt-2">
                                    {pronunciationResult.details}
                                    <TranslationReveal text={pronunciationResult.detailsTranslation} />
                                </div>
                           </div>
                      )}
                  </div>

                  <div className="h-px bg-gray-100 w-full my-6"></div>

                  <p className="text-sm text-gray-400">
                    Tip: Click between letters to split syllables. Click a letter to mark stress.
                  </p>
                  <button 
                    onClick={() => {
                      setStep('write_word');
                      resetStepState();
                    }}
                    className="w-full md:w-auto bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-transform hover:scale-105 shadow-md"
                  >
                    Start Copying & Spelling
                  </button>
                </div>
              )}

              {/* Step 2: Write Word 3 Times */}
              {step === 'write_word' && (
                <div>
                    <p className="mb-2 text-gray-600">
                      {writeCount < 2 ? (
                          <span>Copy the word <span className="font-bold">({writeCount + 1}/3)</span>:</span>
                      ) : (
                          <span>Listen and write from memory <span className="font-bold">({writeCount + 1}/3)</span>:</span>
                      )}
                    </p>
                    <form onSubmit={handleWordInputSubmit}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            placeholder={writeCount < 2 ? "Copy the word..." : "Type what you hear..."}
                            autoFocus
                            className={`w-full p-4 border-2 rounded-lg text-xl focus:outline-none ${wordError ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-primary'}`}
                            autoComplete="off"
                        />
                         {wordError && (
                            <div className="mt-2 text-red-600 text-sm font-medium flex items-center gap-1 animate-fade-in">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{wordError}</span>
                            </div>
                        )}
                        <div className="flex gap-2 mt-2 justify-center">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className={`h-2 w-8 rounded-full ${i < writeCount ? 'bg-green-500' : 'bg-gray-200'}`} />
                            ))}
                        </div>
                    </form>
                    {/* Local Pronunciation Feedback for Step 2 if user uses the word record button */}
                    {pronunciationResult && (
                        <div className={`mt-4 p-4 rounded-xl border ${pronunciationResult.score >= 80 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} animate-fade-in max-w-md mx-auto`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-gray-700">Pronunciation Score:</span>
                                <span className={`text-2xl font-black ${pronunciationResult.score >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                                    {pronunciationResult.score}
                                </span>
                            </div>
                            <p className="text-gray-800 font-medium mb-1">{pronunciationResult.feedback}</p>
                            <TranslationReveal text={pronunciationResult.feedbackTranslation} />
                        </div>
                    )}
                </div>
              )}

              {/* Step 3: Copy Sentence */}
              {step === 'copy_sentence' && (
                <div>
                    <div className="mb-4">
                        <p className="text-sm text-gray-500 uppercase font-bold mb-1">Example Sentence</p>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <p className="text-lg font-medium text-gray-800">{currentWord.exampleSentence}</p>
                            <div className="flex gap-1 shrink-0">
                                <button 
                                    onClick={() => handlePlayAudio(currentWord.exampleSentence)} 
                                    className={`p-2 rounded-full text-primary hover:bg-blue-50 transition-colors ${isPlaying ? 'bg-blue-50' : ''}`}
                                    title="Play Sentence Audio"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    </svg>
                                </button>
                                <RecordButton targetText={currentWord.exampleSentence} />
                            </div>
                        </div>
                        <TranslationReveal text={currentWord.exampleTranslation} />
                         
                         {/* Pronunciation Feedback (for sentence) */}
                         {pronunciationResult && (
                            <div className={`mt-4 p-4 rounded-xl border ${pronunciationResult.score >= 80 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} animate-fade-in`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-gray-700">Pronunciation Score:</span>
                                    <span className={`text-xl font-black ${pronunciationResult.score >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                                        {pronunciationResult.score}
                                    </span>
                                </div>
                                <p className="text-gray-800 text-sm">{pronunciationResult.feedback}</p>
                                <TranslationReveal text={pronunciationResult.feedbackTranslation} />
                            </div>
                        )}

                    </div>
                    <p className="mb-2 text-gray-600">Type the example sentence above:</p>
                    <form onSubmit={handleCopySentenceSubmit}>
                        <input
                            type="text"
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            placeholder="Type the sentence..."
                            autoFocus
                            className={`w-full p-4 border-2 rounded-lg focus:outline-none ${copyError ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-primary'}`}
                            autoComplete="off"
                        />
                        {copyError && (
                            <div className="mt-2 text-red-600 text-sm font-medium flex items-start gap-1 animate-fade-in">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{copyError}</span>
                            </div>
                        )}
                    </form>
                </div>
              )}

              {/* Step 4: Make Sentence */}
              {step === 'make_sentence' && (
                <div className="animate-fade-in">
                    <p className="mb-2 text-gray-600 font-medium">Create your own sentence using <span className="font-bold text-primary">"{currentWord.word}"</span>:</p>
                    <textarea
                        value={sentenceInput}
                        onChange={(e) => setSentenceInput(e.target.value)}
                        placeholder="e.g. I really need to..."
                        className="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-primary outline-none min-h-[100px]"
                        disabled={isChecking || feedback?.isCorrect}
                    />
                    
                    {!feedback && (
                        <button 
                            onClick={handleMakeSentenceSubmit}
                            disabled={!sentenceInput.trim() || isChecking}
                            className="mt-4 w-full bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                        >
                            {isChecking ? 'Checking...' : 'Check My Sentence'}
                        </button>
                    )}

                    {feedback && (
                        <div className={`mt-4 p-4 rounded-lg border ${feedback.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {feedback.isCorrect ? (
                                    <span className="text-green-600 font-bold flex items-center">
                                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Excellent!
                                    </span>
                                ) : (
                                    <span className="text-red-600 font-bold flex items-center">
                                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        Needs Improvement
                                    </span>
                                )}
                            </div>
                            
                            {/* Explanation with text formatting */}
                            <div className="text-gray-700 mb-2 whitespace-pre-wrap leading-relaxed text-sm">
                                {formatText(feedback.explanation)}
                            </div>
                            <TranslationReveal text={feedback.explanationTranslation} className="mb-4" />
                            
                            {feedback.correctedSentence && (
                                <div className="bg-white p-3 rounded border border-gray-200">
                                    <span className="text-xs text-gray-500 uppercase font-bold">Correction</span>
                                    <div className="flex justify-between items-center">
                                        <p className="text-gray-900 font-medium">{feedback.correctedSentence}</p>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handlePlayAudio(feedback.correctedSentence!)} 
                                                className="p-1.5 rounded-full text-primary hover:bg-blue-50"
                                            >
                                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                </svg>
                                            </button>
                                            <RecordButton targetText={feedback.correctedSentence!} />
                                        </div>
                                    </div>
                                    {/* Pronunciation Feedback for Corrected Sentence */}
                                     {pronunciationResult && (
                                        <div className={`mt-2 p-3 rounded-lg border ${pronunciationResult.score >= 80 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} animate-fade-in`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-gray-700">Pronunciation Score:</span>
                                                <span className={`text-lg font-black ${pronunciationResult.score >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                                                    {pronunciationResult.score}
                                                </span>
                                            </div>
                                            <p className="text-gray-800 text-xs">{pronunciationResult.feedback}</p>
                                            <TranslationReveal text={pronunciationResult.feedbackTranslation} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Q&A Section */}
                            <div className="mt-6 pt-6 border-t border-gray-200/60">
                                
                                {/* History Display */}
                                {chatHistory.length > 0 && (
                                    <div className="space-y-4 mb-4">
                                        {chatHistory.map((msg, idx) => {
                                            if (msg.role === 'user') {
                                                return (
                                                    <div key={idx} className="flex justify-end">
                                                         <div className="bg-primary/10 text-primary px-4 py-2 rounded-2xl rounded-tr-sm text-sm font-medium max-w-[85%]">
                                                            {msg.content}
                                                         </div>
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <div key={idx} className="flex justify-start">
                                                        <div className="bg-white text-gray-800 px-5 py-4 rounded-2xl rounded-tl-sm text-sm border border-gray-200 shadow-sm max-w-full w-full whitespace-pre-wrap leading-relaxed">
                                                            {formatText(msg.content)}
                                                        </div>
                                                    </div>
                                                )
                                            }
                                        })}
                                         {isAsking && (
                                            <div className="flex justify-start">
                                                <div className="bg-white px-5 py-4 rounded-2xl rounded-tl-sm border border-gray-200 w-full shadow-sm">
                                                    <div className="flex gap-1.5">
                                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></span>
                                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>
                                )}

                                {/* Input Area - Always visible if feedback is present */}
                                <form onSubmit={handleAskSubmit} className="relative">
                                    <input 
                                        type="text" 
                                        value={questionInput}
                                        onChange={(e) => setQuestionInput(e.target.value)}
                                        placeholder="Ask a question about this sentence..."
                                        className="w-full pl-5 pr-16 py-3 border-2 border-white bg-white rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all shadow-sm"
                                        disabled={isAsking}
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!questionInput.trim() || isAsking}
                                        className="absolute right-2 top-2 bottom-2 px-4 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary hover:text-white disabled:opacity-50 transition-all text-xs uppercase tracking-wide"
                                    >
                                        Send
                                    </button>
                                </form>
                            </div>
                            
                            {/* Action Buttons - Explicitly placed at the bottom */}
                            <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-gray-200/60">
                                <button 
                                    onClick={handleRetrySentence}
                                    className="flex-1 bg-white border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 transition-all"
                                >
                                    Write Another Sentence
                                </button>
                                <button 
                                    onClick={handleNextWord}
                                    className="flex-1 bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                >
                                    {currentIndex < words.length - 1 ? 'Next Word' : 'Finish Vocabulary'}
                                </button>
                            </div>

                        </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Arrow */}
        <button 
            onClick={goNext}
            className="mt-32 hidden md:flex p-4 rounded-full text-gray-400 hover:bg-white hover:text-primary hover:shadow-md transition-all"
            aria-label="Next Step"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </button>
      </div>
    </div>
  );
};
