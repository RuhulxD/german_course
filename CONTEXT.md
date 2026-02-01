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

- **Flashcards**: `flashcards.js` → `fetch('lws/csv/${pageNum}.csv')` → parse CSV → build cards (word, pronunciation, banglaMeaning, englishMeaning, sentence).
- **Vocabulary**: Inline script in `vocabulary.html` → `fetch('lws/csv/${pageNumber}.csv')` → parse CSV → render table with optional links (Google Translate, dict.cc, Wiktionary).
- **Page range**: 1–38. Set in:
  - `flashcards.js`: `totalPages = 38` and `generatePageOptions()` loop (`1..totalPages`).
  - `vocabulary.html`: `generatePageOptions()` loop (`1..38`).

## CSV Format (`lws/csv/*.csv`)

- Header: `German Word,Bangla Pronunciation,Bangla Meaning,English Meaning,German sentence`
- UTF-8; one row per vocabulary item.
- Used by both Flashcards and Vocabulary. Adding a new page (e.g. 39) requires new CSV and bumping the page range in both places.

## Source of Truth for Words

- **Raw lists**: `lws/pages/` – numbered files (1, 2, … 40), one word/phrase per line (sometimes multi-line, e.g. verb + conjugation).
- **App data**: `lws/csv/` – only CSVs are read by the app. To “add new files” or new pages, add/update CSVs and then update `totalPages` / vocabulary dropdown max (e.g. 38 → 39).

## Key Conventions

- **Bangla Pronunciation**: Phonetic Bengali script for the German word.
- **Bangla Meaning**: Bengali translation.
- **German sentence**: Short example sentence using the word.
- CSV filenames: `{page}.csv`; not every page number in `lws/pages/` has a CSV (e.g. no `26.csv` in typical setup). App supports 1–38.

## When Adding or Editing Content

1. New vocabulary page: add `lws/pages/N` (raw list) and `lws/csv/N.csv` (five columns). Then set `totalPages` and vocabulary loop to include N (e.g. 39).
2. Regenerating CSVs from pages: parse `lws/pages/N`, merge continuation lines, normalize “German Word”, then fill Bangla Pronunciation, Bangla Meaning, English Meaning, German sentence (e.g. from prior session’s “generate all fields” flow).
3. Flashcards vs Vocabulary: both read the same CSVs; no separate config.

## Files to Touch for “new pages” / “include new files”

- **flashcards.js**: `totalPages = 38` → new max; `for (let i = 1; i <= totalPages; i++)` in `generatePageOptions()`.
- **vocabulary.html**: `for (let i = 1; i <= 38; i++)` (and comment “1–38”) → new max.

## Other Paths

- **grammar/** – Markdown (e.g. `1.md`) linked from home / markdown-viewer.
- **other/** – Extra Markdown (alphabet, pronunciation, pronouns, verb conjugation, etc.).
- **styles.css** – Shared across HTML pages.
