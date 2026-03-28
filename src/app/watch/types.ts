export interface VocabItem {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definitionZh: string;
  tense?: string;
  synonyms?: string[];
  antonyms?: string[];
  phrases?: string[];
  exampleEn: string;
  exampleZh: string;
  addedAt: number;
  talkSlug?: string;   // which TED talk this word came from (used for PDF scoping)
}

export interface SavedSentence {
  id: string | number;
  english: string;
  translated: string;
  analysis?: any;
  addedAt: number;
  talkSlug?: string;   // which TED talk this sentence came from (used for PDF scoping)
}

export interface TranscriptItem {
  id: number;
  startTime: number;
  english: string;
  translated: string;
}

export interface AnalysisResult {
  structureZh: string;
  breakdown: { label: string; content: string; explanation: string }[];
  insights: { title: string; content: string }[];
}

export interface ParsedData {
  title: string;
  presenter: string;
  videoUrl: string;
  downloadUrl: string;
  isHls: boolean;
  transcript: TranscriptItem[];
  needsTranscription?: boolean;
  isTranslationMissing?: boolean;
  transcribeUrl?: string | null;
  transcribeSources?: string[];
  youtubeTranscriptUrl?: string | null;
  hlsUrl?: string | null;
  slug?: string | null;
}

export interface HistoryItem {
  id: string;
  videoUrl: string;
  title: string;
  presenter: string;
  progressTime: number;
  duration?: number;
}

export interface PrintConfig {
  vocab: boolean;
  script: boolean;
  analysis: boolean;
  notes: boolean;
}

