const textInput = document.getElementById('textInput');
const wordList = document.getElementById('wordList');
const dictFrame = document.getElementById('dictFrame');
const translationContent = document.getElementById('translationContent');

// Function to extract words from text
function extractWords(text) {
    if (!text || text.trim() === '') {
        return [];
    }
    
    // Split by whitespace and filter out empty strings
    const words = text
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length > 0)
        .map(word => {
            // Remove punctuation from start and end of words, but preserve German special characters (Ö, Ä, Ü, ß, etc.)
            // This regex removes common punctuation but keeps Unicode letters
            return word.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '');
        })
        .filter(word => word.length > 0);
    
    // Remove duplicates and return unique words
    return [...new Set(words)];
}

// Function to render word list
function renderWordList(words) {
    wordList.innerHTML = '';
    
    if (words.length === 0) {
        wordList.innerHTML = '<div class="empty-state">Words will appear here after you type some text...</div>';
        return;
    }

    words.forEach(word => {
        const wordButton = document.createElement('button');
        wordButton.className = 'word-item';
        wordButton.textContent = word;
        wordButton.addEventListener('click', () => handleWordClick(word));
        wordList.appendChild(wordButton);
    });
}

// Function to fetch translation using free API and display in div
async function fetchAndDisplayTranslation(word) {
    // Show loading state
    translationContent.innerHTML = `
        <div class="translation-loading">Translating "${word}"...</div>
    `;

    try {
        // Using MyMemory Translation API (free, no API key required for limited use)
        const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=de|bn`
        );
        const data = await response.json();
        
        if (data.responseData && data.responseData.translatedText) {
            const translation = data.responseData.translatedText;
            const googleTranslateUrl = `https://translate.google.com/?sl=de&tl=bn&text=${encodeURIComponent(word)}&op=translate`;
            
            // Display the translation directly in the div
            translationContent.innerHTML = `
                <div class="translation-original">German: ${word}</div>
                <div class="translation-result">Bengali: ${translation}</div>
                <a href="${googleTranslateUrl}" target="_blank" class="translation-link">Open in Google Translate</a>
                <div class="translation-source">Translation provided by MyMemory Translation API</div>
            `;
        } else {
            throw new Error('No translation data received');
        }
    } catch (error) {
        console.error('Translation API error:', error);
        const googleTranslateUrl = `https://translate.google.com/?sl=de&tl=bn&text=${encodeURIComponent(word)}&op=translate`;
        // Show error with fallback link
        translationContent.innerHTML = `
            <div class="translation-loading">Unable to fetch translation.</div>
            <a href="${googleTranslateUrl}" target="_blank" class="translation-link">Open Google Translate</a>
        `;
    }
}

// Function to handle word click
async function handleWordClick(word) {
    // Encode word for URL
    const encodedWord = encodeURIComponent(word);
    
    // Update dict.cc iframe
    dictFrame.src = `https://www.dict.cc/?s=${encodedWord}`;
    
    // Fetch translation and display in iframe
    await fetchAndDisplayTranslation(word);
}

// Event listener for input changes
textInput.addEventListener('input', (e) => {
    const text = e.target.value;
    const words = extractWords(text);
    renderWordList(words);
});

// Function to load words from URL parameters
async function loadWordsFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const folder = urlParams.get('l'); // e.g., 'lws'
    const page = urlParams.get('p');   // e.g., '1'

    if (folder && page) {
        try {
            // Construct the file path
            const filePath = `${folder}/pages/${page}`;
            
            // Fetch the file content
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`File not found: ${filePath}`);
            }
            
            const text = await response.text();
            
            // Split by newlines, filter empty lines, and join with spaces
            const words = text
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            
            // Join words with spaces and put in textarea
            const wordsText = words.join(' ');
            textInput.value = wordsText;
            
            // Trigger input event to extract and display words
            const inputEvent = new Event('input', { bubbles: true });
            textInput.dispatchEvent(inputEvent);
            
        } catch (error) {
            console.error('Error loading words from URL:', error);
            // Show error message in textarea
            textInput.value = `Error: Could not load words from ${folder}/pages/${page}`;
        }
    }
}

        // Function to detect available page files and generate navigation links
        async function generateNavigationLinks() {
            const navBar = document.getElementById('navBar');
            const folder = 'lws'; // Default folder, could be made dynamic later
            const maxPages = 25; // Maximum number of pages to check
            
            // Try to fetch files and detect which ones exist
            const availablePages = [];
            
            // Check pages 1 to maxPages
            for (let i = 1; i <= maxPages; i++) {
                availablePages.push(i);
            }
            // Sort pages numerically
            availablePages.sort((a, b) => a - b);
            
            // Generate navigation links
            navBar.innerHTML = '';
            availablePages.forEach(pageNum => {
                const link = document.createElement('a');
                link.href = `?l=${folder}&p=${pageNum}`;
                link.className = 'nav-link';
                link.textContent = `${folder}-${pageNum}`;
                navBar.appendChild(link);
            });
            
            // If no pages found, show a message
            if (availablePages.length === 0) {
                navBar.innerHTML = '<div class="empty-state">No page files found</div>';
            }
        }

// Initialize with empty state
renderWordList([]);

// Generate navigation links
generateNavigationLinks();

// Load words from URL parameters if present
loadWordsFromUrl();
