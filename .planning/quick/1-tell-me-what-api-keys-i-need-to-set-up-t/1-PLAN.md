---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: [.env.local]
autonomous: false
requirements: []
must_haves:
  truths:
    - "App starts without missing-env errors"
    - "Map renders with vessel positions"
    - "Oil prices load from Alpha Vantage or FRED fallback"
    - "News headlines appear in the panel"
    - "AIS ingester connects and receives ship data"
  artifacts:
    - path: ".env.local"
      provides: "All runtime secrets"
  key_links:
    - from: ".env.local"
      to: "src/services/ais-ingester/index.ts"
      via: "AISSTREAM_API_KEY"
    - from: ".env.local"
      to: "src/lib/external/alphavantage.ts"
      via: "ALPHA_VANTAGE_API_KEY"
---

<objective>
Identify and configure all API keys required to run Tanker Tracker end-to-end.

Purpose: The app uses 6 external services. Without their keys, the map, AIS feed, oil prices, and news panels will all fail silently or with errors.
Output: A populated `.env.local` file with all required secrets.
</objective>

<execution_context>
@/Users/randyren/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/randyren/Developer/tanker-tracker/.env.example
@/Users/randyren/Developer/tanker-tracker/.planning/STATE.md
</context>

<tasks>

<task type="checkpoint:human-action">
  <name>Task 1: Obtain all required API keys</name>

  Here is every key the app needs, where to get it, and whether it is free.

  ---

  ### 1. AISSTREAM_API_KEY — required, core feature
  **What:** Live AIS WebSocket feed for vessel positions.
  **Where:** https://aisstream.io — sign up, verify email, go to Dashboard -> API Keys -> Create Key.
  **Cost:** Free tier available (limited concurrent subscriptions). Sufficient for personal use.
  **Notes:** This is the most important key. Without it the map shows no ships.

  ---

  ### 2. MAPBOX_ACCESS_TOKEN — required, core feature
  **What:** Renders the dark map tiles (dark-v11 style) the vessels are plotted on.
  **Where:** https://account.mapbox.com/access-tokens — sign up, click "Create a token". Use the default public token or create a scoped one.
  **Cost:** Free tier: 50,000 map loads/month. More than enough for personal use.
  **Notes:** Token starts with `pk.`. Without it the map area is blank.

  ---

  ### 3. ALPHA_VANTAGE_API_KEY — required for oil prices (primary)
  **What:** Fetches WTI and Brent crude price data.
  **Where:** https://www.alphavantage.co/support/#api-key — fill in the form, key is emailed instantly (no credit card).
  **Cost:** Free tier: 25 requests/day, 5/minute. The app caches for 15 minutes so this is fine.
  **Notes:** If Alpha Vantage fails, the app automatically falls back to FRED. But having both configured is best.

  ---

  ### 4. FRED_API_KEY — optional but recommended (oil price fallback)
  **What:** Federal Reserve Economic Data API — fallback for WTI/Brent prices when Alpha Vantage fails.
  **Where:** https://fred.stlouisfed.org/docs/api/api_key.html — create a free account, request an API key from My Account -> API Keys.
  **Cost:** Completely free, no limits for reasonable use.
  **Notes:** The code already falls back to FRED automatically. Without this key, FRED fallback is disabled and price panel goes dark if Alpha Vantage is down.

  ---

  ### 5. NEWSAPI_KEY — required for news panel
  **What:** Fetches geopolitical headlines shown in the news panel.
  **Where:** https://newsapi.org/register — fill in the form, key shown immediately.
  **Cost:** Free developer tier: 100 requests/day, articles from last 30 days. Fine for personal use.
  **Notes:** Without this key the news panel will be empty.

  ---

  ### 6. JWT_SECRET — generate yourself (no signup needed)
  **What:** Signs session tokens for the password-protected login.
  **Where:** Generate locally — run this command:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  **Cost:** Free.
  **Notes:** Must be at least 32 characters. Keep it secret.

  ---

  ### 7. PASSWORD_HASH — generate yourself (no signup needed)
  **What:** Bcrypt hash of the shared password your friends use to log in.
  **Where:** After running `npm install`, generate with:
  ```
  node -e "const b=require('bcryptjs'); b.hash('your-password-here',10).then(h=>console.log(h))"
  ```
  Replace `your-password-here` with the actual password you want.
  **Cost:** Free.
  **Notes:** The raw password is NOT stored — only this hash.

  ---

  ### 8. DATABASE_URL — set up PostgreSQL with TimescaleDB
  **What:** Connection string to the PostgreSQL database with TimescaleDB extension.
  **Where (local dev):** Install TimescaleDB locally via Docker:
  ```
  docker run -d --name timescaledb -p 5432:5432 \
    -e POSTGRES_PASSWORD=password \
    -e POSTGRES_DB=tanker_tracker \
    timescale/timescaledb:latest-pg16
  ```
  Then: `DATABASE_URL=postgresql://postgres:password@localhost:5432/tanker_tracker`
  **Where (hosted):** Timescale Cloud (https://console.cloud.timescale.com) — free trial available. Or Railway/Supabase with TimescaleDB extension.
  **Cost:** Free for local Docker. Timescale Cloud free trial = 30 days.

  ---

  Once you have all the keys, type "ready" and Task 2 will create the `.env.local` file.

  <resume-signal>Type "ready" when you have all keys, or list which ones you have so far</resume-signal>
</task>

<task type="checkpoint:human-action">
  <name>Task 2: Populate .env.local</name>

  Create a `.env.local` file in the project root (this file is git-ignored) with the following contents, substituting your actual values:

  ```
  # Database
  DATABASE_URL=postgresql://postgres:password@localhost:5432/tanker_tracker

  # AIS live feed
  AISSTREAM_API_KEY=your_key_here

  # JWT for session auth
  JWT_SECRET=your_64char_hex_here

  # Bcrypt hash of shared login password
  PASSWORD_HASH=your_bcrypt_hash_here

  # Map rendering
  MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token

  # Oil prices (primary + fallback)
  ALPHA_VANTAGE_API_KEY=your_alphavantage_key
  FRED_API_KEY=your_fred_key

  # News panel
  NEWSAPI_KEY=your_newsapi_key
  ```

  After creating the file, verify it works by running:
  ```
  npm run dev
  ```

  Expected: App starts at http://localhost:3000 with no "missing env" errors in the terminal.

  For the AIS ingester (separate service), also create `src/services/ais-ingester/.env` with:
  ```
  DATABASE_URL=postgresql://postgres:password@localhost:5432/tanker_tracker
  AISSTREAM_API_KEY=your_key_here
  ```

  <resume-signal>Type "done" when .env.local is created and the app starts, or describe any errors</resume-signal>
</task>

</tasks>

<verification>
- `npm run dev` starts without errors
- Visiting http://localhost:3000 shows the login page
- After logging in, the map renders with the dark Mapbox style
- Oil price panel loads (WTI/Brent values appear)
- News panel loads (headlines appear)
- AIS ingester (run separately) connects to aisstream.io and logs received messages
</verification>

<success_criteria>
All 8 secrets configured in .env.local, app starts cleanly, all panels load data.
</success_criteria>

<output>
No SUMMARY.md needed for quick tasks.
</output>
