
import React, { useState, useEffect, useRef } from 'react';
import { ArticleData, PronunciationResult } from '../types';
import { generateSpeech, evaluatePronunciation } from '../services/geminiService';
import { decodeBase64, decodeAudioData, playAudioBuffer, getAudioContext, stopGlobalAudio, blobToBase64 } from '../services/audioUtils';
import { TranslationReveal } from './TranslationReveal';

interface ArticleViewProps {
  article: ArticleData;
  onComplete: () => void;
  highlightWords?: string[];
  onAddPoints: (points: number) => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({ article, onComplete, highlightWords = [], onAddPoints }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [pronunciationResult, setPronunciationResult] = useState<PronunciationResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isMountedRef = useRef(true);

  // Audio control refs
  const currentAudioIdRef = useRef<number>(0);

  // Cleanup audio on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopGlobalAudio();
      stopRecording();
    };
  }, []);

  const handlePlayAudio = async () => {
    // If playing, toggle off (stop)
    if (isPlaying) {
        stopGlobalAudio();
        setIsPlaying(false);
        return;
    }

    const audioId = ++currentAudioIdRef.current;
    setIsPlaying(true);
    stopGlobalAudio();
    
    try {
      const base64Audio = await generateSpeech(`${article.title}. ${article.content}`);
      
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

  const toggleRecording = async () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
  };

  const startRecording = async () => {
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
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
         mediaRecorderRef.current.onstop = async () => {
             const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
             
             // Stop all tracks
             mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
             
             handleAnalyzeAudio(audioBlob);
         };
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const handleAnalyzeAudio = async (blob: Blob) => {
      setIsAnalyzingAudio(true);
      try {
          const base64 = await blobToBase64(blob);
          const result = await evaluatePronunciation(base64, article.content);
          if (isMountedRef.current) {
              setPronunciationResult(result);
              if (result.score >= 60) {
                  onAddPoints(15); // Bonus points for reading article
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

  const handleProceed = () => {
      // Scoring: Copy article (+20)
      onAddPoints(20);
      onComplete();
  };

  const renderContent = (text: string) => {
    if (!highlightWords.length) return text;

    const uniqueWords = Array.from(new Set(highlightWords.map(w => w.toLowerCase())));
    const safeWords = uniqueWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${safeWords.join('|')})\\b`, 'gi');

    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (uniqueWords.includes(part.toLowerCase())) {
        return (
          <span 
            key={i} 
            className="text-blue-600 underline font-bold decoration-blue-300 decoration-2 underline-offset-2"
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-gray-900">{article.title}</h2>
          <div className="flex gap-2">
              <button 
                onClick={handlePlayAudio}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${isPlaying ? 'border-primary bg-blue-50 text-primary' : 'border-gray-300 text-gray-600 hover:border-primary hover:text-primary'}`}
                >
                {isPlaying ? (
                    <>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                    Stop Audio
                    </>
                ) : (
                    <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Listen to Story
                    </>
                )}
              </button>
              
              <button
                onClick={toggleRecording}
                disabled={isAnalyzingAudio}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
                    isRecording 
                    ? 'bg-green-600 text-white border-green-600 animate-pulse' 
                    : isAnalyzingAudio
                        ? 'bg-gray-100 text-gray-400 cursor-wait border-gray-200'
                        : 'border-gray-300 text-gray-600 hover:border-green-500 hover:text-green-600'
                }`}
              >
                 {isAnalyzingAudio ? (
                     <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Analyzing...
                     </>
                 ) : isRecording ? (
                     <>
                        <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                        Stop Recording
                     </>
                 ) : (
                     <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Read Aloud
                     </>
                 )}
              </button>
          </div>
        </div>

        {/* Pronunciation Feedback Result */}
        {pronunciationResult && (
            <div className={`p-5 rounded-xl border-l-4 ${pronunciationResult.score >= 80 ? 'bg-green-50 border-green-500' : 'bg-orange-50 border-orange-400'} animate-fade-in shadow-sm mb-4`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-700">Pronunciation Score</span>
                    <span className={`text-2xl font-black ${pronunciationResult.score >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                        {pronunciationResult.score}
                    </span>
                </div>
                <p className="text-gray-800 font-bold mb-1">{pronunciationResult.feedback}</p>
                <TranslationReveal text={pronunciationResult.feedbackTranslation} />
                {pronunciationResult.details && (
                    <div className="text-sm text-gray-700 leading-relaxed bg-white/50 p-3 rounded-lg border border-gray-100 mt-2">
                        {pronunciationResult.details}
                        <TranslationReveal text={pronunciationResult.detailsTranslation} />
                    </div>
                )}
            </div>
        )}

        <div className="space-y-6 animate-fade-in">
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                <div>
                    <h3 className="font-bold text-blue-800">Copying Exercise</h3>
                    <p className="text-blue-700 text-sm mt-1">
                        Read, listen, and then type the article exactly as shown below to practice sentence structure and vocabulary flow.
                    </p>
                </div>
             </div>

             <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 text-base text-gray-800 leading-relaxed select-none font-medium font-serif shadow-inner whitespace-pre-line">
                 {renderContent(article.content)}
             </div>

             <div>
                {showTranslation ? (
                    <div className="animate-fade-in">
                        <button 
                            onClick={() => setShowTranslation(false)}
                            className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            Hide Translation
                        </button>
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-gray-600">{article.translation}</p>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => setShowTranslation(true)}
                        className="text-xs font-bold text-gray-400 hover:text-primary transition-colors flex items-center gap-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Translate Article
                    </button>
                )}
             </div>

             <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Your Input</label>
                <textarea
                    value={userTranscript}
                    onChange={(e) => setUserTranscript(e.target.value)}
                    className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:border-primary outline-none font-mono text-base leading-relaxed transition-colors"
                    placeholder="Start typing the article here..."
                    autoFocus
                    spellCheck={false}
                    onPaste={(e) => {
                        e.preventDefault();
                        alert("Please type it out manually for better learning!");
                    }}
                />
             </div>
          </div>
      </div>

      <div className="flex justify-end items-center">
        <button 
          onClick={handleProceed}
          className="bg-primary text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center gap-2"
        >
            Proceed to Essay Writing &rarr;
        </button>
      </div>
    </div>
  );
};
