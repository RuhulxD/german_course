import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    TextInput,
    useWindowDimensions,
    View as RNView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { allPages, books, parseCSV } from '@/lib/config';
import { contentUrl } from '@/lib/contentBase';
import { pickerChrome } from '@/lib/pickerChrome';
import {
    applyFilter,
    buildWeightedDeck,
    mapRowToCard,
    shuffleArray,
    stripArticle,
} from '@/lib/flashcards/engine';
import type { Card, CardStatus, FilterMode, QuizMode, ProgressHistoryDay, StudyMode } from '@/lib/flashcards/types';
import { uiAlert } from '@/lib/uiAlert';
import { Picker } from '@react-native-picker/picker';

type SwipeHint = 'left' | 'right' | 'up' | 'down' | null;

type FlashHandlers = {
    studyOpen: boolean;
    currentCard: Card | null;
    quizMode: QuizMode;
    flip: () => void;
    goNext: () => void;
    goPrev: () => void;
    markCard: (s: CardStatus) => void;
    playAudio: () => void;
    exitSession: () => void;
};

const PROGRESS_KEY = 'flashcardProgress';
const HISTORY_KEY = 'flashcardHistory';
const SLIDE_PX = 118;

const motivationalMessages = [
    "🌟 Amazing!",
    "📚 Keep going!",
    "🎯 You're on fire!",
    "💪 Great job!",
    "🧠 Brain power!",
    "⭐ Perfect!",
    "🚀 Accelerating!",
    "🏆 Milestone!",
];

async function fetchPageCards(pagePath: string): Promise<Card[]> {
    const r = await fetch(contentUrl(`lws/csv/${pagePath}.csv`));
    if (!r.ok) return [];
    return parseCSV(await r.text())
        .map(mapRowToCard)
        .filter((c) => c.word.trim() !== '');
}

export default function FlashcardsScreen() {
    const colorScheme = useColorScheme();
    const c = Colors[colorScheme];
    const pc = pickerChrome(colorScheme);
    const { height: winH } = useWindowDimensions();
    const cardStageHeight = Math.min(Math.max(winH * 0.44, 280), 500);
    const webStudyMaxW = 520;
    const webSetupMaxW = 560;

    const [studyMode, setStudyMode] = useState<StudyMode>('page');
    const [quizMode, setQuizMode] = useState<QuizMode>('normal');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [pagePath, setPagePath] = useState('book-1/1');
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
    const [loadingPage, setLoadingPage] = useState(false);
    const [statsExpanded, setStatsExpanded] = useState(false);
    const [swipeHint, setSwipeHint] = useState<SwipeHint>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [currentMessage, setCurrentMessage] = useState('');
    const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
    const [cardScale] = useState(new Animated.Value(0.95));
    const [cardOpacity] = useState(new Animated.Value(0));

    const flipProgress = useRef(new Animated.Value(0)).current;
    const slideX = useRef(new Animated.Value(0)).current;
    const slideOpacity = useRef(new Animated.Value(1)).current;
    const flipAnimating = useRef(false);

    const flipperRotateY = useMemo(
        () =>
            flipProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '180deg'],
            }),
        [flipProgress],
    );

    const flashHandlersRef = useRef<FlashHandlers>({
        studyOpen: false,
        currentCard: null,
        quizMode: 'normal',
        flip: () => {},
        goNext: () => {},
        goPrev: () => {},
        markCard: () => {},
        playAudio: () => {},
        exitSession: () => {},
    });

    // Animate card entrance
    useEffect(() => {
        if (currentCard) {
            Animated.parallel([
                Animated.spring(cardScale, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(cardOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            cardScale.setValue(0.95);
            cardOpacity.setValue(0);
        }
    }, [currentCard]);

    // Show motivational messages
    useEffect(() => {
        if (sessionStudied > 0 && sessionStudied % 5 === 0) {
            const randomMsg = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
            setCurrentMessage(randomMsg);
            setTimeout(() => setCurrentMessage(''), 2000);
        }
    }, [sessionStudied]);

    // Confetti for milestones
    useEffect(() => {
        if (consecutiveCorrect >= 10) {
            setShowConfetti(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => setShowConfetti(false), 3000);
            setConsecutiveCorrect(0);
        }
    }, [consecutiveCorrect]);

    const cardPanResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () =>
                    Boolean(
                        flashHandlersRef.current.studyOpen &&
                        flashHandlersRef.current.currentCard &&
                        flashHandlersRef.current.quizMode !== 'quiz',
                    ),
                onMoveShouldSetPanResponder: () => false,
                onPanResponderMove: (_, g) => {
                    const { dx, dy } = g;
                    const edge = 30;
                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > edge) {
                        setSwipeHint(dx > 0 ? 'right' : 'left');
                    } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > edge) {
                        setSwipeHint(dy > 0 ? 'down' : 'up');
                    } else {
                        setSwipeHint(null);
                    }
                },
                onPanResponderRelease: (_, g) => {
                    setSwipeHint(null);
                    const h = flashHandlersRef.current;
                    if (!h.studyOpen || !h.currentCard || h.quizMode === 'quiz') return;
                    const { dx, dy } = g;
                    const ax = Math.abs(dx);
                    const ay = Math.abs(dy);
                    const tapSlop = 14;
                    if (ax < tapSlop && ay < tapSlop) {
                        h.flip();
                        return;
                    }
                    const threshold = 60;
                    if (ax > ay && ax > threshold) {
                        if (dx > 0) h.markCard('known');
                        else h.markCard('unknown');
                    } else if (ay > ax && ay > threshold) {
                        if (dy > 0) h.goNext();
                        else h.markCard('review');
                    }
                },
                onPanResponderTerminate: () => setSwipeHint(null),
            }),
        [],
    );

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

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;
        if (!studyOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            const t = e.target;
            if (t instanceof HTMLElement) {
                const tag = t.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
            }
            const h = flashHandlersRef.current;
            if (!h.currentCard) return;

            if (e.code === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                h.goPrev();
            } else if (e.code === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                h.goNext();
            } else if (e.code === 'Space') {
                if (h.quizMode !== 'quiz') {
                    e.preventDefault();
                    h.flip();
                }
            } else if (e.key === '1') {
                h.markCard('known');
            } else if (e.key === '2') {
                h.markCard('unknown');
            } else if (e.key === '3') {
                h.markCard('review');
            } else if (e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                h.playAudio();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                h.exitSession();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [studyOpen]);

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
        const items: { label: string; value: string }[] = [];
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

    const runSlideExit = useCallback(
        (dir: 'left' | 'right', after: () => void) => {
            const dx = dir === 'left' ? -SLIDE_PX : SLIDE_PX;
            Animated.parallel([
                Animated.timing(slideX, {
                    toValue: dx,
                    duration: 320,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(slideOpacity, {
                    toValue: 0.12,
                    duration: 280,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start(({ finished }) => {
                if (!finished) return;
                after();
                slideX.setValue(0);
                slideOpacity.setValue(1);
            });
        },
        [slideX, slideOpacity],
    );

    useEffect(() => {
        flipProgress.stopAnimation();
        flipProgress.setValue(0);
        flipAnimating.current = false;
        setIsFlipped(false);
    }, [currentCard?.word, flipProgress]);

    const startSessionWithDeck = useCallback(
        (deck: Card[]) => {
            if (!deck.length) {
                uiAlert('Error', 'No cards found');
                return;
            }
            const pool = weightedPool(deck);
            if (!pool.length) {
                uiAlert('Filter', `No cards match the "${filterMode}" filter. Try "All cards".`);
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
            uiAlert('Error', 'Please select a page');
            return;
        }
        setLoadingPage(true);
        try {
            const rows = await fetchPageCards(pagePath);
            if (!rows.length) {
                uiAlert(
                    'Could not load vocabulary',
                    `No data at ${contentUrl(`lws/csv/${pagePath}.csv`)}. For local web dev, create apps/german-app/public/lws → ../../../lws (symlink to repo lws) so the dev server can serve CSV files.`,
                );
                return;
            }
            startSessionWithDeck(rows);
        } catch (e) {
            uiAlert('Error', e instanceof Error ? e.message : 'Load failed');
        } finally {
            setLoadingPage(false);
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
            uiAlert('Error', e instanceof Error ? e.message : 'Load failed');
        } finally {
            setLoadingAll(false);
        }
    };

    const loadCustom = async () => {
        const input = customWords.trim();
        if (!input) {
            uiAlert('Error', 'Please enter some words');
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
            uiAlert('Error', 'No matching words found');
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

    const applyGoPrev = useCallback(() => {
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
        flipProgress.setValue(0);
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
    }, [shown, available, quizMode, sessionCards, flipProgress]);

    const goNext = useCallback(() => {
        if (!sessionCards.length) return;
        runSlideExit('left', () => pickNext(available, shown, quizMode, sessionCards));
    }, [sessionCards, available, shown, quizMode, pickNext, runSlideExit]);

    const goPrev = useCallback(() => {
        if (shown.length <= 1) return;
        runSlideExit('right', applyGoPrev);
    }, [shown.length, applyGoPrev, runSlideExit]);

    const flip = useCallback(() => {
        if (quizMode === 'quiz' || flipAnimating.current) return;
        flipAnimating.current = true;
        const toBack = !isFlipped;
        Animated.timing(flipProgress, {
            toValue: toBack ? 1 : 0,
            duration: 600,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
        }).start(({ finished }) => {
            flipAnimating.current = false;
            if (!finished) return;
            setIsFlipped(toBack);
            if (toBack && currentCard) {
                const w = stripArticle(currentCard.word);
                Speech.stop();
                Speech.speak(w || currentCard.word, { language: 'de-DE', rate: 0.9 });
            }
        });
    }, [isFlipped, currentCard, flipProgress, quizMode]);

    const markCard = async (status: CardStatus) => {
        if (!currentCard) return;

        // Haptic feedback
        if (status === 'known') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setConsecutiveCorrect(prev => prev + 1);
        } else if (status === 'unknown') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setConsecutiveCorrect(0);
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setConsecutiveCorrect(0);
        }

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
        if (selectedWord !== currentCard.word) {
            void markCard('unknown');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
            void markCard('known');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
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

    const deckRated = useMemo(() => {
        let n = 0;
        sessionCards.forEach((c) => {
            if (cardStatuses[c.word]) n++;
        });
        return n;
    }, [sessionCards, cardStatuses]);

    const ratedBarPct = stats.total ? Math.round((deckRated / stats.total) * 100) : 0;

    const historyBars = useMemo(() => {
        const days = 30;
        const today = new Date();
        const bars: { date: string; studied: number }[] = [];
        let max = 0;
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const studied = progressHistory[key]?.studied ?? 0;
            if (studied > max) max = studied;
            bars.push({ date: key, studied });
        }
        return { bars, max, startLabel: bars[0]?.date ?? '' };
    }, [progressHistory]);

    const progressLabel =
        sessionCards.length > 0
            ? `Card ${totalShown} of ${sessionCards.length} (${available.length} remaining) · Rated ${deckRated}/${sessionCards.length}`
            : '';

    const currentMark = currentCard ? cardStatuses[currentCard.word] : undefined;

    const exportProgressData = useCallback(async () => {
        const payload = JSON.stringify(
            {
                cardStatuses,
                progressHistory,
                exportedAt: new Date().toISOString(),
                statistics: {
                    known: Object.values(cardStatuses).filter((s) => s === 'known').length,
                    unknown: Object.values(cardStatuses).filter((s) => s === 'unknown').length,
                    review: Object.values(cardStatuses).filter((s) => s === 'review').length,
                },
            },
            null,
            2,
        );
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(payload);
                uiAlert('Exported', 'Progress JSON was copied to the clipboard.');
            } catch {
                uiAlert('Export failed', 'Could not copy to the clipboard.');
            }
            return;
        }
        try {
            await Share.share({ message: payload, title: 'Flashcard progress' });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!msg.includes('User did not share')) uiAlert('Export', 'Could not open the share sheet.');
        }
    }, [cardStatuses, progressHistory]);

    const clearAllProgress = useCallback(() => {
        const go = async () => {
            setCardStatuses({});
            setProgressHistory({});
            await Promise.all([
                AsyncStorage.removeItem(PROGRESS_KEY),
                AsyncStorage.removeItem(HISTORY_KEY),
            ]);
            uiAlert('Cleared', 'All flashcard progress was removed.');
        };
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            if (window.confirm('Clear all progress? This cannot be undone.')) void go();
            return;
        }
        Alert.alert('Clear all progress?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => void go() },
        ]);
    }, []);

    const openLink = (u: string) => WebBrowser.openBrowserAsync(u);

    const playAudio = () => {
        if (!currentCard) return;
        const w = stripArticle(currentCard.word);
        Speech.stop();
        Speech.speak(w || currentCard.word, { language: 'de-DE', rate: 0.9 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        if (quizMode === 'reverse') return 'Tap or swipe to see the German word';
        return 'Tap or swipe to flip';
    }, [currentCard, quizMode]);

    const badge = useMemo(() => {
        if (!currentCard) return { label: 'NEW', tone: c.statusChipNeutral };
        const st = cardStatuses[currentCard.word];
        if (st === 'known') return { label: 'KNOWN', tone: c.statusChipKnown };
        if (st === 'unknown') return { label: 'UNKNOWN', tone: c.statusChipUnknown };
        if (st === 'review') return { label: 'REVIEW', tone: c.statusChipReview };
        return { label: 'NEW', tone: c.statusChipNeutral };
    }, [currentCard, cardStatuses, c]);

    const cardFrontBg = c.flashcardFrontBg;
    const cardFrontFg = c.flashcardFrontFg;
    const cardBackBg = c.flashcardBackBg;
    const cardBackFg = c.flashcardBackFg;

    flashHandlersRef.current = {
        studyOpen,
        currentCard,
        quizMode,
        flip,
        goNext,
        goPrev,
        markCard: (s) => {
            void markCard(s);
        },
        playAudio,
        exitSession: () => {
            setStudyOpen(false);
            setCurrentCard(null);
        },
    };

    return (
        <>
            <ScrollView
                style={[styles.scroll, { backgroundColor: c.background }]}
                contentContainerStyle={[
                    styles.setup,
                    Platform.OS === 'web' && styles.setupContentWeb,
                ]}
            >
                <RNView style={[styles.webSetupInner, Platform.OS === 'web' && { maxWidth: webSetupMaxW }]}>
                    <LinearGradient
                        colors={[...c.heroGradient]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.headerGradient}
                    >
                        <Text style={[styles.h1, { color: c.heroOnGradient }]}>Flashcards</Text>
                        <Text style={[styles.subtitle, { color: c.heroMutedOnGradient }]}>
                            Master German vocabulary
                        </Text>
                    </LinearGradient>

                    <RNView style={styles.setupCard}>
                    <Text style={[styles.label, { color: c.textSecondary }]}>Study source</Text>
                    <RNView style={[styles.pickerWrap, { borderColor: c.border, backgroundColor: c.backgroundElevated }]}>
                        <Picker
                            selectedValue={studyMode}
                            onValueChange={(v) => setStudyMode(v as StudyMode)}
                            style={pc.style}
                            itemStyle={pc.itemStyle}
                            dropdownIconColor={pc.dropdownIconColor}
                        >
                            <Picker.Item label="📖 Single page" value="page" color={pc.itemColor} />
                            <Picker.Item label="📚 All pages" value="all" color={pc.itemColor} />
                            <Picker.Item label="✏️ Custom word list" value="custom" color={pc.itemColor} />
                        </Picker>
                    </RNView>

                    {studyMode === 'page' ? (
                        <RNView style={[styles.pickerWrap, { borderColor: c.border, backgroundColor: c.backgroundElevated }]}>
                            <Picker
                                selectedValue={pagePath}
                                onValueChange={setPagePath}
                                style={pc.style}
                                itemStyle={pc.itemStyle}
                                dropdownIconColor={pc.dropdownIconColor}
                            >
                                {pickerItems.map((it) => (
                                    <Picker.Item key={it.value || 'e'} label={it.label} value={it.value} color={pc.itemColor} />
                                ))}
                            </Picker>
                        </RNView>
                    ) : null}

                    {studyMode === 'custom' ? (
                        <TextInput
                            placeholder="One word per line…"
                            placeholderTextColor={c.muted}
                            value={customWords}
                            onChangeText={setCustomWords}
                            multiline
                            style={[
                                styles.customInput,
                                { borderColor: c.border, backgroundColor: c.backgroundElevated, color: c.text },
                            ]}
                        />
                    ) : null}

                    <Text style={[styles.label, { color: c.textSecondary }]}>Card face mode</Text>
                    <RNView style={[styles.pickerWrap, { borderColor: c.border, backgroundColor: c.backgroundElevated }]}>
                        <Picker
                            selectedValue={quizMode}
                            onValueChange={(v) => setQuizMode(v as QuizMode)}
                            style={pc.style}
                            itemStyle={pc.itemStyle}
                            dropdownIconColor={pc.dropdownIconColor}
                        >
                            <Picker.Item label="🔄 Normal" value="normal" color={pc.itemColor} />
                            <Picker.Item label="🔄 Reverse" value="reverse" color={pc.itemColor} />
                            <Picker.Item label="❓ Quiz" value="quiz" color={pc.itemColor} />
                        </Picker>
                    </RNView>

                    <Text style={[styles.label, { color: c.textSecondary }]}>Filter</Text>
                    <RNView style={[styles.pickerWrap, { borderColor: c.border, backgroundColor: c.backgroundElevated }]}>
                        <Picker
                            selectedValue={filterMode}
                            onValueChange={(v) => setFilterMode(v as FilterMode)}
                            style={pc.style}
                            itemStyle={pc.itemStyle}
                            dropdownIconColor={pc.dropdownIconColor}
                        >
                            <Picker.Item label="All cards" value="all" color={pc.itemColor} />
                            <Picker.Item label="Unknown" value="unknown" color={pc.itemColor} />
                            <Picker.Item label="Review" value="review" color={pc.itemColor} />
                            <Picker.Item label="Unrated" value="unrated" color={pc.itemColor} />
                            <Picker.Item label="Unknown + Review" value="unknown+review" color={pc.itemColor} />
                        </Picker>
                    </RNView>

                    <Pressable
                        style={[
                            styles.primaryBtn,
                            (loadingAll || loadingPage) && styles.primaryBtnDisabled,
                        ]}
                        onPress={startStudy}
                        disabled={loadingAll || loadingPage}
                    >
                        <LinearGradient
                            colors={[...c.heroGradient]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.gradientBtn}
                        >
                            <Text style={[styles.primaryBtnText, { color: c.heroOnGradient }]}>
                                {loadingAll ? 'Loading all pages…' : loadingPage ? 'Loading page…' : '🎯 Start Study Session'}
                            </Text>
                        </LinearGradient>
                    </Pressable>
                    </RNView>
                </RNView>
            </ScrollView>

            <Modal
                visible={studyOpen}
                animationType="slide"
                presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
                onRequestClose={() => {
                    setStudyOpen(false);
                    setCurrentCard(null);
                }}
            >
                <View style={[styles.modalRoot, { backgroundColor: c.backgroundElevated }]}>
                    {/* Confetti effect */}
                    {showConfetti && (
                        <RNView style={styles.confettiOverlay}>
                            <Text style={styles.confettiText}>🎉 Congratulations! 🎉</Text>
                        </RNView>
                    )}

                    {/* Motivational message */}
                    {currentMessage !== '' && (
                        <Animated.View style={[styles.messageToast, { opacity: cardOpacity }]}>
                            <Text style={styles.messageText}>{currentMessage}</Text>
                        </Animated.View>
                    )}

                    <RNView
                        style={[
                            styles.modalBodyColumn,
                            Platform.OS === 'web' && [styles.modalBodyColumnWeb, { maxWidth: webStudyMaxW }],
                        ]}
                    >
                        <RNView style={styles.modalTop}>
                            <RNView style={styles.statsContainer}>
                                <Text style={[styles.sessionMeta, { color: c.textSecondary }]}>
                                    📊 {sessionCards.length} cards
                                </Text>
                                <Text style={[styles.sessionMeta, { color: c.textSecondary }]}>
                                    🎯 {sessionStudied} new
                                </Text>
                                <Text style={[styles.sessionMeta, { color: c.textSecondary }]}>
                                    ⏱️ {sessionText}
                                </Text>
                            </RNView>
                            <Pressable
                                onPress={() => {
                                    setStudyOpen(false);
                                    setCurrentCard(null);
                                }}
                                style={styles.closeBtn}
                            >
                                <Text style={[styles.closeBtnText, { color: c.accent }]}>Exit</Text>
                            </Pressable>
                        </RNView>

                        <RNView style={[styles.progressTrack, { backgroundColor: c.border }]}>
                            <RNView
                                style={[
                                    styles.progressFill,
                                    { width: `${ratedBarPct}%`, backgroundColor: c.accent },
                                ]}
                            />
                        </RNView>
                        <Text style={[styles.progressText, { color: c.muted }]}>{progressLabel}</Text>

                        <ScrollView
                            style={styles.modalScroll}
                            contentContainerStyle={styles.modalScrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                        {currentCard ? (
                            <>
                                {quizMode === 'quiz' ? (
                                    <RNView
                                        style={[
                                            styles.cardChrome,
                                            { minHeight: cardStageHeight, borderColor: c.border, backgroundColor: c.background },
                                        ]}
                                    >
                                        <RNView style={[styles.badgeFloating, { backgroundColor: badge.tone }]}>
                                            <Text style={styles.badgeText}>{badge.label}</Text>
                                        </RNView>
                                        <RNView style={[styles.quizArea, styles.quizAreaTall]}>
                                            <Text style={[styles.cardFaceLabel, { color: c.textSecondary }]}>Prompt</Text>
                                            <Text style={[styles.cardFrontLarge, { color: c.text, textAlign: 'center' }]}>{frontText}</Text>
                                            <Text style={[styles.cardFaceHintLabel, { color: c.muted }]}>{hintText}</Text>
                                            <Text style={[styles.quizChoicesLabel, { color: c.textSecondary }]}>Choose</Text>
                                            {quizChoices.map((ch) => (
                                                <Pressable
                                                    key={ch}
                                                    style={[styles.choiceBtn, { borderColor: c.accent, backgroundColor: c.accentMuted }]}
                                                    onPress={() => checkQuiz(ch)}
                                                >
                                                    <Text style={[styles.choiceText, { color: c.text }]}>{stripArticle(ch)}</Text>
                                                </Pressable>
                                            ))}
                                        </RNView>
                                    </RNView>
                                ) : (
                                    <Animated.View
                                        style={[
                                            styles.cardPanOuter,
                                            { borderColor: c.border, transform: [{ scale: cardScale }], opacity: cardOpacity },
                                        ]}
                                        {...cardPanResponder.panHandlers}
                                    >
                                        <RNView style={[styles.badgeFloating, { backgroundColor: badge.tone }]}>
                                            <Text style={styles.badgeText}>{badge.label}</Text>
                                        </RNView>
                                        {swipeHint === 'left' ? (
                                            <Text style={[styles.swipeInd, styles.swipeIndLeft, { color: c.textSecondary }]}>✗</Text>
                                        ) : null}
                                        {swipeHint === 'right' ? (
                                            <Text style={[styles.swipeInd, styles.swipeIndRight, { color: c.textSecondary }]}>✓</Text>
                                        ) : null}
                                        {swipeHint === 'up' ? (
                                            <Text style={[styles.swipeInd, styles.swipeIndUp, { color: c.textSecondary }]}>↑</Text>
                                        ) : null}
                                        {swipeHint === 'down' ? (
                                            <Text style={[styles.swipeInd, styles.swipeIndDown, { color: c.textSecondary }]}>↓</Text>
                                        ) : null}
                                        <Animated.View style={{ transform: [{ translateX: slideX }], opacity: slideOpacity }}>
                                            <RNView style={[styles.cardFlipStage, { height: cardStageHeight }]}>
                                                <Animated.View
                                                    style={[
                                                        styles.cardFlipper,
                                                        {
                                                            transform: [{ perspective: 1000 }, { rotateY: flipperRotateY }],
                                                            ...({ transformStyle: 'preserve-3d' } as object),
                                                        },
                                                    ]}
                                                >
                                                    <LinearGradient
                                                        colors={[cardFrontBg, cardFrontBg]}
                                                        style={[styles.cardFacePane, styles.cardFaceFront]}
                                                    >
                                                        <RNView style={styles.cardFaceCenter}>
                                                            <Text style={[styles.cardFaceLabel, { color: cardFrontFg, opacity: 0.55 }]}>
                                                                {quizMode === 'reverse' ? 'Meanings' : 'German'}
                                                            </Text>
                                                            <Text style={[styles.cardFrontLarge, { color: cardFrontFg }]}>{frontText}</Text>
                                                            <Text style={[styles.cardFaceHintLabel, { color: cardFrontFg, opacity: 0.62 }]}>
                                                                {hintText}
                                                            </Text>
                                                        </RNView>
                                                    </LinearGradient>
                                                    <LinearGradient
                                                        colors={[cardBackBg, cardBackBg]}
                                                        style={[styles.cardFacePane, styles.cardFaceBack]}
                                                    >
                                                        <ScrollView
                                                            contentContainerStyle={[
                                                                styles.cardBackScroll,
                                                                { minHeight: cardStageHeight - 8 },
                                                            ]}
                                                            showsVerticalScrollIndicator={false}
                                                            bounces={false}
                                                        >
                                                            <Text style={styles.backSectionLabel}>German</Text>
                                                            <Text style={[styles.backGermanHeadline, { color: cardBackFg }]}>{currentCard.word}</Text>

                                                            <Text style={styles.backSectionLabel}>Bangla pronunciation</Text>
                                                            <Text style={[styles.backPronunciation, { color: cardBackFg }]}>{currentCard.pronunciation}</Text>

                                                            <RNView style={styles.backMeaningsRow}>
                                                                <RNView style={styles.backMeaningPill}>
                                                                    <Text style={styles.backPillKind}>বাংলা</Text>
                                                                    <Text style={[styles.backPillValue, { color: cardBackFg }]}>{currentCard.banglaMeaning}</Text>
                                                                </RNView>
                                                                <RNView style={styles.backMeaningPill}>
                                                                    <Text style={styles.backPillKind}>English</Text>
                                                                    <Text style={[styles.backPillValue, { color: cardBackFg }]}>{currentCard.englishMeaning}</Text>
                                                                </RNView>
                                                            </RNView>

                                                            {currentCard.partizipII ? (
                                                                <>
                                                                    <Text style={[styles.backSectionLabel, styles.backSectionLabelSpaced]}>Partizip II</Text>
                                                                    <RNView style={styles.backPartizipChip}>
                                                                        <Text style={[styles.backPartizipText, { color: cardBackFg }]}>
                                                                            {currentCard.partizipII}
                                                                        </Text>
                                                                    </RNView>
                                                                </>
                                                            ) : null}

                                                            <RNView style={[styles.backDivider, { backgroundColor: 'rgba(255,255,255,0.28)' }]} />

                                                            <Text style={styles.backSectionLabel}>Example</Text>
                                                            <Text style={[styles.backExampleSentence, { color: cardBackFg }]}>{currentCard.sentence}</Text>
                                                        </ScrollView>
                                                    </LinearGradient>
                                                </Animated.View>
                                            </RNView>
                                        </Animated.View>
                                    </Animated.View>
                                )}

                                <RNView style={styles.quickRow}>
                                    <Pressable onPress={playAudio} style={styles.iconBtn}>
                                        <Text style={[styles.link, { color: c.accent }]}>🔊 Audio</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => openLink(`https://www.dict.cc/?s=${encodeURIComponent(stripArticle(currentCard.word))}`)}
                                        style={styles.iconBtn}
                                    >
                                        <Text style={[styles.link, { color: c.accent }]}>📖 Dict.cc</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() =>
                                            openLink(`https://en.wiktionary.org/wiki/${encodeURIComponent(stripArticle(currentCard.word))}#German`)
                                        }
                                        style={styles.iconBtn}
                                    >
                                        <Text style={[styles.link, { color: c.accent }]}>📚 Wiktionary</Text>
                                    </Pressable>
                                </RNView>

                                {quizMode !== 'quiz' ? (
                                    <RNView style={styles.markRow}>
                                        <Pressable
                                            style={[
                                                styles.markBtn,
                                                { backgroundColor: c.statusChipKnown },
                                                currentMark === 'known' && styles.markBtnActive,
                                            ]}
                                            onPress={() => markCard('known')}
                                        >
                                            <Text style={styles.markText}>✓ Known ({stats.known})</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[
                                                styles.markBtn,
                                                { backgroundColor: c.statusChipUnknown },
                                                currentMark === 'unknown' && styles.markBtnActive,
                                            ]}
                                            onPress={() => markCard('unknown')}
                                        >
                                            <Text style={styles.markText}>✗ Unknown ({stats.unknown})</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[
                                                styles.markBtn,
                                                { backgroundColor: c.statusChipReview },
                                                currentMark === 'review' && styles.markBtnActive,
                                            ]}
                                            onPress={() => markCard('review')}
                                        >
                                            <Text style={styles.markText}>🔄 Review ({stats.review})</Text>
                                        </Pressable>
                                    </RNView>
                                ) : null}

                                <RNView style={styles.navRow}>
                                    <Pressable style={styles.navBtn} onPress={goPrev}>
                                        <Text style={{ color: c.accent, fontWeight: '600' }}>← Previous</Text>
                                    </Pressable>
                                    <Pressable style={styles.navBtn} onPress={goNext}>
                                        <Text style={{ color: c.accent, fontWeight: '600' }}>Next →</Text>
                                    </Pressable>
                                </RNView>
                            </>
                        ) : (
                            <Text style={[styles.muted, { color: c.muted }]}>Preparing cards…</Text>
                        )}

                        <RNView style={[styles.statsHeaderRow, { borderTopColor: c.border }]}>
                            <Pressable style={styles.statsToggle} onPress={() => setStatsExpanded((x) => !x)}>
                                <Text style={[styles.statsHeaderTitle, { color: c.text }]}>
                                    {statsExpanded ? '▼' : '▶'} Statistics
                                </Text>
                            </Pressable>
                            <RNView style={styles.statsHeaderActions}>
                                <Pressable onPress={() => void exportProgressData()} style={styles.statsOutlineBtn}>
                                    <Text style={[styles.statsOutlineBtnText, { color: c.accent }]}>Export</Text>
                                </Pressable>
                                <Pressable onPress={clearAllProgress} style={styles.statsOutlineBtn}>
                                    <Text style={[styles.statsOutlineBtnText, { color: c.textSecondary }]}>Clear</Text>
                                </Pressable>
                            </RNView>
                        </RNView>

                        {statsExpanded ? (
                            <>
                                <RNView style={styles.statGrid}>
                                    <RNView style={styles.statCell}>
                                        <Text style={[styles.statVal, { color: c.text }]}>{stats.total}</Text>
                                        <Text style={[styles.statLbl, { color: c.muted }]}>Total</Text>
                                    </RNView>
                                    <RNView style={styles.statCell}>
                                        <Text style={[styles.statVal, { color: c.statusKnown }]}>{stats.known}</Text>
                                        <Text style={[styles.statLbl, { color: c.muted }]}>Known</Text>
                                    </RNView>
                                    <RNView style={styles.statCell}>
                                        <Text style={[styles.statVal, { color: c.statusUnknown }]}>{stats.unknown}</Text>
                                        <Text style={[styles.statLbl, { color: c.muted }]}>Unknown</Text>
                                    </RNView>
                                    <RNView style={styles.statCell}>
                                        <Text style={[styles.statVal, { color: c.statusReview }]}>{stats.review}</Text>
                                        <Text style={[styles.statLbl, { color: c.muted }]}>Review</Text>
                                    </RNView>
                                    <RNView style={styles.statCell}>
                                        <Text style={[styles.statVal, { color: c.text }]}>{stats.pct}%</Text>
                                        <Text style={[styles.statLbl, { color: c.muted }]}>Progress</Text>
                                    </RNView>
                                </RNView>
                                <Text style={[styles.historyTitle, { color: c.textSecondary }]}>Last 30 days (cards studied)</Text>
                                <RNView style={styles.historyChart}>
                                    {historyBars.max === 0 ? (
                                        <Text style={[styles.historyEmpty, { color: c.muted }]}>No activity yet</Text>
                                    ) : (
                                        historyBars.bars.map((b) => {
                                            const h = Math.max(2, (b.studied / historyBars.max) * 45);
                                            return (
                                                <RNView key={b.date} style={styles.historyBarWrap}>
                                                    <RNView style={[styles.historyBar, { height: h, backgroundColor: c.accent }]} />
                                                </RNView>
                                            );
                                        })
                                    )}
                                </RNView>
                                {historyBars.max > 0 ? (
                                    <RNView style={styles.historyLabels}>
                                        <Text style={[styles.historyLabelText, { color: c.muted }]}>{historyBars.startLabel}</Text>
                                        <Text style={[styles.historyLabelText, { color: c.muted }]}>Today</Text>
                                    </RNView>
                                ) : null}
                            </>
                        ) : null}
                        </ScrollView>
                    </RNView>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    setup: { paddingBottom: 48 },
    setupContentWeb: {
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    webSetupInner: {
        width: '100%',
    },
    headerGradient: {
        padding: 24,
        paddingTop: 48,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        marginBottom: 16,
    },
    h1: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
    subtitle: { fontSize: 14, opacity: 0.8 },
    setupCard: {
        padding: 16,
    },
    label: { fontWeight: '600', marginTop: 8, marginBottom: 4, fontSize: 14 },
    pickerWrap: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
    customInput: { minHeight: 100, borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 8, textAlignVertical: 'top' },
    primaryBtn: { marginTop: 20, borderRadius: 12, overflow: 'hidden' },
    gradientBtn: { padding: 14, alignItems: 'center' },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { fontWeight: '700', fontSize: 16 },
    statsSummary: { marginTop: 16, fontSize: 13, lineHeight: 18 },
    modalRoot: { flex: 1, padding: 16, paddingTop: 48 },
    modalBodyColumn: { flex: 1 },
    modalBodyColumnWeb: {
        width: '100%',
        alignSelf: 'center',
    },
    modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    statsContainer: { flexDirection: 'row', gap: 12, flex: 1 },
    sessionMeta: { fontSize: 12, fontWeight: '500' },
    closeBtn: { padding: 8 },
    closeBtnText: { fontWeight: '700', fontSize: 16 },
    modalScroll: { flex: 1 },
    modalScrollContent: { paddingBottom: 32 },
    progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
    progressFill: { height: 6, borderRadius: 3 },
    progressText: { marginVertical: 8, fontSize: 12 },
    shortcutsHint: { fontSize: 11, lineHeight: 15, marginBottom: 4 },
    cardPanOuter: { position: 'relative', width: '100%', borderWidth: 1, borderRadius: 24, overflow: 'visible', marginVertical: 8 },
    swipeInd: {
        position: 'absolute',
        fontSize: 32,
        fontWeight: '700',
        opacity: 0.7,
        zIndex: 2,
        pointerEvents: 'none',
    },
    swipeIndLeft: { left: 16, top: '45%' },
    swipeIndRight: { right: 16, top: '45%' },
    swipeIndUp: { top: 16, left: 0, right: 0, textAlign: 'center' },
    swipeIndDown: { bottom: 16, left: 0, right: 0, textAlign: 'center' },
    cardChrome: {
        position: 'relative',
        width: '100%',
        borderWidth: 1,
        borderRadius: 24,
        overflow: 'hidden',
        marginVertical: 8,
    },
    badgeFloating: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 30,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardFlipStage: {
        width: '100%',
        position: 'relative',
        borderRadius: 24,
        overflow: 'visible',
    },
    cardFlipper: {
        width: '100%',
        height: '100%',
        position: 'relative',
        borderRadius: 24,
    },
    cardFacePane: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
        backfaceVisibility: 'hidden',
        overflow: 'hidden',
    },
    cardFaceFront: {
        transform: [{ rotateY: '0deg' }],
        zIndex: 2,
    },
    cardFaceBack: {
        transform: [{ rotateY: '180deg' }],
        zIndex: 1,
    },
    cardFaceCenter: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    cardFaceLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: 6,
    },
    cardFaceHintLabel: {
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
        marginTop: 10,
    },
    quizChoicesLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        textAlign: 'center',
        marginTop: 18,
        marginBottom: 8,
    },
    cardFrontLarge: { fontSize: 32, fontWeight: '700', textAlign: 'center', lineHeight: 42 },
    cardBackScroll: {
        paddingHorizontal: 20,
        paddingVertical: 24,
        alignItems: 'center',
        flexGrow: 1,
        justifyContent: 'center',
    },
    backSectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.52)',
        textAlign: 'center',
        marginBottom: 5,
    },
    backSectionLabelSpaced: { marginTop: 12 },
    backGermanHeadline: {
        fontSize: 26,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 34,
        marginBottom: 14,
    },
    backPronunciation: {
        fontSize: 16,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 22,
        opacity: 0.9,
        marginBottom: 16,
    },
    backMeaningsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        marginBottom: 14,
        paddingHorizontal: 4,
    },
    backMeaningPill: {
        flexGrow: 1,
        flexBasis: '44%',
        minWidth: 132,
        maxWidth: '100%',
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    backPillKind: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.9,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
        marginBottom: 6,
    },
    backPillValue: {
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 22,
        textAlign: 'center',
    },
    backPartizipChip: {
        alignSelf: 'center',
        backgroundColor: 'rgba(255,200,50,0.3)',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginBottom: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,220,130,0.45)',
    },
    backPartizipText: {
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    backDivider: { width: 56, height: 1, marginVertical: 14 },
    backExampleSentence: {
        fontSize: 14,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 22,
        opacity: 0.92,
        paddingHorizontal: 6,
        marginTop: 2,
    },
    quizAreaTall: { flex: 1, justifyContent: 'center', width: '100%', paddingHorizontal: 12, paddingTop: 40 },
    statsHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 20,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 8,
    },
    statsToggle: { flex: 1, minWidth: 0 },
    statsHeaderTitle: { fontSize: 15, fontWeight: '700' },
    statsHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statsOutlineBtn: { paddingVertical: 8, paddingHorizontal: 10 },
    statsOutlineBtnText: { fontSize: 13, fontWeight: '600' },
    statGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 12,
    },
    statCell: { width: '30%', minWidth: 72, alignItems: 'center' },
    statVal: { fontSize: 20, fontWeight: '700' },
    statLbl: { fontSize: 11, marginTop: 2 },
    historyTitle: { fontSize: 12, fontWeight: '600', marginTop: 16 },
    historyChart: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 52,
        marginTop: 8,
        gap: 2,
    },
    historyBarWrap: { flex: 1, alignItems: 'center', maxWidth: 12 },
    historyBar: { width: 4, borderRadius: 2, minHeight: 2 },
    historyEmpty: { flex: 1, textAlign: 'center', fontSize: 12, paddingVertical: 16 },
    historyLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    historyLabelText: { fontSize: 10 },
    badgeText: { color: '#ffffff', fontWeight: '700', fontSize: 11 },
    quizArea: { gap: 8 },
    choiceBtn: { borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 4 },
    choiceText: { fontSize: 16, textAlign: 'center', fontWeight: '500' },
    quickRow: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
    iconBtn: { paddingHorizontal: 12, paddingVertical: 6 },
    link: { fontWeight: '600', fontSize: 14 },
    markRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
    markBtn: { flex: 1, minWidth: 90, padding: 12, borderRadius: 10, alignItems: 'center' },
    markBtnActive: { borderWidth: 2, borderColor: '#ffffff', transform: [{ scale: 1.02 }] },
    markText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
    navRow: { flexDirection: 'row', gap: 20, marginTop: 20, justifyContent: 'center' },
    navBtn: { padding: 12, minWidth: 100, alignItems: 'center' },
    muted: { opacity: 0.7, marginTop: 24, textAlign: 'center' },
    confettiOverlay: {
        position: 'absolute',
        top: '40%',
        left: 0,
        right: 0,
        zIndex: 1000,
        alignItems: 'center',
    },
    confettiText: {
        fontSize: 24,
        fontWeight: 'bold',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 16,
        borderRadius: 12,
        color: '#fff',
    },
    messageToast: {
        position: 'absolute',
        top: 100,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 12,
        borderRadius: 24,
        alignItems: 'center',
        zIndex: 999,
    },
    messageText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});