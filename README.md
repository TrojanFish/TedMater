# 🎓 TEDMaster — AI-Powered TED Study System

**TEDMaster** is an AI-driven TED speech study platform built with Next.js. It integrates Google Gemini AI and Whisper transcription technologie to provide users with an immersive bilingual learning experience, smart vocabulary analysis, and deep content insights.

[中文版本](./README_CN.md)

---

## ✨ Key Features

- 🤖 **AI Deep Insight**: Uses Google Gemini 1.5 Flash for topic analysis, difficulty identification, and in-depth vocabulary extraction from speeches.
- 🌍 **Bilingual Subtitle Sync**: Precision-synced English and Chinese subtitles with real-time word lookup support.
- 🎙️ **Smart Transcription**: Integrated Whisper/Moonshine technology to extract and transcribe audio directly from YouTube URLs.
- 🔍 **Intelligent Search**: Built-in efficient video search functionality to quickly find relevant study materials.
- 💳 **Credit System**: A complete user credit and quota management system covering word lookups, AI analysis, and membership levels.
- 📄 **Multi-Format Export**: Export analyzed content and subtitles to PDF or Markdown for offline study.
- 📱 **Responsive Design**: optimized for both desktop and mobile devices for learning anytime, anywhere.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15+ (App Router), TypeScript, Tailwind CSS
- **Backend Logic**: Next.js Server Actions & API Routes
- **Database**: PostgreSQL (Prisma ORM)
- **AI Engine**: Google Gemini 1.5 Flash
- **Containerization**: Docker & Docker Compose
- **Authentication**: JWT (JSON Web Tokens)

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ or 20+
- PostgreSQL Database
- [Google AI Studio](https://aistudio.google.com/) Gemini API Key

### 2. Environment Configuration
Copy and edit `.env.local`:
```bash
cp .env.example .env.local
```
Fill in `GEMINI_API_KEY`, `JWT_SECRET`, and `DATABASE_URL`.

### 3. Installation & Run
```bash
# Install dependencies
npm install

# Initialize database
npx prisma generate
npx prisma migrate dev

# Start development server
npm run dev
```
Access: `http://localhost:3000`

---

## 🏗️ Production Deployment

We provide detailed production deployment guides:

- [VPS Bare-metal Guide (Docker)](./DEPLOY.md)
- [Baota Panel (BT) Quick Deployment Guide](./DEPLOY_BAOTA.md)

**Default Port**: The production image maps to port **3005** by default.

---

## 📂 Project Structure

- `src/app`: Core page routes & API endpoints
- `src/components`: UI components
- `src/lib`: Core utilities (AI integration, i18n, rate-limiting, etc.)
- `prisma`: Database schema & migration files
- `public`: Static assets and local model weights

---

## 📜 License

This project is licensed under the MIT License.

---

> [!NOTE]
> The first time you perform a browser-based transcription, the Whisper model weights (~150MB) will be downloaded. A stable internet connection is recommended.
