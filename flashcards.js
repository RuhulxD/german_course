// books, allPages, parseCSV come from config.js

// Flashcard application state
let cards = [];
let availableCards = [];
let shownCards = [];
let totalCardsShown = 0;
let currentCard = null;
let cardStatuses = {};
let isFlipped = false;
let loadedPages = new Set();
let totalPages = allPages.length;
let isLoadingMore = false;
let isSelectingCard = false;
let currentQuizMode = 'normal';
let currentFilter = 'all';

// Session tracking
let sessionStartTime = null;
let sessionCardsStudied = 0;
let sessionTimerInterval = null;

// Progress history
let progressHistory = {};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    generatePageOptions();
    setupModeSelector();
    loadProgress();
    loadProgressHistory();
    setupKeyboardShortcuts();
    setupSwipeGestures();
    renderProgressHistory();
});

function generatePageOptions() {
    const pageSelect = document.getElementById('pageSelect');
    pageSelect.innerHTML = '<option value="">Select Page...</option>';
    books.forEach(book => {
        const group = document.createElement('optgroup');
        group.label = book.name;
        book.pages.forEach(p => {
            const option = document.createElement('option');
            option.value = `${book.folder}/${p}`;
            option.textContent = `Page ${p}`;
            group.appendChild(option);
        });
        pageSelect.appendChild(group);
    });
}

function setupModeSelector() {
    const studyMode = document.getElementById('studyMode');
    const customInputSection = document.getElementById('customSection');
    const pageSelect = document.getElementById('pageSelect');

    studyMode.addEventListener('change', function() {
        if (this.value === 'custom') {
            customInputSection.classList.remove('hidden');
            pageSelect.style.display = 'none';
        } else {
            customInputSection.classList.add('hidden');
            pageSelect.style.display = 'inline-block';
        }
    });

    document.getElementById('quizMode').addEventListener('change', function() {
        currentQuizMode = this.value;
        if (currentCard) displayCard();
    });

    document.getElementById('filterMode').addEventListener('change', function() {
        currentFilter = this.value;
    });
}

// --- Card Loading ---

async function loadCards() {
    const studyMode = document.getElementById('studyMode').value;
    currentQuizMode = document.getElementById('quizMode').value;
    currentFilter = document.getElementById('filterMode').value;

    if (studyMode === 'page') {
        const pageNum = document.getElementById('pageSelect').value;
        if (!pageNum) { alert('Please select a page'); return; }
        await loadCardsFromPage(pageNum);
    } else if (studyMode === 'all') {
        await loadCardsFromAllPages();
    } else if (studyMode === 'custom') {
        loadCustomWords();
    }
}

function mapRowToCard(row) {
    return {
        word: row['German Word'] || '',
        pronunciation: row['Bangla Pronunciation'] || '',
        banglaMeaning: row['Bangla Meaning'] || '',
        englishMeaning: row['English Meaning'] || '',
        sentence: row['German sentence'] || ''
    };
}

async function loadCardsFromPage(pageNum) {
    try {
        const response = await fetch(`lws/csv/${pageNum}.csv`);
        if (!response.ok) throw new Error(`File not found: lws/csv/${pageNum}.csv`);
        const data = parseCSV(await response.text());
        if (data.length === 0) { alert('No data found'); return; }

        cards = data.map(mapRowToCard).filter(c => c.word.trim() !== '');
        availableCards = applyFilter([...cards]);
        applySRSWeighting();
        shownCards = [];
        currentCard = null;
        loadedPages.clear();
        loadedPages.add(pageNum);
        initializeFlashcards();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function loadCardsFromAllPages() {
    cards = [];
    availableCards = [];
    shownCards = [];
    totalCardsShown = 0;
    loadedPages.clear();
    currentCard = null;
    await loadNextPages(2);
    if (cards.length === 0) { alert('No cards found'); return; }
    initializeFlashcards();
}

async function loadNextPages(count = 2) {
    if (isLoadingMore) return;
    isLoadingMore = true;

    const pagesToLoad = [];
    for (let i = 0; i < allPages.length && pagesToLoad.length < count; i++) {
        if (!loadedPages.has(allPages[i])) pagesToLoad.push(allPages[i]);
    }

    if (pagesToLoad.length === 0) { isLoadingMore = false; updateProgress(); return; }

    const results = await Promise.all(pagesToLoad.map(async (pagePath) => {
        try {
            const response = await fetch(`lws/csv/${pagePath}.csv`);
            if (response.ok) {
                const pageCards = parseCSV(await response.text())
                    .map(mapRowToCard).filter(c => c.word.trim() !== '');
                loadedPages.add(pagePath);
                return pageCards;
            }
        } catch (e) {}
        return [];
    }));

    const newCards = results.flat();
    cards = cards.concat(newCards);
    availableCards = availableCards.concat(applyFilter(newCards));
    applySRSWeighting();
    isLoadingMore = false;
    updateProgress();
    updateStatistics();
}

// Filter cards by status
function applyFilter(cardList) {
    if (currentFilter === 'all') return cardList;
    return cardList.filter(card => {
        const status = cardStatuses[card.word];
        if (currentFilter === 'unknown') return status === 'unknown';
        if (currentFilter === 'review') return status === 'review';
        if (currentFilter === 'unrated') return !status;
        if (currentFilter === 'unknown+review') return status === 'unknown' || status === 'review';
        return true;
    });
}

// SRS weighting
function applySRSWeighting() {
    const weighted = [];
    availableCards.forEach(card => {
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
    const seen = new Set();
    availableCards = weighted.filter(card => {
        if (seen.has(card.word)) return false;
        seen.add(card.word);
        return true;
    });
}

async function loadCustomWords() {
    const customInput = document.getElementById('customWordsInput').value.trim();
    if (!customInput) { alert('Please enter some words'); return; }

    const words = customInput.split('\n').map(w => w.trim()).filter(w => w);
    cards = [];
    availableCards = [];
    shownCards = [];
    loadedPages.clear();
    currentCard = null;

    for (const pagePath of allPages) {
        try {
            const response = await fetch(`lws/csv/${pagePath}.csv`);
            if (response.ok) {
                const pageCards = parseCSV(await response.text())
                    .map(mapRowToCard)
                    .filter(card => {
                        const w = card.word.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
                        return card.word.trim() !== '' && words.some(q =>
                            w === q.toLowerCase() || card.word.toLowerCase().includes(q.toLowerCase())
                        );
                    });
                cards = cards.concat(pageCards);
                loadedPages.add(pagePath);
            }
        } catch (e) {}
    }

    if (cards.length === 0) { alert('No matching words found'); return; }
    availableCards = [...cards];
    shuffleArray(availableCards);
    initializeFlashcards();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- Fullscreen Mode ---

function enterFullscreen() {
    document.body.classList.add('fullscreen-active');
}

function exitFullscreen() {
    document.body.classList.remove('fullscreen-active');
    // Scroll to flashcard area so user sees their progress
    document.getElementById('flashcardArea').scrollIntoView({ behavior: 'smooth' });
}

// --- Session Management ---

function startSession() {
    sessionStartTime = Date.now();
    sessionCardsStudied = 0;
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    sessionTimerInterval = setInterval(updateSessionTimer, 1000);
    updateSessionDisplay();
}

function updateSessionTimer() {
    if (!sessionStartTime) return;
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    const timeStr = `${min}:${sec.toString().padStart(2, '0')}`;
    // Sync both fullscreen and legacy timer elements
    const el = document.getElementById('sessionTimer');
    const elLegacy = document.getElementById('sessionTimerLegacy');
    if (el) el.textContent = timeStr;
    if (elLegacy) elLegacy.textContent = timeStr;
}

function updateSessionDisplay() {
    const txt = `${sessionCardsStudied} cards`;
    const txtLong = `${sessionCardsStudied} cards this session`;
    const el = document.getElementById('sessionCards');
    const elLegacy = document.getElementById('sessionCardsLegacy');
    if (el) el.textContent = txt;
    if (elLegacy) elLegacy.textContent = txtLong;
}

// --- Flashcard Core ---

function initializeFlashcards() {
    if (cards.length === 0) return;
    isFlipped = false;
    shownCards = [];
    totalCardsShown = 0;

    // Check if filter returned no cards
    if (availableCards.length === 0) {
        alert(`No cards match the "${currentFilter}" filter. Try "All cards".`);
        return;
    }

    document.getElementById('flashcardArea').classList.remove('hidden');
    enterFullscreen();
    setupSwipeGestures();
    startSession();
    selectRandomCard();
    updateProgress();
    updateStatistics();
    renderProgressHistory();
}

function cardExistsInArray(card, array) {
    return array.some(c => c.word === card.word);
}

function selectRandomCard() {
    if (isSelectingCard) return;
    isSelectingCard = true;

    try {
        if (availableCards.length < 20 && loadedPages.size < totalPages && !isLoadingMore) {
            loadNextPages(2);
        }

        if (availableCards.length === 0) {
            if (loadedPages.size < totalPages && !isLoadingMore) {
                loadNextPages(2).then(() => {
                    isSelectingCard = false;
                    if (availableCards.length > 0) selectRandomCard();
                    else recycleCards();
                }).catch(() => { isSelectingCard = false; });
            } else {
                recycleCards();
            }
            return;
        }

        const idx = Math.floor(Math.random() * availableCards.length);
        currentCard = availableCards[idx];
        if (!currentCard) { isSelectingCard = false; return; }

        availableCards.splice(idx, 1);
        shownCards.push(currentCard);
        totalCardsShown++;

        if (shownCards.length > 6) {
            const removed = shownCards.shift();
            if (availableCards.length < 10 && loadedPages.size >= totalPages) {
                if (!cardExistsInArray(removed, availableCards)) availableCards.push(removed);
            }
        }

        displayCard();
        isSelectingCard = false;
    } catch (e) {
        console.error('selectRandomCard error:', e);
        isSelectingCard = false;
    }
}

function recycleCards() {
    if (shownCards.length > 0) {
        availableCards = applyFilter([...shownCards]);
        if (availableCards.length === 0) availableCards = [...shownCards]; // fallback
        applySRSWeighting();
        shownCards = [];
        isSelectingCard = false;
        selectRandomCard();
    } else {
        isSelectingCard = false;
    }
}

// --- Display ---

function displayCard() {
    if (!currentCard) return;
    const flashcard = document.getElementById('flashcard');
    if (!flashcard) return;

    isFlipped = false;
    flashcard.classList.remove('flipped');

    const quizChoices = document.getElementById('quizChoices');
    const markButtons = document.getElementById('markButtons');

    // Update status badge
    updateStatusBadge();
    updateMarkButtonHighlight();

    if (currentQuizMode === 'quiz') {
        quizChoices.classList.remove('hidden');
        markButtons.classList.add('hidden');
        flashcard.onclick = null;
        document.getElementById('cardWord').textContent = currentCard.banglaMeaning + ' / ' + currentCard.englishMeaning;
        document.getElementById('cardHint').textContent = 'Choose the correct German word';
        generateQuizChoices();
    } else if (currentQuizMode === 'reverse') {
        quizChoices.classList.add('hidden');
        markButtons.classList.remove('hidden');
        flashcard.onclick = flipCard;
        document.getElementById('cardWord').textContent = currentCard.banglaMeaning + ' / ' + currentCard.englishMeaning;
        document.getElementById('cardHint').textContent = 'Click to see the German word';
    } else {
        quizChoices.classList.add('hidden');
        markButtons.classList.remove('hidden');
        flashcard.onclick = flipCard;
        const wordWithoutArticle = currentCard.word.replace(/^(der|die|das)\s+/i, '').trim();
        document.getElementById('cardWord').textContent = wordWithoutArticle || currentCard.word;
        document.getElementById('cardHint').textContent = 'Click to flip';
    }

    updateBackSide();
    updateQuickLinks(currentCard.word);
    document.getElementById('prevBtn').disabled = false;
    document.getElementById('nextBtn').disabled = false;
    updateProgress();
}

function updateStatusBadge() {
    const badge = document.getElementById('cardBadge');
    const status = cardStatuses[currentCard.word];
    badge.className = 'badge';
    if (status === 'known') { badge.classList.add('badge-known'); badge.textContent = 'KNOWN'; }
    else if (status === 'unknown') { badge.classList.add('badge-unknown'); badge.textContent = 'UNKNOWN'; }
    else if (status === 'review') { badge.classList.add('badge-review'); badge.textContent = 'REVIEW'; }
    else { badge.classList.add('badge-new'); badge.textContent = 'NEW'; }
}

function updateMarkButtonHighlight() {
    const status = cardStatuses[currentCard.word];
    document.getElementById('btnKnown').classList.toggle('active-mark', status === 'known');
    document.getElementById('btnUnknown').classList.toggle('active-mark', status === 'unknown');
    document.getElementById('btnReview').classList.toggle('active-mark', status === 'review');
}

function updateBackSide() {
    document.getElementById('cardFullWord').textContent = currentCard.word || '-';
    document.getElementById('cardPronunciation').textContent = currentCard.pronunciation || '-';
    document.getElementById('cardBanglaMeaning').textContent = currentCard.banglaMeaning || '-';
    document.getElementById('cardEnglishMeaning').textContent = currentCard.englishMeaning || '-';
    document.getElementById('cardSentence').textContent = currentCard.sentence || '-';
}

function generateQuizChoices() {
    const quizChoices = document.getElementById('quizChoices');
    const wrongCards = cards.filter(c => c.word !== currentCard.word);
    shuffleArray(wrongCards);
    const choices = [currentCard.word];
    for (let i = 0; i < Math.min(3, wrongCards.length); i++) choices.push(wrongCards[i].word);
    shuffleArray(choices);

    quizChoices.innerHTML = choices.map(choice => {
        const display = choice.replace(/^(der|die|das)\s+/i, '').trim();
        return `<button class="quiz-choice-btn" onclick="checkQuizAnswer(this, '${choice.replace(/'/g, "\\'")}')">${display}</button>`;
    }).join('');
}

function checkQuizAnswer(btn, selectedWord) {
    const buttons = document.querySelectorAll('.quiz-choice-btn');
    const isCorrect = selectedWord === currentCard.word;
    const correctDisplay = currentCard.word.replace(/^(der|die|das)\s+/i, '').trim();

    buttons.forEach(b => {
        b.disabled = true;
        if (b.textContent === correctDisplay) b.classList.add('correct');
    });

    if (!isCorrect) { btn.classList.add('wrong'); markCard('unknown'); }
    else { markCard('known'); }

    setTimeout(() => {
        document.getElementById('flashcard').classList.add('flipped');
        setTimeout(() => nextCard(), 1500);
    }, 500);
}

function updateQuickLinks(word) {
    const wordForLink = word.replace(/^(der|die|das)\s+/i, '').trim();
    const enc = encodeURIComponent(wordForLink);
    const sentence = currentCard.sentence || '';

    let html = `
        <button class="audio-btn" onclick="playAudio(event)">Audio</button>
        <a href="https://www.dict.cc/?s=${enc}" target="_blank" class="quick-link">Dict.cc</a>
        <a href="https://en.wiktionary.org/wiki/${enc}#German" target="_blank" class="quick-link">Wiktionary</a>
    `;
    if (sentence) {
        html += `<a href="https://translate.google.com/?sl=de&tl=en&text=${encodeURIComponent(sentence)}" target="_blank" class="quick-link">Translate</a>`;
    }
    document.getElementById('quickLinks').innerHTML = html;
}

// --- Card Actions ---

function flipCard() {
    const flashcard = document.getElementById('flashcard');
    isFlipped = !isFlipped;
    flashcard.classList.toggle('flipped');

    // Auto-play audio on flip to back
    if (isFlipped && currentCard) {
        playAudioSilent();
    }
}

function previousCard() {
    if (shownCards.length > 1) {
        animateCard('anim-r', () => {
            if (currentCard && !cardExistsInArray(currentCard, availableCards)) availableCards.push(currentCard);
            shownCards.pop();
            if (totalCardsShown > 0) totalCardsShown--;
            currentCard = shownCards[shownCards.length - 1];
            const idx = availableCards.findIndex(c => c.word === currentCard.word);
            if (idx > -1) availableCards.splice(idx, 1);
            displayCard();
        });
    }
}

function nextCard() {
    animateCard('anim-l', () => selectRandomCard());
}

function animateCard(animClass, callback) {
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.add(animClass);
    setTimeout(() => {
        flashcard.classList.remove(animClass);
        flashcard.style.opacity = '1';
        flashcard.style.transform = '';
        callback();
    }, 350);
}

function markCard(status) {
    if (!currentCard) return;

    cardStatuses[currentCard.word] = status;
    sessionCardsStudied++;
    updateSessionDisplay();

    // Update badge and buttons immediately
    updateStatusBadge();
    updateMarkButtonHighlight();

    // Track daily progress
    const today = new Date().toISOString().split('T')[0];
    if (!progressHistory[today]) progressHistory[today] = { studied: 0, known: 0, unknown: 0, review: 0 };
    progressHistory[today].studied++;
    progressHistory[today][status]++;

    saveProgress();
    saveProgressHistory();
    updateStatistics();
    renderProgressHistory();

    if (currentQuizMode !== 'quiz') {
        setTimeout(() => nextCard(), 300);
    }
}

// --- Audio ---

function playAudio(event) {
    if (event) event.stopPropagation();
    if (!currentCard) return;
    const wordForLink = currentCard.word.replace(/^(der|die|das)\s+/i, '').trim();
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(wordForLink)}`;
    new Audio(url).play().catch(() => {});
}

function playAudioSilent() {
    if (!currentCard) return;
    const wordForLink = currentCard.word.replace(/^(der|die|das)\s+/i, '').trim();
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(wordForLink)}`;
    new Audio(url).play().catch(() => {});
}

// --- Progress ---

function updateProgress() {
    const el = document.getElementById('progressText');
    const elFs = document.getElementById('progressTextFs');
    const bar = document.getElementById('progressBar');
    if (!el) return;

    const total = cards.length;
    const avail = availableCards.length;
    let text;

    if (loadedPages.size >= totalPages) {
        text = `Card ${totalCardsShown} of ${total} (${avail} remaining)`;
    } else {
        text = `Card ${totalCardsShown} | ${total} loaded (${loadedPages.size}/${totalPages} pages)`;
    }

    el.textContent = text;
    if (elFs) elFs.textContent = text;

    // Progress bar: percentage of cards that have been marked
    if (bar && total > 0) {
        const marked = cards.filter(c => cardStatuses[c.word]).length;
        bar.value = Math.round((marked / total) * 100);
    }
}

function updateStatistics() {
    const total = cards.length;
    let known = 0, unknown = 0, review = 0;
    cards.forEach(card => {
        const s = cardStatuses[card.word];
        if (s === 'known') known++;
        else if (s === 'unknown') unknown++;
        else if (s === 'review') review++;
    });

    const progress = total > 0 ? Math.round(((known + review) / total) * 100) : 0;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statKnown').textContent = known;
    document.getElementById('statUnknown').textContent = unknown;
    document.getElementById('statReview').textContent = review;
    document.getElementById('statProgress').textContent = progress + '%';
}

function renderProgressHistory() {
    const chart = document.getElementById('historyChart');
    const startLabel = document.getElementById('historyStart');
    if (!chart) return;

    const days = 30;
    const today = new Date();
    const bars = [];
    let max = 0;

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const entry = progressHistory[key] || { studied: 0 };
        if (entry.studied > max) max = entry.studied;
        bars.push({ date: key, ...entry });
    }

    if (max === 0) {
        chart.innerHTML = '<div style="color:var(--text-tertiary);font-size:12px;text-align:center;width:100%">No activity yet</div>';
        startLabel.textContent = '';
        return;
    }

    chart.innerHTML = bars.map(b => {
        const h = Math.max(2, (b.studied / max) * 45);
        return `<div class="history-bar" style="height:${h}px" data-tip="${b.date}: ${b.studied||0} cards"></div>`;
    }).join('');
    startLabel.textContent = bars[0].date;
}

// --- UI Toggles ---

function toggleStats() {
    const body = document.getElementById('statsBody');
    const chevron = document.getElementById('statsChevron');
    body.classList.toggle('open');
    chevron.classList.toggle('open');
}

function toggleShortcuts() {
    document.getElementById('shortcutList').classList.toggle('open');
}

// --- Persistence ---

function saveProgress() {
    localStorage.setItem('flashcardProgress', JSON.stringify({
        cardStatuses, timestamp: new Date().toISOString()
    }));
}

function loadProgress() {
    const saved = localStorage.getItem('flashcardProgress');
    if (saved) {
        try { cardStatuses = JSON.parse(saved).cardStatuses || {}; }
        catch (e) {}
    }
}

function saveProgressHistory() {
    localStorage.setItem('flashcardHistory', JSON.stringify(progressHistory));
}

function loadProgressHistory() {
    const saved = localStorage.getItem('flashcardHistory');
    if (saved) {
        try { progressHistory = JSON.parse(saved); } catch (e) {}
    }
}

function exportProgress() {
    const data = {
        cardStatuses, progressHistory,
        timestamp: new Date().toISOString(),
        statistics: {
            known: Object.values(cardStatuses).filter(s => s === 'known').length,
            unknown: Object.values(cardStatuses).filter(s => s === 'unknown').length,
            review: Object.values(cardStatuses).filter(s => s === 'review').length
        }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcard-progress-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearProgress() {
    if (confirm('Clear all progress? This cannot be undone.')) {
        cardStatuses = {};
        progressHistory = {};
        localStorage.removeItem('flashcardProgress');
        localStorage.removeItem('flashcardHistory');
        updateStatistics();
        renderProgressHistory();
        if (currentCard) { updateStatusBadge(); updateMarkButtonHighlight(); }
    }
}

// --- Keyboard Shortcuts ---

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
            e.preventDefault(); previousCard();
        } else if (e.code === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
            e.preventDefault(); nextCard();
        } else if (e.code === 'Space') {
            e.preventDefault(); flipCard();
        } else if (e.key === '1') {
            markCard('known');
        } else if (e.key === '2') {
            markCard('unknown');
        } else if (e.key === '3') {
            markCard('review');
        } else if (e.key === 'a' || e.key === 'A') {
            playAudio(null);
        } else if (e.key === 'Escape') {
            exitFullscreen();
        }
    });
}

// --- Swipe Gestures (mobile) ---

let swipeGesturesSetup = false;
function setupSwipeGestures() {
    if (swipeGesturesSetup) return;
    const cardWrapper = document.getElementById('cardWrapper');
    if (!cardWrapper) { setTimeout(setupSwipeGestures, 100); return; }

    swipeGesturesSetup = true;
    let startX = 0, startY = 0, isDragging = false;
    const threshold = 60;

    const swipeLeftIndicator = document.getElementById('swipeLeft');
    const swipeRightIndicator = document.getElementById('swipeRight');

    cardWrapper.addEventListener('touchstart', function(e) {
        startX = e.changedTouches[0].screenX;
        startY = e.changedTouches[0].screenY;
        isDragging = true;
    }, { passive: true });

    cardWrapper.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        const dx = e.changedTouches[0].screenX - startX;
        const dy = e.changedTouches[0].screenY - startY;

        // Show swipe-to-mark indicators for horizontal swipes
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
            if (dx > 0) {
                swipeRightIndicator.classList.add('visible');
                swipeLeftIndicator.classList.remove('visible');
            } else {
                swipeLeftIndicator.classList.add('visible');
                swipeRightIndicator.classList.remove('visible');
            }
        } else {
            swipeLeftIndicator.classList.remove('visible');
            swipeRightIndicator.classList.remove('visible');
        }
    }, { passive: true });

    cardWrapper.addEventListener('touchend', function(e) {
        isDragging = false;
        swipeLeftIndicator.classList.remove('visible');
        swipeRightIndicator.classList.remove('visible');

        const dx = e.changedTouches[0].screenX - startX;
        const dy = e.changedTouches[0].screenY - startY;

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
            if (dx > 0) {
                // Swipe right = mark known + next
                markCard('known');
            } else {
                // Swipe left = mark unknown + next
                markCard('unknown');
            }
        } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > threshold) {
            if (dy > 0) {
                // Swipe down = next card (skip)
                nextCard();
            } else {
                // Swipe up = mark review + next
                markCard('review');
            }
        }
    }, { passive: true });
}
