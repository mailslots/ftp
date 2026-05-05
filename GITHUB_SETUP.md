# GitHub Cross-Device Workflow

This project is intended to be worked on from multiple Codex sessions/devices through GitHub.

## First-Time Setup On A New Device

```bash
git clone https://github.com/mailslots/ftp.git aichatbot
cd aichatbot
npm install
copy .env.example .env.local
npm run dev
```

Fill `.env.local` with local secrets before running features that use Supabase or AI models.

## Normal Workflow

```bash
git pull
npm install
npm run lint
npm run build
git status
```

Create a branch for non-trivial changes:

```bash
git switch -c codex/short-change-name
```

Commit and push:

```bash
git add .
git commit -m "Describe change"
git push -u origin HEAD
```

## Secrets

Never commit:

- `.env.local`
- API keys
- Supabase service-role keys
- database connection strings with passwords
- Vercel tokens

Production secrets should be managed in Vercel environment variables.

## If GitHub CLI Is Needed

Install GitHub CLI, then authenticate:

```bash
gh auth login
gh auth status
```

On this Windows machine, `gh.exe` may be installed at:

```text
C:\Program Files\GitHub CLI\gh.exe
```
