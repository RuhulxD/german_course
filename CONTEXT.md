# German Course – Project Context (for AI / future sessions)

## Purpose

Static German learning site: flashcards and vocabulary tables driven by CSV files, plus grammar/notes as Markdown. Target languages: German, Bangla (Bengali), English.

## Entry Points

- **index.html** – Home; links to Flashcards, Vocabulary, and Grammar (markdown-viewer).
- **flashcards.html** – Uses `flashcards.js`; loads cards from `lws/csv/{n}.csv`.
- **vocabulary.html** – Page dropdown 1–38; fetches `lws/csv/{page}.csv` and renders a table.
- **markdown-viewer.html** – Query param `?file=...` (e.g. `grammar/1.md`) to render Markdown.
- **script.js** – Word extraction + MyMemory DE→BN translation; not currently included by any HTML file (standalone/legacy).

## Data Flow

- **Flashcards**: `flashcards.js` → `fetch('lws/csv/${bookFolder}/${page}.csv')` → parse CSV → build cards (word, pronunciation, banglaMeaning, englishMeaning, sentence).
- **Vocabulary**: Inline script in `vocabulary.html` → `fetch('lws/csv/${bookFolder}/${page}.csv')` → parse CSV → render table with optional links (Google Translate, dict.cc, Wiktionary).
- **Book/page config**: Defined as a `books` array in both `flashcards.js` and `vocabulary.html`. Each book has a `folder` name and `pages` array. Adding a new book or pages requires updating this config in both files.

## CSV Format (`lws/csv/{book}/*.csv`)

- Header: `German Word,Bangla Pronunciation,Bangla Meaning,English Meaning,German sentence`
- UTF-8; one row per vocabulary item.
- Used by both Flashcards and Vocabulary. Adding a new page requires a new CSV in the appropriate book folder and updating the `books` config in both `flashcards.js` and `vocabulary.html`.

## Source of Truth for Words

- **Raw lists**: `lws/pages/{book}/` – numbered files (e.g. `book-1/1`, `book-3/5`), one word/phrase per line (sometimes multi-line, e.g. verb + conjugation).
- **App data**: `lws/csv/{book}/` – only CSVs are read by the app. To add new pages, add CSVs in the book folder and update the `books` config in both `flashcards.js` and `vocabulary.html`.

## Key Conventions

- **Bangla Pronunciation**: Phonetic Bengali script for the German word.
- **Bangla Meaning**: Bengali translation.
- **German sentence**: Short example sentence using the word.
- CSV filenames: `{page}.csv` inside book folders; not every page number may have a CSV (e.g. no `26.csv` in book-1).

## When Adding or Editing Content

1. New vocabulary page: add `lws/pages/{book}/N` (raw list) and `lws/csv/{book}/N.csv` (five columns). Then update the `books` array in both `flashcards.js` and `vocabulary.html`.
2. Regenerating CSVs from pages: parse `lws/pages/{book}/N`, merge continuation lines, normalize “German Word”, then fill Bangla Pronunciation, Bangla Meaning, English Meaning, German sentence.
3. Flashcards vs Vocabulary: both read the same CSVs and share the same `books` config structure.

## Files to Touch for “new pages” / “include new files”

- **flashcards.js**: Update the `books` array at the top of the file (add new book or extend pages array).
- **vocabulary.html**: Update the `books` array in the inline script (must match `flashcards.js`).

## Other Paths

- **grammar/** – Markdown (e.g. `1.md`) linked from home / markdown-viewer.
- **other/** – Extra Markdown (alphabet, pronunciation, pronouns, verb conjugation, etc.).
- **styles.css** – Shared across HTML pages.
