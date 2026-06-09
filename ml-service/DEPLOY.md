# ML Service — Local Training & VPS Deployment

This guide covers training models locally, seeding RAG, and deploying to your VPS so production only needs **live OHLC data** (not retraining).

## What gets deployed

| Artifact | Location | Purpose |
|----------|----------|---------|
| XGBoost models | `ml_service/model/artifacts/*_{1h,24h}.json` | Pre-trained 1h and 24h price forecasts (baked into Docker image) |
| RAG seed data | `deploy/market_events_seed.sql` | 2,760 historical market events with embeddings |
| DB schema | `backend/.../db/schema.sql` | All tables (app + ML); auto on fresh DB |

## Local training (already done on this machine)

```powershell
cd c:\dev\VSCode_Projects\Crypto-Trade
.\.venv\Scripts\Activate.ps1

# 1. Ensure ml-service/.env points at local Postgres (port 5433)
# 2. Fetch 1y of 1h OHLC with volume from Kraken (trades pagination + OHLC window; retained indefinitely)
$env:PYTHONPATH="ml-service"
python ml-service/scripts/fetch_missing_ohlc.py

# 3. Train all models
python ml-service/scripts/train_all.py

# 4. Seed RAG index (500+ events per asset)
python ml-service/scripts/seed_rag.py

# 5. Export RAG SQL for VPS
python ml-service/scripts/export_rag.py
```

Trained models are in `ml-service/ml_service/model/artifacts/`.
RAG export is in `ml-service/deploy/market_events_seed.sql` (~13 MB).

### Re-train later (e.g. monthly)

Repeat steps 2–5 locally, commit updated artifacts + SQL, redeploy.

---

## VPS deployment

### Prerequisites on VPS

- Docker + Docker Compose
- Domain / reverse proxy configured (optional)
- `.env` at repo root with production secrets (see root `.env.example` patterns)

### Step 1 — Manual: configure production `.env`

On the VPS, create/update `.env`:

```env
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
DB_HOST=db
DB_PORT=5432

JWT_SECRET=...
GOOGLE_CLIENT_ID=...

LLM_PROVIDER=mock          # or anthropic / gemini
ANTHROPIC_API_KEY=         # if using anthropic
GEMINI_API_KEY=            # if using gemini
CRYPTOPANIC_AUTH_TOKEN=    # optional; improves headline/sentiment fetch

ML_SERVICE_URL=http://ml-service:8000
REACT_APP_API_URL=https://your-domain.com
REACT_APP_GOOGLE_CLIENT_ID=...
```

### Step 2 — Manual: push code with trained artifacts

Ensure these are in your git commit before deploying:

```
ml-service/ml_service/model/artifacts/BTC_USD.json
ml-service/ml_service/model/artifacts/BTC_USD_meta.json
ml-service/ml_service/model/artifacts/ETH_USD.json
... (all 8 model files)
ml-service/deploy/market_events_seed.sql
```

### Step 3 — Deploy containers

```bash
git pull
docker compose build backend frontend ml-service
docker compose up -d
```

On every `docker compose up`, the **`db-migrate`** service (one-shot) will:

1. Wait for Postgres to be healthy
2. Check `schema_meta.version` and core tables (`users`, `predictions`, `market_events`, `ohlc_data`)
3. If missing or outdated: **`pg_dump` backup** to `backups/pre-schema-v{N}-<timestamp>.dump`
4. Apply `backend/src/main/resources/db/schema.sql` (additive / idempotent — does **not** wipe data)
5. Exit; then `backend` and `ml-service` start

Fresh volumes also get `schema.sql` from Postgres init (`docker-entrypoint-initdb.d`); `db-migrate` then sees version 1 and skips.

Manual run (local Postgres on port 5433):

```powershell
.\scripts\db_migrate.ps1
```

### Step 4 — Manual: import RAG seed (existing or fresh DB)

```bash
# Import pre-built RAG index (schema already applied by db-migrate)
docker compose exec -T db psql -U $DB_USER -d $DB_NAME < ml-service/deploy/market_events_seed.sql
```

Verify:

```bash
curl http://localhost:8000/rag/status
# Each asset should show count >= 500 and "ready": true
```

### Step 5 — Manual: ensure live OHLC data on VPS

The ML service needs **recent 1h OHLC candles with volume** for inference (not the full training history).

1. Start backend and wait for market data sync, **or**
2. Trigger admin sync (requires admin JWT):

```bash
curl -X POST https://your-domain.com/api/admin/sync/market-data \
  -H "Authorization: Bearer <admin-token>"
```

Check data exists:

```bash
docker compose exec db psql -U $DB_USER -d $DB_NAME -c \
  "SELECT symbol, COUNT(*) FROM ohlc_data WHERE interval_string='1h' AND volume > 0 GROUP BY symbol;"
```

Symbols must match exactly: `BTC/USD`, `ETH/USD`, `SOL/USD`, `LINK/USD`.

### Step 6 — Verify predictions

```bash
curl http://localhost:8000/health
curl -X POST "http://localhost:8000/predict/batch/hourly?source=admin&align=next_hour"
curl -X POST "http://localhost:8000/predict/batch/daily?use_rag=true&source=admin&align=midnight"
curl http://localhost:8000/rag/status
```

From frontend: open a crypto details page → **AI Predict** (reads pre-computed rows from Java `/api/predictions/latest`).

---

## What runs automatically on VPS

| Schedule | Job |
|----------|-----|
| Every hour (:00) | 1h ML batch predictions for all assets |
| Daily at 00:00 UTC | 24h + context/RAG batch predictions for all assets |
| Every hour (:30) | Backfill `actual_price_24h` + increment RAG index |
| Daily at 00:00 UTC | Market data OHLC sync from Kraken |

Pre-trained models are **not** retrained unless artifact files are missing from the container.

---

## Manual checklist summary

- [ ] Set production `.env` (DB, JWT, Google, LLM keys)
- [ ] Commit & push trained `artifacts/*.json` + `market_events_seed.sql`
- [ ] `docker compose build && docker compose up -d` (runs `db-migrate` automatically)
- [ ] Import `market_events_seed.sql` into Postgres (or restore full `pg_dump`)
- [ ] Confirm 1h OHLC with volume exists for all 4 assets
- [ ] Hit `/health`, batch hourly/daily predict, `/rag/status`
- [ ] (Optional) Set `LLM_PROVIDER=anthropic` + API key for real LLM tuning

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `No data for BTC/USD` | OHLC missing or wrong symbol format; run market sync |
| `Insufficient training data` | Volume column all zeros; run `fetch_missing_ohlc.py` locally or sync on VPS |
| RAG `ready: false` | Import `market_events_seed.sql` or wait for 500+ live predictions |
| 500 on batch predict | Check ml-service logs: `docker compose logs ml-service` |
| Model retrain on every request | Artifacts not in Docker image; rebuild after placing JSON files |
