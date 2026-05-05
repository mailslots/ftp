# P-Tech AI Chatbot

Thai-first AI chatbot for the Film and Television Production Technology program.

Production: https://ftpchat.vercel.app

## What This App Does

- Chatbot persona: `พี่เทค (Take Care)`, default Thai answers, feminine tone.
- Supports freshman questions, FTP curriculum/study plan, course descriptions, camera/photography/film basics, retire rules, insurance, and mental-health support.
- Admin-only knowledge base for text, PDF, DOC/DOCX, and image uploads.
- Supabase stores knowledge documents, chunks, and 9Q depression-screening records.
- Gemini is the primary model. DeepSeek is the fallback when Gemini rate/quota errors happen.
- Vercel hosts the production app and runs scheduled cleanup.

## Local Setup

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3000.

## Required Environment Variables

Copy `.env.example` to `.env.local` locally. Never commit `.env.local`.

```bash
SUPABASE_URL="https://ebldiaeisatoncmgzeyt.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="replace-with-supabase-service-role-key"
ADMIN_EMAIL="mailslots@gmail.com"
ADMIN_PASSWORD="replace-with-admin-password"
ADMIN_SESSION_SECRET="replace-with-a-long-random-secret"
GEMINI_API_KEY="replace-with-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
DEEPSEEK_API_KEY="replace-with-deepseek-api-key"
DEEPSEEK_MODEL="deepseek-v4-flash"
DEEPSEEK_API_BASE="https://api.deepseek.com"
CRON_SECRET="replace-with-a-long-random-secret"
```

## Useful Commands

```bash
npm run lint
npm run build
npx vercel --prod --yes
```

On this Windows machine, use `npm.cmd` if PowerShell blocks `npm`.

## Cross-Device Notes

Use GitHub as the source of truth. A new Codex session on another device should:

1. Clone the GitHub repo.
2. Read `AGENTS.md`.
3. Create `.env.local` from `.env.example`.
4. Run `npm install`.
5. Run `npm.cmd run dev` or `npm run dev`.

Secrets live in local `.env.local` and Vercel environment variables, not in GitHub.
