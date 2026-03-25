# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server at localhost:3000
npm run build     # Production build (outputs standalone bundle)
npm run start     # Start production server
npm run lint      # ESLint
```

## Environment

Copy `.env.example` → `.env.local` and set:
```
GEMINI_API_KEY=your_key_here
```

## Deployment (VPS / Docker)

```bash
# Build and run
docker compose up -d --build

# View logs
docker compose logs -f

# Update (pull new code, rebuild)
git pull && docker compose up -d --build
```

Requires `.env.local` (or pass `GEMINI_API_KEY` via environment) on the VPS before running.

Nginx reverse-proxy example (if using Nginx in front of port 3000):
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Architecture

**TEDMaster** is an AI-powered TED talk English learning platform built on Next.js App Router.

### Data Flow

1. User submits a TED URL on `/` → calls `/api/parse`
2. `/api/parse` scrapes TED's `__NEXT_DATA__` JSON, extracts video streams + bilingual subtitles
3. `/watch` renders the player with transcript
4. Word click / sentence analysis → `/api/ai` (Gemini 2.0 Flash)

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/parse` | POST | Scrape TED page; returns title, presenter, `videoUrl`, `isHls`, `downloadUrl`, `transcript[]` |
| `/api/ai` | POST | Gemini API; action `define` → word data, action `analyze` → sentence breakdown |

**`/api/parse` extraction strategy:**
1. Try known paths in `__NEXT_DATA__` (`playerData.resources`, `acmePlayerData.resources`)
2. Fallback: regex scan entire JSON for `.m3u8` / `.mp4` URLs
3. Prefer MP4 over HLS (`isHls: false` when MP4 available) to avoid browser CORS issues

### Key Files

| File | Role |
|------|------|
| `src/lib/i18n.tsx` | `AppProvider` — global theme (dark/light) + language (en/zh/zh-tw/ja) state with localStorage persistence |
| `src/app/page.tsx` | Home page: URL input, feature cards, GitHub/theme/lang controls |
| `src/app/watch/page.tsx` | Player: HLS/MP4 video, RAF subtitle sync, word-click AI lookup, sentence analysis, shadowing recorder, SRT/PDF export |
| `src/components/VocabBook.tsx` | Vocabulary sidebar: sorted word list, TTS playback, TXT export |
| `src/app/api/parse/route.ts` | TED scraper with Zod URL validation and multi-path extraction |
| `src/app/api/ai/route.ts` | Gemini proxy for word definitions and grammar analysis |

### Theming

CSS custom properties on `[data-theme]` attribute (set by `AppProvider` on `<html>`):
- `--bg`, `--bg-2`, `--bg-3` — background levels
- `--text`, `--text-2`, `--text-3` — text hierarchy
- `--border`, `--accent`, `--accent-s` — borders and TED red accent

All themed components use `style={{ color: "var(--text)" }}` inline styles rather than Tailwind classes for theme-switching without page reload.

### Path Aliases

`@/*` → `./src/*`
