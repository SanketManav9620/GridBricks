# Project Assumptions & Domain Decisions

This document tracks all explicit assumptions, domain rules, and technical decisions made during the design and implementation of the UK Day-Ahead Wind Trading & Analytics application.

---

## 1. Data Source & API Specifications (Elexon Insights API)
- **Base URL & Authentication**: The public Elexon Insights Solution API operates at `https://data.elexon.co.uk/bmrs/api/v1`. No API key or authentication token is required.
- **Specification Source**: The OpenAPI definition is registered on the Azure API Management Developer Portal (`https://developer.data.elexon.co.uk/developer/apis/prod-insol-insights-api?api-version=2022-04-01-preview`).
- **FUELHH (Actuals) Endpoint**:
  - Endpoint: `GET /datasets/FUELHH/stream`
  - Query parameters: `settlementDateFrom` (`yyyy-MM-dd`), `settlementDateTo` (`yyyy-MM-dd`), `fuelType` (`WIND`).
  - Semantics: Represents outturn generation aggregated across Great Britain in average MW over each 30-minute settlement period.
  - Granularity: 48 settlement periods per standard day (30-minute intervals).
- **WINDFOR (Forecasts) Endpoint**:
  - Endpoint: `GET /datasets/WINDFOR/stream`
  - Query parameters: Filtered exclusively by publication time (`publishDateTimeFrom`, `publishDateTimeTo` in ISO 8601).
  - Crucial finding: There is **no target time filter** (`startTimeFrom` / `startTimeTo`) on the stream endpoint. Querying historical forecasts requires specifying the publication window and filtering/joining on target delivery `startTime` client-side / backend-side.
  - Multi-version nature: Multiple forecast versions exist for any target delivery `startTime` as forecasts are regenerated and published multiple times per day.

---

## 2. Trading Desk Context & Timing Mechanics
- **Delivery Day (D) & Trading Day (D-1)**: Day-ahead electricity contracts are auctioned on day D-1 for physical delivery across 48 half-hour settlement periods on day D (00:00 to 24:00 clock time / UTC).
- **Decision Gate (Cutoff Time)**: The day-ahead auction closes at midday (typically 11:00 or 12:00 UK time / UTC on D-1).
  - Any forecast published after the auction gate cannot be used for the day-ahead purchase decision.
  - "Latest available forecast" for delivery period $t$ on day D is defined as the latest forecast published with `publishTime <= decision_cutoff(D-1)`.
- **Forecast Horizon**: The forecast lead time or horizon is calculated as `startTime - publishTime`. At D-1 midday, the horizon for delivery periods on day D spans approximately 12 hours (delivery at 00:00 D) to 36 hours (delivery at 23:30 D).

---

## 3. Data Integrity & Unit Sanity
- **Units**: Generation values in both `FUELHH` and `WINDFOR` are recorded in Megawatts (MW).
- **Range Bounds**: Great Britain national wind capacity in late 2025 / early 2026 is approximately 30,000–35,000 MW. Values must be non-negative ($\ge 0\text{ MW}$) and strictly within realistic capacity limits ($\le 35,000\text{ MW}$).
- **Timezone**: All API timestamps are UTC (`Z`). UK winter months (December, January, February) are in GMT (UTC+0), eliminating daylight savings transition ambiguities during the January 2026 evaluation period.

---

## 4. Ingestion, Storage & Repository Architecture
- **Snapshot Storage Format**: Data snapshots are saved as compressed CSV (`.csv.gz`) in `backend/data/` (`actuals.csv.gz` and `forecasts.csv.gz`). This maximizes compression (reducing bundle size for Vercel deployment), is dependency-light, and loads into memory within ~10 milliseconds.
- **Ingestion Chunking**: Network queries to Elexon `/stream` endpoints are chunked day-by-day to ensure resilience, granular retry capability, and bounded memory per request.
- **Client Resilience**: `httpx.Client` with timeout (default 30s) and exponential backoff retries (3 retries, base delay 0.5s with factor 2.0) on 5xx status codes, timeouts, and network connection errors.
- **Deduplication & Data Cleansing**:
  - Ingestion deduplicates records on composite primary key `(startTime, publishTime)`, retaining the latest record.
  - Records with missing/null generation or negative/invalid generation are dropped and logged with warning counts.
- **Repository Pattern**:
  - `DataRepository` maintains cached, immutable DataFrames loaded lazily on first access.
  - Environment variable `ELEXON_LIVE_FALLBACK=true` (or `false` by default) allows fallback to live API fetch if local snapshot files are absent or live data is explicitly requested.

