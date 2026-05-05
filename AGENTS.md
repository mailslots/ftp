# Codex Project Context

This is the FTP `พี่เทค (Take Care)` chatbot project. Keep this file up to date when major architecture changes happen so Codex can continue work across devices and sessions.

## Project

- App folder: `aichatbot`
- Framework: Next.js App Router, React, TypeScript, Tailwind CSS
- Production URL: https://ftpchat.vercel.app
- Vercel project: `ftpchat`
- Supabase project ref: `ebldiaeisatoncmgzeyt`
- Supabase URL: `https://ebldiaeisatoncmgzeyt.supabase.co`
- Primary model: Gemini via `GEMINI_API_KEY`
- Fallback model: DeepSeek via `DEEPSEEK_API_KEY`

## Safety Rules

- Never commit `.env.local`, real API keys, service-role keys, database passwords, or Vercel tokens.
- `.env.example` should contain placeholders only.
- Use `npm.cmd` on Windows PowerShell if `npm` is blocked by execution policy.
- Use `apply_patch` for manual file edits.
- Before deploy, run:

```bash
npm.cmd run lint
npm.cmd run build
```

## Main Files

- `src/components/p-tech-app.tsx`: main UI, chat screen, admin UI, FAQ, 9Q modal, spam lock UI.
- `src/app/api/chat/route.ts`: chatbot API, intent routing, knowledge retrieval, direct answers, model fallback call.
- `src/lib/llm.ts`: Gemini primary and DeepSeek fallback.
- `src/lib/knowledge.ts`: Supabase knowledge document upload/search/chunking.
- `src/lib/nineq.ts`: 9Q assessment persistence and admin summaries.
- `src/app/api/nineq/route.ts`: public 9Q save/update endpoint.
- `src/app/api/admin/nineq/route.ts`: admin 9Q report endpoint.
- `scripts/import-*.mjs`: import curated knowledge into Supabase.
- `data/*.txt` and `data/*.json`: curated knowledge sources used by import scripts.

## Chat Behavior

The API should classify the latest user intent first, then retrieve the right knowledge. Do not let old context such as `ปี 1 เทอม 1` override a new explicit question about insurance, mental health, camera buying, or another topic.

Key intents currently handled:

- `study_plan`: year/term plan questions.
- `course_catalog`: course description questions and short follow-ups like `ขอคำอธิบายรายวิชาได้ไหม`.
- `insurance`: accident-insurance coverage.
- `mental_health`: clinic/counseling/stress support.
- `retire`: GPA/credit retire rules.
- `camera_purchase`: camera buying advice.
- `ptech_meaning`: what `พี่เทค` means.
- `nine_q`: 9Q result interpretation.

## Supabase Tables

- `knowledge_documents`
- `knowledge_chunks`
- `nineq_assessments`

`nineq_assessments` stores only at-risk 9Q results:

- save when total score is `>= 7` or question 9 score is `> 0`
- do not save low-risk results
- contact fields are voluntary
- admin dashboard shows monthly summaries and recent records

RLS is enabled for `nineq_assessments`; server routes use the service-role key.

## Admin

Admin login is handled by app routes and a signed cookie. The public user should only see the officer login button at the footer. Admin-only sections include:

- knowledge document table
- add/edit/delete knowledge
- 9Q monthly summary and recent at-risk records

## Deployment

Production deploy command:

```bash
npx.cmd vercel --prod --yes
```

After deploy, verify:

```bash
node --input-type=module
```

Then POST to `https://ftpchat.vercel.app/api/chat` or `/api/nineq` with test payloads. Remove any test 9Q records from Supabase after testing.

## Common Regression Tests

Ask these after chat API changes:

- `ปี 1 เทอม 1 เรียนอะไร?` should answer the study plan.
- `หลักการถ่ายภาพ เรียนอะไรอะ` should answer course details.
- `ขอคำอธิบายรายวิชาได้ไหม` after a course question should remember the previous course.
- `ซื้อกล้องอะไรดี` should not answer with insurance or curriculum.
- `ประกันอุบัติเหตุคุ้มครองอะไรบ้าง?` should answer insurance.
- `คลินิกกำลังใจติดต่อได้ที่ไหน?` should answer counseling contacts.
- `พี่เทคคืออะไร` should explain Take Care and Technology.

## Current Design Notes

- Bright glassmorphism UI.
- Primary colors: `#0d1b2e` and `#dc2626`.
- Font: IBM Plex Sans Thai via app styling.
- Footer credit: `Developed by Phubet Chitapanya`.
- Avatar: `public/ptech-avatar.png`, used in header and assistant messages.
