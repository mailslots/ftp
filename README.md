# Hello Vercel 👋

A friendly [Next.js](https://nextjs.org/) starter that ships with a polished landing page, deployment checklist, and a JSON hello API to verify that your Vercel project is wired up end to end.

## Project highlights

- **Vercel-ready setup** – Uses the App Router, strict TypeScript settings, and default build commands that work on Vercel with zero extra configuration.
- **Landing experience** – The homepage contains a responsive hero with quick steps to confirm your deployment succeeded.
- **Health endpoint** – `GET /api/hello` returns JSON so you can validate the deployment from a script or monitoring check.

## Local development

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the dev server

   ```bash
   npm run dev
   ```

   The app will be available at http://localhost:3000.

3. (Optional) Hit the hello API from another terminal

   ```bash
   curl http://localhost:3000/api/hello
   ```

## Deploying to Vercel

This repository works with Vercel’s zero-config Next.js preset. You can deploy it in either of these ways:

- **Vercel dashboard** – Import the Git repository and accept the suggested build settings (`npm run build` / `.next`).
- **Vercel CLI** – From your terminal, run:

  ```bash
  vercel deploy --prod
  ```

After your first production deploy finishes, visit your site’s root URL to see the hero page, and request `/api/hello` to confirm serverless functions are working.
