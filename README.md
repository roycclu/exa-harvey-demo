# Harvey Neural Search Demo

Legal research demo built with Next.js for Vercel deployment.

## Features

- Natural language legal search
- Document upload for text or PDF inputs
- OpenAI-based extraction of three research angles:
  - Relevant precedents
  - Opposing counsel history
  - Industry and company news
- Side-by-side neural search and Google comparison results
- Domain filtering for legal sites
- Search request payload inspection in the configuration panel
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

- `EXA_API_KEY`: Required for the neural search provider
- `OPENAI_API_KEY`: Required for document-angle extraction
- `OPENAI_MODEL`: Optional override for the OpenAI model
- `GOOGLE_API_KEY`: Optional, enables Google comparison search
- `GOOGLE_CSE_ID`: Optional, required with `GOOGLE_API_KEY` for Google comparison search

## Deploy to Vercel

1. Import the repo into Vercel.
2. Set the environment variables from `.env.example`.
3. Deploy with the default Next.js settings.
