// Flashcard application state
let cards = [];
let currentCardIndex = 0;
let cardStatuses = {}; // Track known/unknown/review status
let isFlipped = false;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    generatePageOptions();
    setupModeSelector();
    loadProgress();
    setupKeyboardShortcuts();
});

// Generate page options for dropdown
function generatePageOptions() {
    const pageSelect = document.getElementById('pageSelect');
    pageSelect.innerHTML = '<option value="">Select Page...</option>';
    for (let i = 1; i <= 25; i++) {
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
        
        initializeFlashcards();
    } catch (error) {
        console.error('Error loading CSV:', error);
        alert(`Error loading CSV file: ${error.message}`);
    }
}

// Load cards from all pages
async function loadCardsFromAllPages() {
    cards = [];
    
    for (let i = 1; i <= 25; i++) {
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
                })).filter(card => card.word.trim() !== '');
                
                cards = cards.concat(pageCards);
            }
        } catch (error) {
            console.error(`Error loading page ${i}:`, error);
        }
    }
    
    if (cards.length === 0) {
        alert('No cards found');
        return;
    }
    
    // Shuffle cards
    shuffleArray(cards);
    initializeFlashcards();
}

// Load custom words from textarea
function loadCustomWords() {
    const customInput = document.getElementById('customWordsInput').value.trim();
    if (!customInput) {
        alert('Please enter some words');
        return;
    }
    
    const words = customInput.split('\n').map(w => w.trim()).filter(w => w);
    
    // Load all cards and filter by custom words
    loadCardsFromAllPages().then(() => {
        cards = cards.filter(card => {
            const wordWithoutArticle = card.word.replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
            return words.some(w => 
                wordWithoutArticle === w.toLowerCase() || 
                card.word.toLowerCase().includes(w.toLowerCase())
            );
        });
        
        if (cards.length === 0) {
            alert('No matching words found');
            return;
        }
        
        initializeFlashcards();
    });
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
    
    currentCardIndex = 0;
    isFlipped = false;
    
    document.getElementById('flashcardArea').classList.remove('hidden');
    displayCard();
    updateProgress();
    updateStatistics();
}

// Display current card
function displayCard() {
    if (cards.length === 0 || currentCardIndex >= cards.length) return;
    
    const card = cards[currentCardIndex];
    const flashcard = document.getElementById('flashcard');
    
    // Reset flip state
    isFlipped = false;
    flashcard.classList.remove('flipped');
    
    // Update front side - remove article (der, die, das) from display
    const wordWithoutArticle = card.word.replace(/^(der|die|das)\s+/i, '').trim();
    document.getElementById('cardWord').textContent = wordWithoutArticle || card.word;
    
    // Update back side - show full word with article first
    document.getElementById('cardFullWord').textContent = card.word || '-';
    document.getElementById('cardPronunciation').textContent = card.pronunciation || '-';
    document.getElementById('cardBanglaMeaning').textContent = card.banglaMeaning || '-';
    document.getElementById('cardEnglishMeaning').textContent = card.englishMeaning || '-';
    document.getElementById('cardSentence').textContent = card.sentence || '-';
    
    // Store full word with article for reference (used in quick links and audio)
    card.fullWord = card.word; // Keep original word with article
    
    // Update quick links
    updateQuickLinks(card.word);
    
    // Update button states
    document.getElementById('prevBtn').disabled = currentCardIndex === 0;
    document.getElementById('nextBtn').disabled = currentCardIndex === cards.length - 1;
    
    updateProgress();
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

// Navigate to previous card
function previousCard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        displayCard();
    }
}

// Navigate to next card
function nextCard() {
    if (currentCardIndex < cards.length - 1) {
        currentCardIndex++;
        displayCard();
    }
}

// Mark card status
function markCard(status) {
    if (cards.length === 0) return;
    
    const card = cards[currentCardIndex];
    const cardKey = card.word;
    cardStatuses[cardKey] = status;
    
    saveProgress();
    updateStatistics();
    
    // Auto-advance to next card
    if (currentCardIndex < cards.length - 1) {
        setTimeout(() => {
            nextCard();
        }, 300);
    }
}

// Play audio
function playAudio(event) {
    event.stopPropagation(); // Prevent card flip
    
    if (cards.length === 0) return;
    
    const card = cards[currentCardIndex];
    const wordForLink = card.word.replace(/^(der|die|das)\s+/i, '').trim();
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
    progressText.textContent = `Card ${currentCardIndex + 1} of ${cards.length}`;
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
