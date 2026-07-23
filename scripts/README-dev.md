# Local Development & Screenshot Recipe

Fastest path to a fully populated dashboard locally (no live AIS feed required).

## 1. Start TimescaleDB (Docker)
```bash
docker run -d --name tanker-ts -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=tanker_tracker \
  timescale/timescaledb:latest-pg16
```

## 2. Point the app at it
In `.env.local`:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/tanker_tracker
```

## 3. Apply the schema
```bash
docker exec tanker-ts psql -U postgres -d tanker_tracker -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
docker exec -i tanker-ts psql -U postgres -d tanker_tracker < src/lib/db/schema.sql
```

## 4. Seed demo data
Generates ~140 Middle East vessels, position tracks, sanctions, anomalies,
oil-price history, and news — enough to render every panel.
```bash
npx tsx --env-file=.env.local scripts/seed-demo.ts
```

## 5. Run
```bash
npm run dev        # http://localhost:3000/dashboard (no login — dashboard is open)
```

## Screenshots
```bash
node scripts/ui-recon.mjs        # captures /tmp/tt-shots/*.png + a console/network report
node scripts/ui-interact.mjs     # mobile/tablet + interaction shots
```

## Live data (optional, needs AISSTREAM_API_KEY)
```bash
npm run ingester:dev             # streams real AIS positions into the DB
```
