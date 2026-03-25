# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server (localhost:3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

## Environment

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` with a Google Gemini API key.

## Architecture

**TEDMaster** is a Next.js AI-powered TED talk learning platform with a App Router structure.

### Data Flow

1. User submits a TED talk URL on the home page (`/src/app/page.tsx`)
2. `/api/parse` scrapes the TED page, extracts `__NEXT_DATA__` JSON, and returns video streams + bilingual subtitle sentences (English + translated language, time-aligned in milliseconds)
3. `/app/watch` renders the full learning interface
4. User interactions (word click, sentence analysis) call `/api/ai` with the Gemini 2.0 Flash API

### API Routes

- **`/api/parse`** — TED scraper: validates URLs, fetches HLS/MP4 streams, merges bilingual transcripts with timestamps
- **`/api/ai`** — Gemini-powered analysis with two actions:
  - `define`: word definition with IPA, POS, Chinese meaning, synonyms, phrases, examples
  - `analyze`: sentence grammar breakdown (S/V/O structure in Chinese)

### Key Components

- **`/app/watch/page.tsx`** — Core player (570+ lines): HLS.js video, dual-language subtitle sync, playback speed, audio recording for shadowing, vocabulary collection
- **`/components/VocabBook.tsx`** — Collected words sidebar with TXT export

### Styling

Glassmorphism dark theme using Tailwind CSS v4 + CSS custom properties defined in `globals.css`. Key tokens: `--ted-red: #E62B1E`, `--bg-deep: #0A0A0B`. Use `.glass-effect` and `.hover-glow` utility classes for consistent UI.

### Path Aliases

`@/*` maps to `./src/*`.
