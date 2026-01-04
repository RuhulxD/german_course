# German Course - Word Dictionary & Translator

A web-based German language learning tool that helps you extract, look up, and translate German words from text. Perfect for students learning German who want quick access to dictionary definitions and translations.

## Features

- **Text Input & Word Extraction**: Paste or type German text and automatically extract all unique words
- **Interactive Word Buttons**: Click on any extracted word to look it up
- **Dictionary Integration**: Integrated with [dict.cc](https://www.dict.cc/) for German-English dictionary lookups displayed in an embedded iframe
- **Translation Support**: Quick access to Google Translate for German → Bengali translations
- **Word Lists**: Pre-configured word lists stored in `lws/pages/` directory for structured learning

## Usage

1. **Open the Application**
   - Simply open `index.html` in your web browser
   - No server or installation required

2. **Extract Words**
   - Type or paste German text into the text area
   - Words are automatically extracted and displayed as clickable buttons below

3. **Look Up Words**
   - Click any word button to:
     - View the word's definition in the dict.cc dictionary (displayed in the iframe below)
     - Enable the Google Translate button for German → Bengali translation

4. **Translate Words**
   - After clicking a word, click the "Translate" button to open Google Translate in a new tab
   - The translation will be set to German → Bengali

## Project Structure

```
german_course/
├── index.html          # Main application file
├── lws/
│   └── pages/         # Word list files
│       ├── 1          # Word list 1
│       └── 2          # Word list 2
└── README.md          # This file
```

### Word Lists (`lws/pages/`)

The `lws/pages/` directory contains numbered files with German word lists. Each file contains one word per line, making it easy to manage and organize vocabulary for different lessons or topics.

## Technologies Used

- **HTML5**: Structure and semantic markup
- **CSS3**: Styling and responsive design
- **JavaScript (Vanilla)**: Word extraction, DOM manipulation, and event handling
- **External APIs**:
  - [dict.cc](https://www.dict.cc/): German-English dictionary
  - [Google Translate](https://translate.google.com/): Translation service

## How It Works

1. **Word Extraction**: The application splits input text by whitespace, removes punctuation, and filters out duplicates to create a list of unique words
2. **Word Display**: Extracted words are displayed as clickable buttons in a responsive grid layout
3. **Dictionary Lookup**: Clicking a word updates the dict.cc iframe URL to search for that specific word
4. **Translation**: The Google Translate button opens a new tab with the selected word pre-filled for translation

## Browser Compatibility

This application works in all modern web browsers that support:
- ES6 JavaScript features
- Iframe embedding
- CSS Grid/Flexbox

## Future Enhancements

Potential improvements could include:
- Support for multiple translation languages
- Word list import/export functionality
- History of looked-up words
- Pronunciation audio integration
- Custom word list creation interface

## License

This project is open source and available for educational purposes.
