// Flashcard application state
let cards = []; // All loaded cards
let availableCards = []; // Cards available for random selection
let shownCards = []; // Track recently shown cards to avoid immediate repeats
let totalCardsShown = 0; // Total count of cards shown (for progress display)
let currentCard = null; // Current card object
let cardStatuses = {}; // Track known/unknown/review status
let isFlipped = false;
let loadedPages = new Set(); // Track which pages have been loaded
let totalPages = 42; // Total number of pages available
let isLoadingMore = false; // Prevent concurrent loading
let isSelectingCard = false; // Prevent concurrent card selection

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    generatePageOptions();
    setupModeSelector();
    loadProgress();
    setupKeyboardShortcuts();
    setupSwipeGestures();
});

// Generate page options for dropdown
function generatePageOptions() {
    const pageSelect = document.getElementById('pageSelect');
    pageSelect.innerHTML = '<option value="">Select Page...</option>';
    for (let i = 1; i <= totalPages; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Page ${i} (lws-${i})`;
        pageSelect.appendChild(option);
    }
}

// Setup mode selector to show/hide custom input
function setupModeSelector() {
    const studyMode = document.getElementById('studyMode');
    const customInputSection = document.getElementById('customInputSection');
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
}

// Parse CSV text into array of objects
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV with commas inside quoted fields
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] || '';
            });
            data.push(row);
        }
    }

    return data;
}

// Load cards based on selected mode
async function loadCards() {
    const studyMode = document.getElementById('studyMode').value;
    
    if (studyMode === 'page') {
        const pageNum = document.getElementById('pageSelect').value;
        if (!pageNum) {
            alert('Please select a page');
            return;
        }
        await loadCardsFromPage(pageNum);
    } else if (studyMode === 'all') {
        await loadCardsFromAllPages();
    } else if (studyMode === 'custom') {
        loadCustomWords();
    }
}

// Load cards from a specific page
async function loadCardsFromPage(pageNum) {
    try {
        const response = await fetch(`lws/csv/${pageNum}.csv`);
        if (!response.ok) {
            throw new Error(`File not found: lws/csv/${pageNum}.csv`);
        }
        const csvText = await response.text();
        const data = parseCSV(csvText);
        
        if (data.length === 0) {
            alert('No data found in CSV file');
            return;
        }
        
        cards = data.map(row => ({
            word: row['German Word'] || '',
            pronunciation: row['Bangla Pronunciation'] || '',
            banglaMeaning: row['Bangla Meaning'] || '',
            englishMeaning: row['English Meaning'] || '',
            sentence: row['German sentence'] || ''
        })).filter(card => card.word.trim() !== '');
        
        // For single page mode, use all cards as available
        availableCards = [...cards];
        shuffleArray(availableCards);
        shownCards = [];
        currentCard = null;
        loadedPages.clear();
        loadedPages.add(parseInt(pageNum));
        
        initializeFlashcards();
    } catch (error) {
        console.error('Error loading CSV:', error);
        alert(`Error loading CSV file: ${error.message}`);
    }
}

// Load cards from all pages (lazy loading: 2 pages at a time)
async function loadCardsFromAllPages() {
    cards = [];
    availableCards = [];
    shownCards = [];
    totalCardsShown = 0; // Reset counter
    loadedPages.clear();
    currentCard = null;
    
    // Load first 2 pages
    await loadNextPages(2);
    
    if (cards.length === 0) {
        alert('No cards found');
        return;
    }
    
    initializeFlashcards();
}

// Load next N pages (default 2)
async function loadNextPages(count = 2) {
    if (isLoadingMore) return;
    
    isLoadingMore = true;
    const pagesToLoad = [];
    
    // Find next pages to load
    for (let i = 1; i <= totalPages && pagesToLoad.length < count; i++) {
        if (!loadedPages.has(i)) {
            pagesToLoad.push(i);
        }
    }
    
    if (pagesToLoad.length === 0) {
        isLoadingMore = false;
        updateProgress();
        return; // All pages loaded
    }
    
    console.log(`Loading pages: ${pagesToLoad.join(', ')}`);
    
    // Load pages in parallel
    const loadPromises = pagesToLoad.map(async (pageNum) => {
        try {
            const response = await fetch(`lws/csv/${pageNum}.csv`);
            if (response.ok) {
                const csvText = await response.text();
                const data = parseCSV(csvText);
                
                const pageCards = data.map(row => ({
                    word: row['German Word'] || '',
                    pronunciation: row['Bangla Pronunciation'] || '',
                    banglaMeaning: row['Bangla Meaning'] || '',
                    englishMeaning: row['English Meaning'] || '',
                    sentence: row['German sentence'] || ''
                })).filter(card => card.word.trim() !== '');
                
                loadedPages.add(pageNum);
                console.log(`Loaded page ${pageNum}: ${pageCards.length} cards`);
                return pageCards;
            }
        } catch (error) {
            console.error(`Error loading page ${pageNum}:`, error);
        }
        return [];
    });
    
    const results = await Promise.all(loadPromises);
    const newCards = results.flat();
    
    // Add new cards to the pool
    cards = cards.concat(newCards);
    availableCards = availableCards.concat(newCards);
    
    // Shuffle available cards
    shuffleArray(availableCards);
    
    console.log(`Total cards now: ${cards.length}, Available: ${availableCards.length}, Pages loaded: ${loadedPages.size}`);
    
    isLoadingMore = false;
    updateProgress();
    updateStatistics();
}

// Load custom words from textarea
async function loadCustomWords() {
    const customInput = document.getElementById('customWordsInput').value.trim();
    if (!customInput) {
        alert('Please enter some words');
        return;
    }
    
    const words = customInput.split('\n').map(w => w.trim()).filter(w => w);
    
    // Load all cards first (lazy loading)
    cards = [];
    availableCards = [];
    shownCards = [];
    loadedPages.clear();
    currentCard = null;
    
    // Load all pages for custom words mode
    for (let i = 1; i <= totalPages; i++) {
        try {
            const response = await fetch(`lws/csv/${i}.csv`);
            if (response.ok) {
                const csvText = await response.text();
                const data = parseCSV(csvText);
                
                const pageCards = data.map(row => ({
                    word: row['German Word'] || '',
                    pronunciation: row['Bangla Pronunciation'] || '',
                    banglaMeaning: row['Bangla Meaning'] || '',
                    englishMeaning: row['English Meaning'] || '',
                    sentence: row['German sentence'] || ''
                })).filter(card => {
                    const wordWithoutArticle = card.word.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
                    return card.word.trim() !== '' && words.some(w => 
                        wordWithoutArticle === w.toLowerCase() || 
                        card.word.toLowerCase().includes(w.toLowerCase())
                    );
                });
                
                cards = cards.concat(pageCards);
                loadedPages.add(i);
            }
        } catch (error) {
            console.error(`Error loading page ${i}:`, error);
        }
    }
    
    if (cards.length === 0) {
        alert('No matching words found');
        return;
    }
    
    // Use filtered cards as available
    availableCards = [...cards];
    shuffleArray(availableCards);
    
    initializeFlashcards();
}

// Shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Initialize flashcards display
function initializeFlashcards() {
    if (cards.length === 0) return;
    
    isFlipped = false;
    shownCards = [];
    totalCardsShown = 0; // Reset total shown counter
    
    document.getElementById('flashcardArea').classList.remove('hidden');
    
    // Setup swipe gestures now that flashcard area is visible
    setupSwipeGestures();
    
    selectRandomCard();
    updateProgress();
    updateStatistics();
}

// Helper function to check if a card is already in the array (by word)
function cardExistsInArray(card, array) {
    return array.some(c => c.word === card.word);
}

// Select a random card from available cards
function selectRandomCard() {
    // Prevent concurrent calls
    if (isSelectingCard) {
        console.log('Card selection already in progress, skipping...');
        return;
    }
    
    isSelectingCard = true;
    
    try {
        // Check if we need to load more pages BEFORE selecting (if less than 20 cards remaining)
        // This ensures we load proactively before running out
        if (availableCards.length < 20 && loadedPages.size < totalPages && !isLoadingMore) {
            loadNextPages(2);
        }
        
        if (availableCards.length === 0) {
            // Try to load more pages if available
            if (loadedPages.size < totalPages && !isLoadingMore) {
                loadNextPages(2).then(() => {
                    if (availableCards.length > 0) {
                        isSelectingCard = false; // Reset before recursive call
                        selectRandomCard();
                    } else {
        // All pages loaded, recycle shown cards
        if (shownCards.length > 0) {
            availableCards = [...shownCards];
            shuffleArray(availableCards);
            shownCards = [];
            // Don't reset totalCardsShown - keep counting total shown
            isSelectingCard = false; // Reset before recursive call
            selectRandomCard();
        } else {
            isSelectingCard = false;
        }
                    }
                }).catch(error => {
                    console.error('Error loading next pages:', error);
                    isSelectingCard = false;
                });
            } else if (shownCards.length > 0) {
                // All pages loaded, recycle shown cards
                availableCards = [...shownCards];
                shuffleArray(availableCards);
                shownCards = [];
                // Don't reset totalCardsShown - keep counting total shown
                isSelectingCard = false; // Reset before recursive call
                selectRandomCard();
            } else {
                console.error('No cards available and no shown cards to recycle');
                isSelectingCard = false;
            }
            return;
        }
        
        // Select random card from available
        if (availableCards.length === 0) {
            console.error('Available cards is empty after processing');
            isSelectingCard = false;
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * availableCards.length);
        currentCard = availableCards[randomIndex];
        
        if (!currentCard) {
            console.error('Failed to select a card');
            isSelectingCard = false;
            return;
        }
        
        // Move selected card from available to shown list
        availableCards.splice(randomIndex, 1);
        shownCards.push(currentCard);
        totalCardsShown++; // Increment total shown counter
        
        // Remove cards that were recently shown (keep last 6. Ja-Nein Fragen.md to avoid immediate repeats)
        // Only recycle back to availableCards when we have very few cards left
        if (shownCards.length > 6) {
            const removed = shownCards.shift();
            // Only add back to availableCards if we're running low (less than 10 cards)
            // This prevents constant recycling and ensures cards are actually "used up"
            if (availableCards.length < 10 && loadedPages.size >= totalPages) {
                // Only recycle when all pages are loaded and we're running low
                if (!cardExistsInArray(removed, availableCards)) {
                    availableCards.push(removed);
                }
            }
        }
        
        console.log(`Selected card: ${currentCard.word}, Available: ${availableCards.length}, Shown: ${totalCardsShown} (recent: ${shownCards.length})`);
        
        displayCard();
        isSelectingCard = false;
    } catch (error) {
        console.error('Error in selectRandomCard:', error, error.stack);
        isSelectingCard = false;
        // Try to recover by selecting from available cards if any
        if (availableCards.length > 0) {
            try {
                const randomIndex = Math.floor(Math.random() * availableCards.length);
                currentCard = availableCards[randomIndex];
                availableCards.splice(randomIndex, 1);
                if (currentCard) {
                    shownCards.push(currentCard);
                    displayCard();
                }
            } catch (recoveryError) {
                console.error('Error in recovery:', recoveryError);
            }
        }
    }
}

// Display current card
function displayCard() {
    try {
        if (!currentCard) {
            console.error('displayCard called but currentCard is null');
            return;
        }
        
        const flashcard = document.getElementById('flashcard');
        if (!flashcard) {
            console.error('Flashcard element not found');
            return;
        }
    
    // Reset flip state
    isFlipped = false;
    flashcard.classList.remove('flipped');
    
    // Update front side - remove article (der, die, das) from display
    const wordWithoutArticle = currentCard.word.replace(/^(der|die|das)\s+/i, '').trim();
    const cardWordEl = document.getElementById('cardWord');
    if (cardWordEl) {
        cardWordEl.textContent = wordWithoutArticle || currentCard.word;
    }
    
    // Update back side - show full word with article first
    const cardFullWordEl = document.getElementById('cardFullWord');
    if (cardFullWordEl) cardFullWordEl.textContent = currentCard.word || '-';
    
    const cardPronunciationEl = document.getElementById('cardPronunciation');
    if (cardPronunciationEl) cardPronunciationEl.textContent = currentCard.pronunciation || '-';
    
    const cardBanglaMeaningEl = document.getElementById('cardBanglaMeaning');
    if (cardBanglaMeaningEl) cardBanglaMeaningEl.textContent = currentCard.banglaMeaning || '-';
    
    const cardEnglishMeaningEl = document.getElementById('cardEnglishMeaning');
    if (cardEnglishMeaningEl) cardEnglishMeaningEl.textContent = currentCard.englishMeaning || '-';
    
    const cardSentenceEl = document.getElementById('cardSentence');
    if (cardSentenceEl) cardSentenceEl.textContent = currentCard.sentence || '-';
    
    // Update quick links
    updateQuickLinks(currentCard.word);
    
    // Update button states (always enabled for random selection)
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = false;
    
        // Update progress immediately
        updateProgress();
    } catch (error) {
        console.error('Error in displayCard:', error, error.stack);
    }
}

// Update quick links
function updateQuickLinks(word) {
    const wordForLink = word.replace(/^(der|die|das)\s+/i, '').trim();
    const encodedWord = encodeURIComponent(wordForLink);
    
    const quickLinks = document.getElementById('quickLinks');
    quickLinks.innerHTML = `
        <button class="audio-btn" onclick="playAudio(event)">🔊 Play Audio</button>
        <a href="https://www.dict.cc/?s=${encodedWord}" target="_blank" class="quick-link link-dict">📖 Dict.cc</a>
        <a href="https://en.wiktionary.org/wiki/${encodedWord}#German" target="_blank" class="quick-link link-wiki">📚 Wiktionary</a>
    `;
}

// Flip card
function flipCard() {
    const flashcard = document.getElementById('flashcard');
    isFlipped = !isFlipped;
    flashcard.classList.toggle('flipped');
}

// Navigate to previous card (go back in shown cards history)
function previousCard() {
    try {
        if (shownCards.length > 1) {
            // Put current card back to available
            if (currentCard && !cardExistsInArray(currentCard, availableCards)) {
                availableCards.push(currentCard);
            }
            
            // Remove last shown card and make it current
            shownCards.pop();
            if (totalCardsShown > 0) {
                totalCardsShown--; // Decrement when going back
            }
            currentCard = shownCards[shownCards.length - 1];
            
            // Remove from available if it's there (check by word)
            const index = availableCards.findIndex(c => c.word === currentCard.word);
            if (index > -1) {
                availableCards.splice(index, 1);
            }
            
            displayCard();
        }
    } catch (error) {
        console.error('Error in previousCard:', error);
    }
}

// Navigate to next card (select random)
function nextCard() {
    try {
        selectRandomCard();
    } catch (error) {
        console.error('Error in nextCard:', error);
        alert('Error loading next card. Please try again.');
    }
}

// Mark card status
function markCard(status) {
    if (!currentCard) return;
    
    const cardKey = currentCard.word;
    cardStatuses[cardKey] = status;
    
    saveProgress();
    updateStatistics();
    
    // Auto-advance to next card
    setTimeout(() => {
        nextCard();
    }, 300);
}

// Play audio
function playAudio(event) {
    event.stopPropagation(); // Prevent card flip
    
    if (!currentCard) return;
    
    const wordForLink = currentCard.word.replace(/^(der|die|das)\s+/i, '').trim();
    const encodedWord = encodeURIComponent(wordForLink);
    
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodedWord}`;
    
    const audio = new Audio(audioUrl);
    audio.play().catch(error => {
        console.error('Error playing audio:', error);
        alert('Could not play audio. Please check your internet connection.');
    });
}

// Update progress display
function updateProgress() {
    const progressText = document.getElementById('progressText');
    if (!progressText) return;
    
    const totalLoaded = cards.length;
    const shownCount = totalCardsShown; // Use total shown counter instead of array length
    const availableCount = availableCards.length;
    
    if (loadedPages.size >= totalPages) {
        progressText.textContent = `Card ${shownCount} of ${totalLoaded} (All pages loaded, ${availableCount} remaining)`;
    } else {
        progressText.textContent = `Card ${shownCount} | Loaded: ${totalLoaded} cards (${loadedPages.size}/${totalPages} pages, ${availableCount} available)`;
    }
}

// Update statistics
function updateStatistics() {
    const total = cards.length;
    let known = 0;
    let unknown = 0;
    let review = 0;
    
    cards.forEach(card => {
        const status = cardStatuses[card.word];
        if (status === 'known') known++;
        else if (status === 'unknown') unknown++;
        else if (status === 'review') review++;
    });
    
    const progress = total > 0 ? Math.round(((known + review) / total) * 100) : 0;
    
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statKnown').textContent = known;
    document.getElementById('statUnknown').textContent = unknown;
    document.getElementById('statReview').textContent = review;
    document.getElementById('statProgress').textContent = progress + '%';
}

// Save progress to localStorage
function saveProgress() {
    const progressData = {
        cardStatuses: cardStatuses,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('flashcardProgress', JSON.stringify(progressData));
}

// Load progress from localStorage
function loadProgress() {
    const saved = localStorage.getItem('flashcardProgress');
    if (saved) {
        try {
            const progressData = JSON.parse(saved);
            cardStatuses = progressData.cardStatuses || {};
        } catch (error) {
            console.error('Error loading progress:', error);
        }
    }
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(event) {
        // Don't trigger shortcuts when typing in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Previous card: Left Arrow or 'p'
        if (event.code === 'ArrowLeft' || event.key === 'p' || event.key === 'P') {
            event.preventDefault();
            previousCard();
        } 
        // Next card: Right Arrow or 'n'
        else if (event.code === 'ArrowRight' || event.key === 'n' || event.key === 'N') {
            event.preventDefault();
            nextCard();
        } 
        // Flip card: Space
        else if (event.code === 'Space') {
            event.preventDefault();
            flipCard();
        }
    });
}

// Setup swipe gestures for mobile
let swipeGesturesSetup = false;
function setupSwipeGestures() {
    if (swipeGesturesSetup) return; // Already set up
    
    // Use event delegation on the card wrapper since flashcard might not exist yet
    const cardWrapper = document.querySelector('.card-wrapper');
    if (!cardWrapper) {
        // Retry after a short delay if element doesn't exist yet
        setTimeout(setupSwipeGestures, 100);
        return;
    }
    
    swipeGesturesSetup = true;
    
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = 50; // Minimum distance for a swipe
    
    cardWrapper.addEventListener('touchstart', function(event) {
        touchStartX = event.changedTouches[0].screenX;
        touchStartY = event.changedTouches[0].screenY;
    }, { passive: true });
    
    cardWrapper.addEventListener('touchend', function(event) {
        touchEndX = event.changedTouches[0].screenX;
        touchEndY = event.changedTouches[0].screenY;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // Check if it's a horizontal swipe (not vertical scroll)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                // Swipe right - previous card
                previousCard();
            } else {
                // Swipe left - next card
                nextCard();
            }
        }
    }, { passive: true });
}

// Export progress as JSON
function exportProgress() {
    const progressData = {
        cardStatuses: cardStatuses,
        timestamp: new Date().toISOString(),
        totalCards: cards.length,
        statistics: {
            known: Object.values(cardStatuses).filter(s => s === 'known').length,
            unknown: Object.values(cardStatuses).filter(s => s === 'unknown').length,
            review: Object.values(cardStatuses).filter(s => s === 'review').length
        }
    };
    
    const jsonString = JSON.stringify(progressData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcard-progress-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Progress exported successfully!');
}

// Clear progress
function clearProgress() {
    if (confirm('Are you sure you want to clear all progress? This cannot be undone.')) {
        cardStatuses = {};
        localStorage.removeItem('flashcardProgress');
        updateStatistics();
        alert('Progress cleared successfully!');
    }
}
