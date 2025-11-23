export enum AppStage {
  THEME_SELECTION = 'THEME_SELECTION',
  VOCAB_GENERATION = 'VOCAB_GENERATION',
  VOCAB_PREVIEW = 'VOCAB_PREVIEW',
  WORD_LEARNING = 'WORD_LEARNING',
  ARTICLE_GENERATION = 'ARTICLE_GENERATION',
  ARTICLE_STUDY = 'ARTICLE_STUDY',
  FREE_WRITING = 'FREE_WRITING',
  NOTEBOOK = 'NOTEBOOK',
}

export type DifficultyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'IELTS' | 'TOEFL' | 'SAT';

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
}