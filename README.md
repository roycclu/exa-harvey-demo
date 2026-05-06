# Exa Legal Research Demo

Minimal legal research demo built with Next.js for Vercel deployment.

## Features

- Manual neural search against Exa with top 5-8 results
- Document upload for text or PDF inputs
- OpenAI-based extraction of three research angles:
  - Relevant precedents
  - Opposing counsel history
  - Industry and company news
- Parallel Exa searches grouped by category
- Result sorting by relevance or recency
- Category filters and graceful API error handling

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and add your API keys.

3. Start the app:

```bash
npm run dev
```

## Environment variables

- `EXA_API_KEY`: Required for Exa neural search
- `OPENAI_API_KEY`: Required for document-angle extraction
- `OPENAI_MODEL`: Optional override for the OpenAI model

## Deploy to Vercel

1. Import the repo into Vercel.
2. Set the environment variables from `.env.example`.
3. Deploy with the default Next.js settings.
