# German Course

A web-based German language learning project with vocabulary lists, flashcards, and grammar notes. Content is aimed at learners who use **German, Bangla (Bengali), and English**.

## Overview

- **Home** (`index.html`) – Hub with links to Flashcards, Vocabulary, and Grammar.
- **Flashcards** (`flashcards.html` + `flashcards.js`) – Study words by page or all pages; optional “custom words” mode.
- **Vocabulary** (`vocabulary.html`) – Browse words in tables by page (1–38) with German, Bangla pronunciation/meaning, English meaning, and example sentences.
- **Grammar** – Markdown viewer (`markdown-viewer.html`) for `grammar/1.md` and other docs; extra notes in `other/*.md`.

Vocabulary data lives in **CSV files** under `lws/csv/` (one file per “page”), generated from or aligned with raw word lists in `lws/pages/`.

## Features

- **Flashcards**: Study by single page, all pages (lazy-loaded), or a custom word list; flip cards, progress, keyboard/swipe.
- **Vocabulary table**: Pick a page (1–38), see full CSV in a table with links to Google Translate, dict.cc, Wiktionary.
- **Grammar / notes**: View Markdown (e.g. pronunciation, grammar) in the browser.
- **Word data**: Each CSV row has German word, Bangla pronunciation, Bangla meaning, English meaning, and a German example sentence.

## Project Structure

```
german_course/
├── index.html              # Home: links to Flashcards, Vocabulary, Grammar
├── flashcards.html         # Flashcard UI
├── flashcards.js           # Flashcard logic, loads lws/csv/{n}.csv, totalPages = 38
├── vocabulary.html        # Vocabulary table, page selector 1–38
├── markdown-viewer.html    # Renders Markdown (e.g. grammar/1.md)
├── grammar.html            # (if present) Grammar entry
├── script.js               # Text extraction + MyMemory DE→BN translation (standalone)
├── styles.css              # Shared styles
├── grammar/
│   └── 1.md                # Grammar / pronunciation Markdown
├── other/                  # Extra Markdown notes (alphabet, pronouns, verbs, etc.)
├── lws/
│   ├── pages/              # Raw word lists (one file per page: 1, 2, … 40)
│   │   ├── 1, 2, … 38, 39, 40
│   └── csv/                # Vocabulary CSVs used by app (1–38, no 26)
│       ├── 1.csv … 25.csv, 27.csv … 38.csv
└── README.md
```

## Vocabulary Data (CSV)

- **Location**: `lws/csv/{page}.csv` (e.g. `lws/csv/33.csv`).
- **Columns** (header in first row):
  - `German Word`
  - `Bangla Pronunciation` (phonetic Bengali script)
  - `Bangla Meaning` (Bengali translation)
  - `English Meaning`
  - `German sentence` (example sentence)

CSVs are UTF-8. The app supports pages **1–38**; `flashcards.js` uses `totalPages = 38`, and the vocabulary page dropdown is 1–38.

## Raw Word Lists (`lws/pages/`)

- Numbered files without extension (e.g. `1`, `33`).
- One vocabulary item per line (or split across lines with continuation, e.g. verb + conjugation).
- Used as the source when generating or updating CSVs; the app itself reads only `lws/csv/*.csv`.

## How to Run

- Open `index.html` in a browser (or serve the folder with any static server).
- No build step; no backend required.

## Adding or Updating Vocabulary

1. **Raw list**: Edit or add a file under `lws/pages/` (e.g. `39`).
2. **CSV**: Add or update `lws/csv/{n}.csv` with the five columns above.
3. **App**: If you add pages beyond 38, update:
   - `flashcards.js`: `totalPages` and the loop in `generatePageOptions()`
   - `vocabulary.html`: the loop that builds the page dropdown (e.g. `1..38` → new max).

## Technologies

- HTML5, CSS3, vanilla JavaScript.
- External: dict.cc (iframe), Google Translate (links), MyMemory API (in `script.js` for DE→BN).
- Markdown: rendered in-browser (e.g. marked.js in markdown-viewer).

## License

Open source for educational use.
