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

---

## 5. Analytics & Buffer Sizing Mechanics
- **Decision Cutoff Timestamp**: The auction gate cutoff timestamp is computed as `(delivery_date - 1 day)` at `cutoff_hhmm` in `Europe/London` timezone, then converted to UTC. Any forecast with `publishTime > cutoff` is strictly excluded to prevent look-ahead bias.
- **Hourly vs. Half-Hourly Alignment**: `WINDFOR` is hourly. By default, `FUELHH` actuals are aggregated to hourly mean ($(\text{SP}_1 + \text{SP}_2)/2$).
- **Error Sign Convention**:
  $$\text{Error} = \text{Forecast} - \text{Actual} = \hat{y} - y$$
  - $\text{Error} > 0$: Over-forecast (generation shortfall; trading desk sold more energy than produced, resulting in imbalance penalties at System Buy Price).
  - $\text{Error} < 0$: Under-forecast (generation surplus; spill energy cashed out at System Sell Price).
- **Core Metrics Formulations**:
  - **Bias (MBE)**: $\frac{1}{N}\sum (\hat{y}_i - y_i)$
  - **MAE**: $\frac{1}{N}\sum |\hat{y}_i - y_i|$
  - **RMSE**: $\sqrt{\frac{1}{N}\sum (\hat{y}_i - y_i)^2}$
  - **WAPE**: $\frac{\sum |\hat{y}_i - y_i|}{\sum y_i}$
  - **P50 / P90 / P95 Absolute Error**: Empirical percentiles of $|\hat{y}_i - y_i|$.
  - **P90 Over-Forecast Error**: 90th percentile of positive forecast shortfalls $\max(0, \hat{y}_i - y_i)$ (or error quantile).
  - **Percentage within $\pm 10\%$**: Fraction of periods where $|\hat{y}_i - y_i| \le 0.10 \times y_i$.
- **Expanding Window Safety Buffer**: For delivery day $D$, the dynamic safety buffer is sized strictly from historical delivery errors prior to $D$ ($t < D$). This prevents data leakage and simulates live production desk deployment.

---

## 6. API Contracts & Frontend Architecture
- **48 Half-Hour Settlement Period Alignment**: The `/api/forecast` endpoint outputs exactly 48 half-hour settlement periods (SP 1 to 48) for delivery day D. Because `WINDFOR` is published at hourly resolution, hourly values are mapped to both constituent half-hours (`:00` and `:30`), including `settlementPeriod`, `startTime`, `forecast_mw`, `publishTime`, `horizon_hours`, and risk bands (`risk_band_p90_mw` and `risk_band_p95_mw`).
- **Validation**:
  - `cutoff`: strictly validated against regex `^(?:[01]\d|2[0-3]):[0-5]\d$` (24-hour clock `HH:MM`). Default: `"11:00"`.
  - `delivery_date`: validated against available ingested dates in January 2026 (`2026-01-01` to `2026-02-01`).
- **Response Caching**: Deterministic responses for `(delivery_date, cutoff)` are cached in-memory with LRU eviction for instant sub-5ms API response latency.
- **Frontend Stack**: Vite + React 18/19, TypeScript, Tailwind CSS, Lucide icons, TanStack React Query v5, Recharts, React Router v6.
- **Visual Design System**:
  - Background: Dark Navy (`#0b132b`, `#111d4a`, `#1c2541`).
  - Primary / Wind: Vibrant Teal (`#2dd4bf`, `#0d9488`).
  - Imbalance / Risk / Warnings: Amber & Coral (`#f59e0b`, `#fbbf24`, `#ef4444`).
  - Grid: 8px spacing system, responsive cards, crisp tabular layouts.



