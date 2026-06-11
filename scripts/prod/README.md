# Production: TimescaleDB migration & OHLC backfill

Schema **v2** replaces the legacy `ohlc_data` table with TimescaleDB hypertables (`ohlc_1m`, `ohlc_1d`) and continuous aggregates for charts (`ohlc_30m` … `ohlc_1mo`).

**Preserved during migration:** users, portfolios, transactions, favorites, predictions, RAG (`market_events`), tracked assets.

**Re-downloaded from Kraken:** all OHLC / chart history.

---

## Prerequisites (VPS)

- Docker Engine + Docker Compose v2
- Repo cloned at e.g. `/opt/crypto-trade`
- Root `.env` configured (see below)
- Git pull with latest code (Timescale `docker/Dockerfile.postgres`, schema v2)

### Production `.env` (repo root)

```env
DB_USER=postgres
DB_PASSWORD=<strong-password>
DB_NAME=postgres
DB_HOST=db
DB_PORT=5432

JWT_SECRET=<32+ random bytes>
GOOGLE_CLIENT_ID=<google-oauth-client-id>

LLM_PROVIDER=gemini
GEMINI_API_KEY=<key>
PREDICTION_ASSETS=BTC/USD,ETH/USD,SOL/USD,LINK/USD

ML_SERVICE_URL=http://ml-service:8000
REACT_APP_API_URL=https://your-domain.com
REACT_APP_GOOGLE_CLIENT_ID=<same-as-GOOGLE_CLIENT_ID>
```

`DB_HOST=db` and `DB_PORT=5432` are correct inside Compose. Do **not** point at an external plain Postgres — you need the TimescaleDB image from this repo.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `backup_database.sh` | Full `pg_dump` to `backups/` |
| `migrate_timescaledb.sh` | Main migration orchestrator |
| `wipe_ohlc.sh` | Delete OHLC only (keeps users/RAG) |
| `sync_kraken_history.sh` | Full Kraken history → TimescaleDB |
| `restore_app_data.sh` | Restore users/RAG from a `.dump` file |

Make executable once:

```bash
cd /opt/crypto-trade
chmod +x scripts/prod/*.sh
```

---

## Migration paths

### Path A — Upgrade existing prod DB in place (recommended)

Keeps the same Docker volume. `db-migrate` backs up automatically, then applies schema v2 (drops `ohlc_data`, creates hypertables). Users and RAG stay; OHLC must be re-synced.

```bash
cd /opt/crypto-trade
git pull

# 1. Full manual backup (extra safety)
./scripts/prod/backup_database.sh

# 2. Migrate schema + wipe old OHLC + download full Kraken history
./scripts/prod/migrate_timescaledb.sh --sync --wipe
```

**Downtime:** ~30–90 minutes while Kraken sync runs (backend is stopped until the end).

---

### Path B — Fresh TimescaleDB volume (clean slate)

Use when the old database was plain PostgreSQL or corrupted. **Destructive** — wipes the entire DB volume.

```bash
cd /opt/crypto-trade
git pull

./scripts/prod/backup_database.sh

# Destructive: removes postgres volume, re-inits TimescaleDB
./scripts/prod/migrate_timescaledb.sh --fresh-volume --sync --wipe

# Restore users / portfolios / RAG from backup (OHLC will come from Kraken sync)
./scripts/prod/restore_app_data.sh backups/prod-full-<timestamp>.dump
```

---

### Path C — Schema already on v2; only refill OHLC

```bash
./scripts/prod/sync_kraken_history.sh --wipe        # wipe + re-download
./scripts/prod/sync_kraken_history.sh --wipe --force  # same, ignore skip heuristics
```

---

## Step-by-step (Path A — exact prod sequence)

### 1. SSH to the server

```bash
ssh user@your-vps
cd /opt/crypto-trade   # your clone path
```

### 2. Pull latest code

```bash
git pull origin main
```

Ensure these exist:

- `docker/Dockerfile.postgres` (TimescaleDB + pgvector)
- `backend/src/main/resources/db/schema.sql` (v2)
- `backend/src/main/resources/db/schema.version` → `2`

### 3. Run migration

```bash
chmod +x scripts/prod/*.sh
./scripts/prod/migrate_timescaledb.sh --sync --wipe
```

This will:

1. `pg_dump` full backup → `backups/prod-full-<timestamp>.dump`
2. Stop backend, ml-service, frontend
3. Rebuild `db` image (TimescaleDB)
4. Start `db`, run `db-migrate` (schema v2)
5. Wipe OHLC tables, paginate Kraken for all tracked symbols (daily) + ML symbols (hourly)
6. Refresh continuous aggregates
7. `docker compose up -d --build` (full stack)

### 4. Import RAG seed (if `market_events` is empty)

```bash
set -a && source .env && set +a
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" \
  < ml-service/deploy/market_events_seed.sql
```

Verify:

```bash
curl -s http://localhost:8000/rag/status | head
```

### 5. Grant yourself admin

```bash
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -c \
  "UPDATE users SET is_admin = true WHERE email = 'your@gmail.com';"
```

Log out and back in on the website.

### 6. Admin panel (browser)

1. **Sync market stats**
2. **Sync market data** (fills recent 1m/1d gaps)
3. **Run hourly predictions**
4. **Run daily predictions**

### 7. Verify OHLC

```bash
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT symbol, COUNT(*) FROM ohlc_1d GROUP BY symbol ORDER BY symbol LIMIT 5;"

docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT symbol, COUNT(*) FROM ohlc_1h WHERE symbol = 'BTC/USD';"
```

### 8. Verify app

- Open a crypto chart → check 1D, 1M, 1Y, ALL ranges
- Open BTC details → AI Predict panel
- `curl -s https://your-domain.com/api/health` (if exposed)

---

## Local (Windows) equivalent

```powershell
# Wipe + full Kraken sync
.\scripts\sync_kraken_history.ps1 -Wipe -ConfirmWipe

# Wipe only
.\scripts\sync_kraken_history.ps1 -WipeOnly -ConfirmWipe
```

Requires `ml-service/.env` with `DB_PORT` matching your database.

---

## What gets wiped vs kept

| Data | `--wipe` / `--wipe-only` | `schema v2` migration |
|------|--------------------------|------------------------|
| `ohlc_1m`, `ohlc_1d`, CAGGs | Deleted / refreshed | Recreated |
| Legacy `ohlc_data` | Dropped | Dropped |
| `users`, `assets`, `transactions` | **Kept** | **Kept** |
| `predictions`, `market_events` | **Kept** | **Kept** |
| `tracked_asset` | **Kept** | **Kept** |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `TimescaleDB extension not found` | Rebuild db: `docker compose build db && docker compose up -d db` |
| `ohlc_1m does not exist` | Run `./scripts/prod/migrate_timescaledb.sh` (no `--sync`) first |
| Charts empty on 1Y/ALL after sync | Check `ohlc_1d` counts; re-run sync with `--force` |
| ML `Insufficient training data` | Wait for hourly sync; check `ohlc_1h` for BTC/USD |
| `docker volume rm` fails | `docker volume ls` — name is `<project>_postgres_data` |
| Kraken rate limits | Script backs off automatically; re-run is safe (upserts) |

---

## Rollback

If migration fails before you delete the backup:

```bash
docker compose stop backend ml-service frontend
docker compose exec -T db dropdb -U "$DB_USER" "$DB_NAME"   # destructive
docker compose exec -T db createdb -U "$DB_USER" "$DB_NAME"
cat backups/prod-full-<timestamp>.dump | \
  docker compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner
docker compose up -d
```

Prefer restoring to a **fresh volume** if the old DB was plain Postgres without TimescaleDB.
