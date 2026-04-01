import type { Card, CardStatus, FilterMode } from './types';

export function mapRowToCard(row: Record<string, string>): Card {
  return {
    word: row['German Word'] || '',
    pronunciation: row['Bangla Pronunciation'] || '',
    banglaMeaning: row['Bangla Meaning'] || '',
    englishMeaning: row['English Meaning'] || '',
    partizipII: row['Partizip II'] || '',
    sentence: row['German sentence'] || '',
  };
}

export function stripArticle(word: string): string {
  return word.replace(/^(der|die|das)\s+/i, '').trim();
}

export function applyFilter(
  cardList: Card[],
  cardStatuses: Record<string, CardStatus | undefined>,
  currentFilter: FilterMode,
): Card[] {
  if (currentFilter === 'all') return cardList;
  return cardList.filter((card) => {
    const status = cardStatuses[card.word];
    if (currentFilter === 'unknown') return status === 'unknown';
    if (currentFilter === 'review') return status === 'review';
    if (currentFilter === 'unrated') return !status;
    if (currentFilter === 'unknown+review') return status === 'unknown' || status === 'review';
    return true;
  });
}

/**
 * SRS-style duplicate weighting; returns new array of unique cards in weighted random order.
 */
export function buildWeightedDeck(
  availableCards: Card[],
  cardStatuses: Record<string, CardStatus | undefined>,
): Card[] {
  const weighted: Card[] = [];
  availableCards.forEach((card) => {
    const status = cardStatuses[card.word];
    if (status === 'unknown') {
      weighted.push(card, card, card);
    } else if (status === 'review') {
      weighted.push(card, card);
    } else if (status === 'known') {
      if (Math.random() < 0.5) weighted.push(card);
    } else {
      weighted.push(card);
    }
  });

  shuffleArray(weighted);
  const seen = new Set<string>();
  return weighted.filter((card) => {
    if (seen.has(card.word)) return false;
    seen.add(card.word);
    return true;
  });
}

export function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
