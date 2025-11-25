
export enum AppStage {
  AUTH = 'AUTH',
  THEME_SELECTION = 'THEME_SELECTION',
  VOCAB_GENERATION = 'VOCAB_GENERATION',
  VOCAB_PREVIEW = 'VOCAB_PREVIEW',
  WORD_LEARNING = 'WORD_LEARNING',
  ARTICLE_GENERATION = 'ARTICLE_GENERATION',
  ARTICLE_STUDY = 'ARTICLE_STUDY',
  FREE_WRITING = 'FREE_WRITING',
  NOTEBOOK = 'NOTEBOOK',
  MISTAKE_NOTEBOOK = 'MISTAKE_NOTEBOOK',
}

export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'IELTS' | 'TOEFL' | 'SAT';

export interface User {
  username: string;
}

export interface MistakeItem {
  id: string;
  type: 'spelling' | 'grammar';
  date: string;
  word: string; // The target word
  userInput?: string; // What the user typed
  correction?: string; // Correct spelling or corrected sentence
  explanation?: string; // For grammar errors
  context?: string; // Definition or Chinese translation context
  translation?: string; // Word translation
}

export interface WordItem {
  word: string;
  cn: string;
}

export interface RootAssociation {
  root: string;
  meaning: string;
  relatedWords: {
    word: string;
    definition: string;
  }[];
}

export interface WordExtras {
  synonyms: WordItem[];
  antonyms: WordItem[];
  roots: RootAssociation[];
}

export interface WordData {
  word: string;
  phonetic: string;
  definition: string;
  definitionTranslation: string;
  translation: string;
  exampleSentence: string;
  exampleTranslation: string;
  syllables: string;
  partOfSpeech: string;
  extras?: WordExtras;
}

export interface ArticleData {
  title: string;
  content: string;
  translation: string;
}

export interface SentenceFeedback {
  isCorrect: boolean;
  correctedSentence?: string;
  explanation: string;
  explanationTranslation: string;
}

export interface WritingFeedback {
  score: number;
  critique: string;
  critiqueTranslation: string;
  improvedVersion: string;
  improvedVersionTranslation: string;
}

export interface PronunciationResult {
  score: number;
  feedback: string;
  feedbackTranslation: string;
  details: string;
  detailsTranslation: string;
}

export interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
}

export interface LearningSession {
  id: string;
  date: string;
  theme: string;
  words: WordData[];
  difficulty: string;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  translation?: string;
}
