# Express server for my-flashcards

This small server demonstrates a pattern for running server-side operations that require a Supabase service role key (for example, secure search or admin-only queries).

Files
- `server/index.js` - Minimal Express server with a `/api/search?q=` endpoint that uses the Supabase service role key.
- `.env.example` - Example environment variables. Copy to `.env` and fill in the real values.

How to run
1. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. From the project root install dependencies (if you haven't already):

```powershell
npm install
```

3. Run the server:

```powershell
npm run server
```

Endpoints
- `GET /api/health` - basic health check
- `GET /api/search?q=term` - server-side search of `decks` (title or description). Returns `{ data, count }`.

Security notes
- The `SUPABASE_SERVICE_ROLE_KEY` is powerful and bypasses RLS. Never commit it to source control or expose it in client-side code.
- For production, restrict CORS, run behind TLS, and consider adding authentication to the endpoint (e.g., check a signed JWT from your frontend).
