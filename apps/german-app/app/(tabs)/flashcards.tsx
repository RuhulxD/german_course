import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { allPages, books, parseCSV } from '@/lib/config';
import { contentUrl } from '@/lib/contentBase';
import {
  applyFilter,
  buildWeightedDeck,
  mapRowToCard,
  shuffleArray,
  stripArticle,
} from '@/lib/flashcards/engine';
import type { Card, CardStatus, FilterMode, QuizMode, ProgressHistoryDay, StudyMode } from '@/lib/flashcards/types';
import { Picker } from '@react-native-picker/picker';

const PROGRESS_KEY = 'flashcardProgress';
const HISTORY_KEY = 'flashcardHistory';

async function fetchPageCards(pagePath: string): Promise<Card[]> {
  const r = await fetch(contentUrl(`lws/csv/${pagePath}.csv`));
  if (!r.ok) return [];
  return parseCSV(await r.text())
    .map(mapRowToCard)
    .filter((c) => c.word.trim() !== '');
}

export default function FlashcardsScreen() {
  const colorScheme = useColorScheme();
  const border = colorScheme === 'dark' ? '#444' : '#ccc';
  const inputBg = colorScheme === 'dark' ? '#1c1c1c' : '#fff';

  const [studyMode, setStudyMode] = useState<StudyMode>('page');
  const [quizMode, setQuizMode] = useState<QuizMode>('normal');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [pagePath, setPagePath] = useState('');
  const [customWords, setCustomWords] = useState('');

  const [sessionCards, setSessionCards] = useState<Card[]>([]);
  const [available, setAvailable] = useState<Card[]>([]);
  const [shown, setShown] = useState<Card[]>([]);
  const [totalShown, setTotalShown] = useState(0);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardStatuses, setCardStatuses] = useState<Record<string, CardStatus>>({});
  const [progressHistory, setProgressHistory] = useState<Record<string, ProgressHistoryDay>>({});

  const [studyOpen, setStudyOpen] = useState(false);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [sessionStudied, setSessionStudied] = useState(0);
  const [tick, setTick] = useState(0);
  const [quizChoices, setQuizChoices] = useState<string[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await AsyncStorage.getItem(PROGRESS_KEY);
        if (p && !cancelled) {
          const parsed = JSON.parse(p) as { cardStatuses?: Record<string, CardStatus> };
          if (parsed.cardStatuses) setCardStatuses(parsed.cardStatuses);
        }
        const h = await AsyncStorage.getItem(HISTORY_KEY);
        if (h && !cancelled) setProgressHistory(JSON.parse(h));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionStart || !studyOpen) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [sessionStart, studyOpen]);

  const saveProgress = useCallback(async (statuses: Record<string, CardStatus>) => {
    await AsyncStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ cardStatuses: statuses, timestamp: new Date().toISOString() }),
    );
  }, []);

  const saveHistory = useCallback(async (h: Record<string, ProgressHistoryDay>) => {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  }, []);

  const weightedPool = useCallback(
    (list: Card[]) => buildWeightedDeck(applyFilter(list, cardStatuses, filterMode), cardStatuses),
    [cardStatuses, filterMode],
  );

  const pickerItems = useMemo(() => {
    const items: { label: string; value: string }[] = [{ label: 'Select Page…', value: '' }];
    books.forEach((book) => {
      book.pages.forEach((p) => {
        items.push({ label: `${book.name} — Page ${p}`, value: `${book.folder}/${p}` });
      });
    });
    return items;
  }, []);

  const pickNext = useCallback(
    (avail: Card[], shownSnapshot: Card[], quiz: QuizMode, deck: Card[]) => {
      if (!avail.length) {
        const recycled = weightedPool(shownSnapshot.length ? shownSnapshot : deck);
        if (!recycled.length) {
          setCurrentCard(null);
          return;
        }
        setShown([]);
        pickNext(recycled, [], quiz, deck);
        return;
      }
      const idx = Math.floor(Math.random() * avail.length);
      const card = avail[idx];
      const rest = [...avail.slice(0, idx), ...avail.slice(idx + 1)];
      let nextShown = [...shownSnapshot, card];
      if (nextShown.length > 6) nextShown = nextShown.slice(1);
      setAvailable(rest);
      setShown(nextShown);
      setTotalShown((n) => n + 1);
      setCurrentCard(card);
      setIsFlipped(false);
      if (quiz === 'quiz') {
        const wrong = deck.filter((c) => c.word !== card.word);
        shuffleArray(wrong);
        const choices = [card.word];
        for (let i = 0; i < Math.min(3, wrong.length); i++) choices.push(wrong[i].word);
        shuffleArray(choices);
        setQuizChoices(choices);
      } else {
        setQuizChoices([]);
      }
    },
    [weightedPool],
  );

  const startSessionWithDeck = useCallback(
    (deck: Card[]) => {
      if (!deck.length) {
        Alert.alert('Error', 'No cards found');
        return;
      }
      const pool = weightedPool(deck);
      if (!pool.length) {
        Alert.alert('Filter', `No cards match the "${filterMode}" filter. Try "All cards".`);
        return;
      }
      setSessionCards(deck);
      setShown([]);
      setTotalShown(0);
      setCurrentCard(null);
      setIsFlipped(false);
      setStudyOpen(true);
      setSessionStart(Date.now());
      setSessionStudied(0);
      setTick(0);
      queueMicrotask(() => pickNext(pool, [], quizMode, deck));
    },
    [filterMode, weightedPool, quizMode, pickNext],
  );

  const loadPage = async () => {
    if (!pagePath) {
      Alert.alert('Error', 'Please select a page');
      return;
    }
    try {
      const rows = await fetchPageCards(pagePath);
      if (!rows.length) {
        Alert.alert('Error', 'No data found');
        return;
      }
      startSessionWithDeck(rows);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Load failed');
    }
  };

  const loadAll = async () => {
    setLoadingAll(true);
    try {
      const acc: Card[] = [];
      for (const p of allPages) {
        const chunk = await fetchPageCards(p);
        acc.push(...chunk);
      }
      startSessionWithDeck(acc);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoadingAll(false);
    }
  };

  const loadCustom = async () => {
    const input = customWords.trim();
    if (!input) {
      Alert.alert('Error', 'Please enter some words');
      return;
    }
    const words = input.split('\n').map((w) => w.trim()).filter(Boolean);
    const acc: Card[] = [];
    for (const p of allPages) {
      const chunk = await fetchPageCards(p);
      acc.push(
        ...chunk.filter((card) => {
          const w = card.word.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
          return words.some((q) => w === q.toLowerCase() || card.word.toLowerCase().includes(q.toLowerCase()));
        }),
      );
    }
    if (!acc.length) {
      Alert.alert('Error', 'No matching words found');
      return;
    }
    shuffleArray(acc);
    startSessionWithDeck(acc);
  };

  const startStudy = () => {
    if (studyMode === 'page') void loadPage();
    else if (studyMode === 'all') void loadAll();
    else void loadCustom();
  };

  const goNext = () => {
    if (!sessionCards.length) return;
    pickNext(available, shown, quizMode, sessionCards);
  };

  const goPrev = () => {
    if (shown.length <= 1) return;
    const last = shown[shown.length - 1];
    const rest = shown.slice(0, -1);
    const prevCardObj = rest[rest.length - 1];
    const withReturned = [...available, last];
    setShown(rest);
    setAvailable(withReturned);
    setTotalShown((n) => Math.max(0, n - 1));
    setCurrentCard(prevCardObj);
    setIsFlipped(false);
    if (quizMode === 'quiz' && prevCardObj) {
      const wrong = sessionCards.filter((c) => c.word !== prevCardObj.word);
      shuffleArray(wrong);
      const choices = [prevCardObj.word];
      for (let i = 0; i < Math.min(3, wrong.length); i++) choices.push(wrong[i].word);
      shuffleArray(choices);
      setQuizChoices(choices);
    } else {
      setQuizChoices([]);
    }
  };

  const flip = () => {
    setIsFlipped((f) => !f);
    if (!isFlipped && currentCard) {
      const w = stripArticle(currentCard.word);
      Speech.stop();
      Speech.speak(w || currentCard.word, { language: 'de-DE', rate: 0.9 });
    }
  };

  const markCard = async (status: CardStatus) => {
    if (!currentCard) return;
    const word = currentCard.word;
    const previous = cardStatuses[word];
    setCardStatuses((prev) => {
      const next = { ...prev, [word]: status };
      void saveProgress(next);
      return next;
    });
    if (!previous) setSessionStudied((s) => s + 1);

    const today = new Date().toISOString().split('T')[0];
    setProgressHistory((hist) => {
      const copy = { ...hist };
      const day = copy[today] ?? { studied: 0, known: 0, unknown: 0, review: 0 };
      if (!previous) {
        day.studied++;
        day[status]++;
      } else if (previous !== status) {
        if (day[previous] > 0) day[previous]--;
        day[status]++;
      }
      copy[today] = day;
      void saveHistory(copy);
      return copy;
    });

    if (quizMode !== 'quiz') setTimeout(() => goNext(), 300);
  };

  const checkQuiz = (selectedWord: string) => {
    if (!currentCard) return;
    if (selectedWord !== currentCard.word) void markCard('unknown');
    else void markCard('known');
    setIsFlipped(true);
    setTimeout(() => goNext(), 1500);
  };

  const sessionText = useMemo(() => {
    if (!sessionStart) return '0:00';
    const e = Math.floor((Date.now() - sessionStart) / 1000);
    const m = Math.floor(e / 60);
    const s = e % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [sessionStart, tick]);

  const stats = useMemo(() => {
    let known = 0;
    let unknown = 0;
    let review = 0;
    sessionCards.forEach((c) => {
      const st = cardStatuses[c.word];
      if (st === 'known') known++;
      else if (st === 'unknown') unknown++;
      else if (st === 'review') review++;
    });
    const pct = sessionCards.length ? Math.round(((known + review) / sessionCards.length) * 100) : 0;
    return { known, unknown, review, total: sessionCards.length, pct };
  }, [sessionCards, cardStatuses]);

  const progressLabel =
    sessionCards.length > 0
      ? `Card ${totalShown} · ${available.length} left in pool`
      : '';

  const openLink = (u: string) => WebBrowser.openBrowserAsync(u);

  const playAudio = () => {
    if (!currentCard) return;
    const w = stripArticle(currentCard.word);
    Speech.stop();
    Speech.speak(w || currentCard.word, { language: 'de-DE', rate: 0.9 });
  };

  const frontText = useMemo(() => {
    if (!currentCard) return '';
    if (quizMode === 'quiz' || quizMode === 'reverse') {
      return `${currentCard.banglaMeaning} / ${currentCard.englishMeaning}`;
    }
    return stripArticle(currentCard.word) || currentCard.word;
  }, [currentCard, quizMode]);

  const hintText = useMemo(() => {
    if (!currentCard) return '';
    if (quizMode === 'quiz') return 'Choose the correct German word';
    if (quizMode === 'reverse') return 'Tap to see the German word';
    return 'Tap to flip';
  }, [currentCard, quizMode]);

  const badge = useMemo(() => {
    if (!currentCard) return { label: 'NEW', tone: '#888' };
    const st = cardStatuses[currentCard.word];
    if (st === 'known') return { label: 'KNOWN', tone: '#2e7d32' };
    if (st === 'unknown') return { label: 'UNKNOWN', tone: '#c62828' };
    if (st === 'review') return { label: 'REVIEW', tone: '#f9a825' };
    return { label: 'NEW', tone: '#888' };
  }, [currentCard, cardStatuses]);

  return (
    <>
      <ScrollView contentContainerStyle={styles.setup}>
        <Text style={styles.h1}>Flashcards</Text>

        <Text style={styles.label}>Study source</Text>
        <RNView style={[styles.pickerWrap, { borderColor: border }]}>
          <Picker selectedValue={studyMode} onValueChange={(v) => setStudyMode(v as StudyMode)}>
            <Picker.Item label="Single page" value="page" />
            <Picker.Item label="All pages (loads full deck)" value="all" />
            <Picker.Item label="Custom word list" value="custom" />
          </Picker>
        </RNView>

        {studyMode === 'page' ? (
          <RNView style={[styles.pickerWrap, { borderColor: border }]}>
            <Picker selectedValue={pagePath} onValueChange={setPagePath}>
              {pickerItems.map((it) => (
                <Picker.Item key={it.value || 'e'} label={it.label} value={it.value} />
              ))}
            </Picker>
          </RNView>
        ) : null}

        {studyMode === 'custom' ? (
          <TextInput
            placeholder="One word per line…"
            placeholderTextColor="#888"
            value={customWords}
            onChangeText={setCustomWords}
            multiline
            style={[
              styles.customInput,
              { borderColor: border, backgroundColor: inputBg, color: colorScheme === 'dark' ? '#fff' : '#000' },
            ]}
          />
        ) : null}

        <Text style={styles.label}>Card face mode</Text>
        <RNView style={[styles.pickerWrap, { borderColor: border }]}>
          <Picker selectedValue={quizMode} onValueChange={(v) => setQuizMode(v as QuizMode)}>
            <Picker.Item label="Normal (German → details)" value="normal" />
            <Picker.Item label="Reverse (meanings → German)" value="reverse" />
            <Picker.Item label="Quiz (multiple choice)" value="quiz" />
          </Picker>
        </RNView>

        <Text style={styles.label}>Filter</Text>
        <RNView style={[styles.pickerWrap, { borderColor: border }]}>
          <Picker selectedValue={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
            <Picker.Item label="All cards" value="all" />
            <Picker.Item label="Unknown" value="unknown" />
            <Picker.Item label="Review" value="review" />
            <Picker.Item label="Unrated" value="unrated" />
            <Picker.Item label="Unknown + Review" value="unknown+review" />
          </Picker>
        </RNView>

        <Pressable style={styles.primaryBtn} onPress={startStudy} disabled={loadingAll}>
          <Text style={styles.primaryBtnText}>{loadingAll ? 'Loading all pages…' : 'Start study session'}</Text>
        </Pressable>

        <Text style={styles.statsSummary}>
          Saved progress — marked in this app: review the counts while you study. (History:{' '}
          {Object.keys(progressHistory).length} days)
        </Text>
      </ScrollView>

      <Modal visible={studyOpen} animationType="slide">
        <View style={[styles.modalRoot, colorScheme === 'dark' ? styles.modalDark : styles.modalLight]}>
          <RNView style={styles.modalTop}>
            <Text style={styles.sessionMeta}>
              {sessionStudied} new marks · {sessionText}
            </Text>
            <Pressable
              onPress={() => {
                setStudyOpen(false);
                setCurrentCard(null);
              }}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>Exit</Text>
            </Pressable>
          </RNView>
          <Text style={styles.progressText}>{progressLabel}</Text>

          {currentCard ? (
            <>
              <RNView style={[styles.badge, { backgroundColor: badge.tone }]}>
                <Text style={styles.badgeText}>{badge.label}</Text>
              </RNView>

              {quizMode === 'quiz' ? (
                <RNView style={styles.quizArea}>
                  <Text style={styles.cardFront}>{frontText}</Text>
                  <Text style={styles.hint}>{hintText}</Text>
                  {quizChoices.map((ch) => (
                    <Pressable key={ch} style={styles.choiceBtn} onPress={() => checkQuiz(ch)}>
                      <Text style={styles.choiceText}>{stripArticle(ch)}</Text>
                    </Pressable>
                  ))}
                </RNView>
              ) : (
                <Pressable onPress={flip} style={styles.cardPress}>
                  {!isFlipped ? (
                    <RNView style={styles.cardFace}>
                      <Text style={styles.cardFront}>{frontText}</Text>
                      <Text style={styles.hint}>{hintText}</Text>
                    </RNView>
                  ) : (
                    <RNView style={styles.cardBack}>
                      <Text style={styles.backLine}>{currentCard.word}</Text>
                      <Text style={styles.backLine}>{currentCard.pronunciation}</Text>
                      <Text style={styles.backLine}>{currentCard.banglaMeaning}</Text>
                      <Text style={styles.backLine}>{currentCard.englishMeaning}</Text>
                      {currentCard.partizipII ? <Text style={styles.backLine}>{currentCard.partizipII}</Text> : null}
                      <Text style={styles.backLine}>{currentCard.sentence}</Text>
                    </RNView>
                  )}
                </Pressable>
              )}

              <RNView style={styles.quickRow}>
                <Pressable onPress={playAudio}>
                  <Text style={styles.link}>Audio</Text>
                </Pressable>
                <Pressable
                  onPress={() => openLink(`https://www.dict.cc/?s=${encodeURIComponent(stripArticle(currentCard.word))}`)}
                >
                  <Text style={styles.link}>Dict.cc</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    openLink(`https://en.wiktionary.org/wiki/${encodeURIComponent(stripArticle(currentCard.word))}#German`)
                  }
                >
                  <Text style={styles.link}>Wiktionary</Text>
                </Pressable>
              </RNView>

              {quizMode !== 'quiz' ? (
                <RNView style={styles.markRow}>
                  <Pressable style={[styles.markBtn, styles.known]} onPress={() => markCard('known')}>
                    <Text style={styles.markText}>Known</Text>
                  </Pressable>
                  <Pressable style={[styles.markBtn, styles.unknown]} onPress={() => markCard('unknown')}>
                    <Text style={styles.markText}>Unknown</Text>
                  </Pressable>
                  <Pressable style={[styles.markBtn, styles.review]} onPress={() => markCard('review')}>
                    <Text style={styles.markText}>Review</Text>
                  </Pressable>
                </RNView>
              ) : null}

              <RNView style={styles.navRow}>
                <Pressable style={styles.navBtn} onPress={goPrev}>
                  <Text>Previous</Text>
                </Pressable>
                <Pressable style={styles.navBtn} onPress={goNext}>
                  <Text>Next</Text>
                </Pressable>
              </RNView>
            </>
          ) : (
            <Text style={styles.muted}>Preparing cards…</Text>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  setup: { padding: 16, paddingBottom: 48 },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  label: { fontWeight: '600', marginTop: 8, marginBottom: 4 },
  pickerWrap: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  customInput: { minHeight: 100, borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8, textAlignVertical: 'top' },
  primaryBtn: { marginTop: 20, backgroundColor: '#2f95dc', padding: 14, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  statsSummary: { marginTop: 16, fontSize: 13, opacity: 0.85 },
  modalRoot: { flex: 1, padding: 16, paddingTop: 48 },
  modalLight: { backgroundColor: '#fff' },
  modalDark: { backgroundColor: '#121212' },
  modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionMeta: { fontSize: 13, opacity: 0.85 },
  closeBtn: { padding: 8 },
  closeBtnText: { color: '#2f95dc', fontWeight: '700' },
  progressText: { marginVertical: 8, fontSize: 12, opacity: 0.8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  cardPress: { minHeight: 200, borderWidth: 1, borderColor: '#ccc', borderRadius: 12, padding: 16, justifyContent: 'center' },
  cardFace: { alignItems: 'center' },
  cardBack: { gap: 6 },
  cardFront: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  hint: { marginTop: 8, opacity: 0.75, textAlign: 'center' },
  backLine: { fontSize: 16 },
  quizArea: { gap: 8 },
  choiceBtn: { borderWidth: 1, borderColor: '#2f95dc', borderRadius: 8, padding: 12 },
  choiceText: { fontSize: 16, textAlign: 'center' },
  quickRow: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  link: { color: '#2f95dc', fontWeight: '600' },
  markRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  markBtn: { flex: 1, minWidth: 90, padding: 10, borderRadius: 8, alignItems: 'center' },
  known: { backgroundColor: '#2e7d32' },
  unknown: { backgroundColor: '#c62828' },
  review: { backgroundColor: '#f9a825' },
  markText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  navRow: { flexDirection: 'row', gap: 16, marginTop: 20, justifyContent: 'center' },
  navBtn: { padding: 12 },
  muted: { opacity: 0.7, marginTop: 24, textAlign: 'center' },
});
