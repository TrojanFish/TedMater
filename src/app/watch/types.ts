import type { VocabItem, SavedSentence } from "@/components/LearningNotebook";

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

export type { VocabItem, SavedSentence };
