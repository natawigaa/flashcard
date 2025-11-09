# my-flashcards (dev)

Quick start (PowerShell)

1. Copy env example and add your Supabase project values:

```powershell
cd my-flashcards
copy .env.local.example .env.local
# edit .env.local and paste your Supabase values
notepad .env.local
```

2. Install dependencies and start dev server:

```powershell
npm install
npm install @supabase/supabase-js
npm run dev
```

3. Open http://localhost:5173 in your browser.

Notes:
- Keep real keys out of version control. Use `.env.local` only for local dev.
- If you want the dev server to be reachable on your LAN, run:
  `npm run dev -- --host`
