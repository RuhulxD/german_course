export type CardStatus = 'known' | 'unknown' | 'review';

export type FilterMode = 'all' | 'unknown' | 'review' | 'unrated' | 'unknown+review';

export type QuizMode = 'normal' | 'reverse' | 'quiz';

export type StudyMode = 'page' | 'all' | 'custom';

export type Card = {
  word: string;
  pronunciation: string;
  banglaMeaning: string;
  englishMeaning: string;
  partizipII: string;
  sentence: string;
};

export type ProgressHistoryDay = {
  studied: number;
  known: number;
  unknown: number;
  review: number;
};

export type ProgressSnapshot = {
  cardStatuses: Record<string, CardStatus>;
  timestamp: string;
};
