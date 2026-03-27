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

Copy `.env.example` → `.env.local` and fill in all values:

```
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=a_long_random_secret_string
DATABASE_URL=postgresql://tedmaster:yourpassword@localhost:5432/tedmaster?connection_limit=10&pool_timeout=30
POSTGRES_PASSWORD=yourpassword   # only needed for docker-compose
```

> For local dev without Docker, run a local Postgres instance and set `DATABASE_URL` accordingly.
> After changing `DATABASE_URL`, run `npx prisma migrate dev` to apply schema.

## Deployment (VPS / Docker)

See `DEPLOY.md` for the full step-by-step VPS deployment guide.

Quick reference:
```bash
# First deploy (or after schema changes)
docker compose run --rm migrate

# Start / restart app
docker compose up -d --build tedmaster

# View logs
docker compose logs -f tedmaster

# Update (pull new code, rebuild, migrate, restart)
git pull && docker compose build && docker compose run --rm migrate && docker compose up -d tedmaster
```

## Architecture

**TEDMaster** is an AI-powered TED talk English learning platform built on Next.js App Router.

### Data Flow

1. User submits a TED URL on `/` → calls `/api/parse`
2. `/api/parse` checks an in-process LRU cache; on miss, scrapes TED's `__NEXT_DATA__` JSON, extracts video streams + bilingual subtitles, writes to cache
3. `/watch` renders the HLS/MP4 player with virtual-scrolled transcript
4. Word click → `/api/ai` (action `define`) — checked against AI response cache first
5. Sentence analysis → `/api/ai` (action `analyze`) — also cached
6. HLS streams: master/sub-playlists proxied through `/api/proxy-m3u8`; segments served **directly from TED CDN** (no server bandwidth used)

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/parse` | POST | Scrape TED page; returns title, presenter, `videoUrl`, `isHls`, `transcript[]` |
| `/api/ai` | POST | Gemini 2.0 Flash; `define` → word data, `analyze` → grammar breakdown, `translate` → batch translation |
| `/api/proxy-m3u8` | GET | Proxy HLS master/sub-playlists (CORS bypass); rewrites segment URLs to direct CDN |
| `/api/proxy-segment` | GET | Legacy; kept for non-CDN segments only |
| `/api/proxy-audio` | GET | Proxy MP4 audio for Whisper transcription |
| `/api/extract-audio` | POST | Server-side audio extraction helper |
| `/api/subtitles` | GET | Subtitle fetch helper |
| `/api/youtube-subtitles` | GET | YouTube subtitle fallback |
| `/api/auth/signup` | POST | Register new user |
| `/api/auth/login` | POST | Login, returns JWT cookie |
| `/api/auth/me` | GET | Validate JWT, return user profile |
| `/api/user/credits` | GET/POST | Read / deduct user credits |
| `/api/user/history` | GET/POST | Read / upsert playback history |

### Key Files

| File | Role |
|------|------|
| `src/lib/i18n.tsx` | `AppProvider` — global theme (dark/light) + language (en/zh/zh-tw/ja) state |
| `src/lib/rateLimit.ts` | In-process IP-based rate limiter (Map-backed sliding window) |
| `src/lib/parseCache.ts` | LRU cache for parsed TED page results (cap 100, TTL 1h) |
| `src/lib/aiCache.ts` | LRU cache for AI word/sentence responses (cap 500, TTL 24h) |
| `src/app/page.tsx` | Home page: URL input, feature cards, theme/lang controls |
| `src/app/watch/page.tsx` | Player: HLS/MP4, RAF subtitle sync, word-click AI lookup, sentence analysis, Whisper recorder, SRT/PDF export |
| `src/app/watch/types.ts` | Shared TypeScript types for the watch page |
| `src/app/watch/components/` | Extracted modal/panel components: `HistoryModal`, `WordLookupModal`, `AIAnalysisPanel`, `PrintView`, `PrintConfigModal` |
| `src/components/VocabBook.tsx` | Vocabulary sidebar: sorted list, TTS, TXT export |
| `src/workers/transcribeWorker.ts` | Web Worker: Whisper (via @huggingface/transformers) for in-browser transcription |
| `src/app/api/parse/route.ts` | TED scraper — Zod URL validation, multi-path extraction, LRU cached |
| `src/app/api/ai/route.ts` | Gemini proxy — rate-limited per action, response cached |
| `prisma/schema.prisma` | PostgreSQL schema: User, Transaction, History |

### Caching Layers

| Layer | What | TTL | Location |
|-------|------|-----|----------|
| Parse LRU | Parsed TED page JSON | 1 hour | `src/lib/parseCache.ts` |
| AI LRU | Word definitions + grammar analyses | 24 hours | `src/lib/aiCache.ts` |
| Client localStorage | Transcript text | 30 days | browser |
| Client localStorage | Translations | 7 days | browser |

### Rate Limits

| Route | Limit |
|-------|-------|
| `/api/proxy-m3u8` | 120 req/min/IP |
| `/api/proxy-segment` | 600 req/min/IP |
| `/api/proxy-audio` | 30 req/min/IP |
| `/api/ai` define | 30 req/min/IP |
| `/api/ai` analyze | 15 req/min/IP |
| `/api/ai` translate | 6 req/min/IP |

### Theming

CSS custom properties on `[data-theme]` attribute (set by `AppProvider` on `<html>`):
- `--bg`, `--bg-2`, `--bg-3` — background levels
- `--text`, `--text-2`, `--text-3` — text hierarchy
- `--border`, `--accent`, `--accent-s` — borders and TED red accent

All themed components use `style={{ color: "var(--text)" }}` inline styles rather than Tailwind classes for theme-switching without page reload.

### Path Aliases

`@/*` → `./src/*`
