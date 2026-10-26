# GridBricks — API Reference (FastAPI Backend)

**Base URL:** `/api` (proxied via Vite dev server or Vercel rewrite)  
**OpenAPI Spec:** `/docs` (Swagger UI) | `/redoc` (ReDoc) | `/openapi.json`  
**Version:** 0.1.0  
**Content-Type:** `application/json`  
**CORS:** `*` (configured for local Vite + Vercel deployments)

---

## Quick Reference: All Endpoints

| Method | Path | Tag | Description |
|--------|------|-----|-------------|
| `GET` | `/health` | System | Health check + version |
| `GET` | `/meta` | Metadata | Available dates, dataset stats, default cutoff |
| `GET` | `/forecast` | Trading Desk | 48-period forecast + revisions + P90/P95 buffers |
| `GET` | `/actuals` | Trading Desk | 48-period actual outturn (FUELHH) |
| `GET` | `/accuracy/summary` | Analytics | Holistic accuracy metrics (14 KPIs) |
| `GET` | `/accuracy/daily` | Analytics | 31-day daily metrics + expanding buffer |
| `GET` | `/accuracy/by-hour` | Analytics | 24-hour diurnal error profile |
| `GET` | `/accuracy/by-horizon` | Analytics | 5 lead-time horizon buckets |
| `GET` | `/accuracy/distribution` | Analytics | Error histogram (configurable bin size) |
| `GET` | `/accuracy/timeseries` | Analytics | 744-hour month-wide trajectory |

---

## Shared Parameters

### `cutoff` (query, string, default: `"09:00"`)
- **Format:** 24-hour `HH:MM` (London time, Europe/London timezone)
- **Validation:** Regex `^([01]\d|2[0-3]):[0-5]\d$`
- **Semantics:** Auction gate closure on **D-1** (day before delivery)
- **Default:** `09:00` London → `08:00` or `09:00` UTC depending on DST
- **Used by:** All analytics endpoints + `/forecast`

### `delivery_date` (query, string, required)
- **Format:** `YYYY-MM-DD` (ISO 8601)
- **Validation:** Must fall within available evaluation range (Jan 2026)
- **Used by:** `/forecast`, `/actuals`

### `bin_size_mw` (query, float, default: `500.0`)
- **Range:** `100.0` – `2000.0`
- **Used by:** `/accuracy/distribution`

---

## Error Response Format

All 4xx/5xx responses return:
```json
{
  "detail": "Human-readable error message"
}
```

**Common HTTP Codes:**
| Code | Cause |
|------|-------|
| `200` | Success |
| `400` | Invalid parameter format (cutoff, date, bin_size) |
| `404` | No data for requested date/cutoff combination |
| `500` | Internal server error (repository, computation) |

---

## Endpoint Details

---

### 1. System Health

#### `GET /api/health`

**Response:** `HealthResponse`
```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-10-26T14:30:00.123Z"
}
```

**Purpose:** Load balancer probe, deployment verification.

---

### 2. Metadata

#### `GET /api/meta`

**Response:** `MetaResponse`
```json
{
  "min_delivery_date": "2026-01-01",
  "max_delivery_date": "2026-01-31",
  "available_dates": ["2026-01-01", "2026-01-02", ..., "2026-01-31"],
  "default_cutoff": "09:00",
  "market": "UK Day-Ahead Electricity Market (BMRS)",
  "fuel_type": "WIND",
  "total_actual_periods": 1488,
  "total_forecast_versions": 24768
}
```

**Purpose:** Populate date stepper, validate date bounds, show dataset scope.

**Notes:**
- `available_dates` limited to January 2026 (31 days)
- `total_actual_periods` = 31 days × 48 half-hours = 1488
- `total_forecast_versions` = all WINDFOR records in repository

---

### 3. Trading Desk — Forecast

#### `GET /api/forecast`

**Parameters:**
| Name | Type | Required | Default |
|------|------|----------|---------|
| `delivery_date` | string | Yes | — |
| `cutoff` | string | No | `"09:00"` |

**Response:** `ForecastResponse`
```json
{
  "delivery_date": "2026-01-15",
  "cutoff": "09:00",
  "cutoff_time": "2026-01-14T09:00:00+00:00",
  "points": [
    {
      "settlementPeriod": 1,
      "startTime": "2026-01-15T00:00:00+00:00",
      "forecast_mw": 8450.25,
      "publishTime": "2026-01-14T07:30:00+00:00",
      "horizon_hours": 16.5,
      "risk_band_p90_mw": 6610.25,
      "risk_band_p95_mw": 6100.00
    },
    ...
    // 48 total (SP 1-48)
  ],
  "revisions": [
    {
      "publishTime": "2026-01-14T02:30:00+00:00",
      "startTime": "2026-01-15T00:00:00+00:00",
      "forecast_mw": 8200.00,
      "horizon_hours": 21.5
    },
    ...
  ],
  "p90_buffer_mw": 1840.00,
  "p95_buffer_mw": 2350.00
}
```

**Field Definitions:**
| Field | Description |
|-------|-------------|
| `settlementPeriod` | 1–48 (half-hours, SP1 = 00:00–00:30 UTC) |
| `startTime` | Target delivery period start (UTC) |
| `forecast_mw` | Latest WINDFOR forecast at cutoff (MW) |
| `publishTime` | Model run publication timestamp (UTC) |
| `horizon_hours` | Lead time: `startTime - publishTime` (hours) |
| `risk_band_p90_mw` | `max(0, forecast_mw - p90_buffer_mw)` — safe hedge |
| `risk_band_p95_mw` | `max(0, forecast_mw - p95_buffer_mw)` — high-confidence hedge |
| `revisions` | All earlier forecast runs for the day (fan chart data) |
| `p90_buffer_mw` | 90th percentile of (Forecast - Actual) from prior days |
| `p95_buffer_mw` | 95th percentile — higher confidence |

**Computation Logic:**
1. Filter WINDFOR to `delivery_date` and `publishTime ≤ cutoff_utc`
2. For each of 24 target hours, pick **latest** `publishTime` (argmax)
3. Broadcast hourly → 48 half-hours (same value for SP 2n-1, 2n)
4. Compute expanding-window P90/P95 buffer from **prior delivery days only**
5. If first day (no prior history), fall back to global buffer

**Caching:** In-memory LRU keyed by `forecast_{date}_{cutoff}`

---

### 4. Trading Desk — Actuals

#### `GET /api/actuals`

**Parameters:**
| Name | Type | Required |
|------|------|----------|
| `delivery_date` | string | Yes |

**Response:** `ActualsResponse`
```json
{
  "delivery_date": "2026-01-15",
  "points": [
    {
      "settlementPeriod": 1,
      "startTime": "2026-01-15T00:00:00+00:00",
      "generation_mw": 7890.50
    },
    ...
    // 48 total
  ]
}
```

**Source:** Elexon BMRS `FUELHH` (half-hourly metered generation by fuel type, filtered to WIND).

**Alignment:** Used for back-test overlay on Desk page. For accuracy calculations, actuals are averaged to hourly.

---

### 5. Analytics — Summary

#### `GET /api/accuracy/summary`

**Parameters:**
| Name | Type | Required | Default |
|------|------|----------|---------|
| `cutoff` | string | No | `"09:00"` |

**Response:** `AccuracySummaryResponse`
```json
{
  "cutoff": "09:00",
  "evaluation_window": "2026-01-01 to 2026-01-31 (744 Delivery Hours)",
  "total_delivery_periods": 744,
  "bias_mw": 1840.50,
  "mae_mw": 2100.75,
  "rmse_mw": 2850.30,
  "wape_pct": 18.5,
  "p50_abs_error_mw": 1650.00,
  "p90_abs_error_mw": 4200.00,
  "p95_abs_error_mw": 5100.00,
  "p90_over_forecast_mw": 3800.00,
  "pct_within_10pct": 42.3,
  "mean_actual_mw": 11350.00,
  "mean_forecast_mw": 13190.50,
  "recommended_buffer_p90_mw": 3800.00,
  "recommended_buffer_p95_mw": 4750.00
}
```

**Metric Definitions:**
| Metric | Formula | Interpretation |
|--------|---------|----------------|
| `bias_mw` (MBE) | `mean(forecast - actual)` | **Positive = systematic over-forecast** (desk shortfall risk) |
| `mae_mw` | `mean(|forecast - actual|)` | Average absolute miss magnitude |
| `rmse_mw` | `sqrt(mean((forecast - actual)²))` | Penalizes large outliers quadratically |
| `wape_pct` | `sum(|error|) / sum(actual) * 100` | Volume-weighted relative error |
| `p50_abs_error_mw` | `median(|error|)` | Typical absolute miss |
| `p90_abs_error_mw` | `90th percentile(|error|)` | 90% of hours within this absolute error |
| `p95_abs_error_mw` | `95th percentile(|error|)` | 95% coverage |
| `p90_over_forecast_mw` | `90th percentile(forecast - actual)` | **Key buffer sizing metric** — 90% of shortfalls ≤ this |
| `pct_within_10pct` | `% where |error| ≤ 0.10 × actual` | "Good forecast" rate |
| `recommended_buffer_p90_mw` | `quantile_0.90(forecast - actual)` | Deduct from raw forecast for 90% shortfall protection |
| `recommended_buffer_p95_mw` | `quantile_0.95(forecast - actual)` | Higher confidence (95%) |

**Sign Convention (Critical):**
```
error = forecast - actual
error > 0  → OVER-FORECAST (shortfall, must buy at SBP)
error < 0  → UNDER-FORECAST (surplus, spill at SSP)
```

---

### 6. Analytics — Daily Verification

#### `GET /api/accuracy/daily`

**Parameters:** `cutoff` (string, default `"09:00"`)

**Response:** `DailyAccuracyItem[]` (31 items, one per day)
```json
[
  {
    "delivery_date": "2026-01-01",
    "count": 24,
    "bias": 2100.0,
    "mae": 2200.0,
    "rmse": 2900.0,
    "wape": 19.2,
    "p90_over_forecast": 4100.0,
    "pct_within_10pct": 38.5,
    "recommended_buffer_mw": 0.0
  },
  {
    "delivery_date": "2026-01-02",
    "count": 24,
    "bias": 1800.0,
    "mae": 2000.0,
    "rmse": 2600.0,
    "wape": 17.8,
    "p90_over_forecast": 3600.0,
    "pct_within_10pct": 45.8,
    "recommended_buffer_mw": 3800.0
  },
  ...
]
```

**Key Feature:** `recommended_buffer_mw` uses **expanding window** — for Jan 2, buffer is computed from Jan 1 errors only; for Jan 15, from Jan 1–14. Day 1 has no prior history → `0.0`.

**Sorting:** Frontend supports client-side sort on all columns.

---

### 7. Analytics — By Hour (Diurnal Profile)

#### `GET /api/accuracy/by-hour`

**Parameters:** `cutoff` (string, default `"09:00"`)

**Response:** `HourlyAccuracyItem[]` (24 items, hours 0–23 UTC)
```json
[
  { "hour": 0, "count": 31, "bias": 1500.0, "mae": 1800.0, "rmse": 2400.0, "wape": 16.5, "p90_over_forecast": 3200.0, "pct_within_10pct": 48.0 },
  { "hour": 1, "count": 31, "bias": 1400.0, "mae": 1750.0, "rmse": 2350.0, "wape": 16.0, "p90_over_forecast": 3100.0, "pct_within_10pct": 50.0 },
  ...
  { "hour": 23, "count": 31, "bias": 1900.0, "mae": 2100.0, "rmse": 2800.0, "wape": 18.9, "p90_over_forecast": 3900.0, "pct_within_10pct": 40.0 }
]
```

**Purpose:** Identify intra-day bias patterns (morning ramp, evening peak).

---

### 8. Analytics — By Horizon (Lead Time)

#### `GET /api/accuracy/by-horizon`

**Parameters:** `cutoff` (string, default `"09:00"`)

**Response:** `HorizonAccuracyItem[]` (5 buckets)
```json
[
  { "horizon_bucket": "0-6h", "count": 186, "bias": 800.0, "mae": 1200.0, "rmse": 1600.0, "wape": 10.5, "p90_over_forecast": 2200.0 },
  { "horizon_bucket": "6-12h", "count": 186, "bias": 1400.0, "mae": 1800.0, "rmse": 2400.0, "wape": 15.8, "p90_over_forecast": 3100.0 },
  { "horizon_bucket": "12-24h", "count": 186, "bias": 2000.0, "mae": 2400.0, "rmse": 3100.0, "wape": 21.0, "p90_over_forecast": 4200.0 },
  { "horizon_bucket": "24-48h", "count": 140, "bias": 2500.0, "mae": 2800.0, "rmse": 3600.0, "wape": 24.5, "p90_over_forecast": 5000.0 },
  { "horizon_bucket": "48h+", "count": 46, "bias": 3100.0, "mae": 3300.0, "rmse": 4200.0, "wape": 28.0, "p90_over_forecast": 6100.0 }
]
```

**Purpose:** Quantify forecast degradation with lead time. At 09:00 cutoff, typical horizons are 16–40h (falls in 12-24h and 24-48h buckets).

---

### 9. Analytics — Error Distribution (Histogram)

#### `GET /api/accuracy/distribution`

**Parameters:**
| Name | Type | Required | Default |
|------|------|----------|---------|
| `cutoff` | string | No | `"09:00"` |
| `bin_size_mw` | float | No | `500.0` |

**Response:** `ErrorHistogramItem[]`
```json
[
  { "bin_min": -3000.0, "bin_max": -2500.0, "bin_label": "[-3000, -2500)", "count": 12, "frequency_pct": 1.6 },
  { "bin_min": -2500.0, "bin_max": -2000.0, "bin_label": "[-2500, -2000)", "count": 28, "frequency_pct": 3.8 },
  ...
  { "bin_min": 0.0, "bin_max": 500.0, "bin_label": "[0, 500)", "count": 95, "frequency_pct": 12.8 },
  { "bin_min": 500.0, "bin_max": 1000.0, "bin_label": "[500, 1000)", "count": 134, "frequency_pct": 18.0 },
  ...
  { "bin_min": 5000.0, "bin_max": 5500.0, "bin_label": "[5000, 5500)", "count": 8, "frequency_pct": 1.1 }
]
```

**Visualization:** Bar chart with reference line at zero error. Right tail = over-forecast risk.

---

### 10. Analytics — Full Month Timeseries

#### `GET /api/accuracy/timeseries`

**Parameters:** `cutoff` (string, default `"09:00"`)

**Response:** `TimeseriesPoint[]` (744 items = 31 days × 24 hours)
```json
[
  {
    "startTime": "2026-01-01T00:00:00+00:00",
    "delivery_date": "2026-01-01",
    "hour": 0,
    "forecast_mw": 9200.0,
    "actual_mw": 7800.0,
    "error_mw": 1400.0,
    "p90_buffer_mw": 3800.0,
    "p90_hedge_mw": 5400.0
  },
  ...
]
```

**Purpose:** Brush-zoomable month-wide trajectory chart. Includes P90 hedge line for visual risk band.

**Fields:**
| Field | Description |
|-------|-------------|
| `forecast_mw` | Day-ahead forecast at cutoff |
| `actual_mw` | FUELHH outturn (hourly mean) |
| `error_mw` | `forecast - actual` |
| `p90_buffer_mw` | Global P90 buffer (constant across month) |
| `p90_hedge_mw` | `max(0, forecast_mw - p90_buffer_mw)` — safe bid volume |

---

## Frontend Hook Mapping (`frontend/src/api/hooks.ts`)

| Hook | Endpoint | Parameters | Returns |
|------|----------|------------|---------|
| `useMeta()` | `/meta` | — | `MetaResponse` |
| `useForecast(date, cutoff)` | `/forecast` | `delivery_date`, `cutoff` | `ForecastResponse` |
| `useActuals(date)` | `/actuals` | `delivery_date` | `ActualsResponse` |
| `useAccuracySummary(cutoff)` | `/accuracy/summary` | `cutoff` | `AccuracySummaryResponse` |
| `useAccuracyDaily(cutoff)` | `/accuracy/daily` | `cutoff` | `DailyAccuracyItem[]` |
| `useAccuracyByHour(cutoff)` | `/accuracy/by-hour` | `cutoff` | `HourlyAccuracyItem[]` |
| `useAccuracyByHorizon(cutoff)` | `/accuracy/by-horizon` | `cutoff` | `HorizonAccuracyItem[]` |
| `useAccuracyDistribution(cutoff, binSize)` | `/accuracy/distribution` | `cutoff`, `bin_size_mw` | `ErrorHistogramItem[]` |
| `useAccuracyTimeseries(cutoff)` | `/accuracy/timeseries` | `cutoff` | `TimeseriesPoint[]` |

**All hooks use `@tanstack/react-query` with:**
- `refetchOnWindowFocus: false`
- `retry: 1`
- Stale time: default (0) — refetches on parameter change

---

## Data Flow Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Elexon     │────▶│  Ingest     │────▶│  DataRepository  │
│  BMRS API   │     │  (CSV/GZ)   │     │  (pandas DataFrame)│
└─────────────┘     └─────────────┘     └────────┬─────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    ▼                             ▼                             ▼
            ┌───────────────┐             ┌───────────────┐             ┌───────────────┐
            │  /forecast    │             │  /actuals     │             │  /accuracy/*  │
            │  (Trading)    │             │  (Back-test)  │             │  (Analytics)  │
            └───────┬───────┘             └───────┬───────┘             └───────┬───────┘
                    │                             │                             │
                    ▼                             ▼                             ▼
            ┌─────────────────────────────────────────────────────────────────────┐
            │                        Analytics Engine (analytics.py)              │
            │  latest_forecast_at_cutoff  │  compute_errors  │  calculate_metrics │
            │  forecast_revisions         │  aggregate_*     │  recommended_buffer│
            └─────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Notes

### Vercel (Single Project)
- `api/index.py` → FastAPI app with `Mangum` adapter
- `vercel.json` rewrites: `/api/:path*` → `api/index.py`
- Frontend: Vite build output → `/dist` served as static

### Local Development
```bash
# Backend
cd backend && uvicorn app.api:app --reload --port 8000

# Frontend
cd frontend && npm run dev  # proxies /api to localhost:8000
```

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Frontend API base | `/api` |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-10-26 | Initial production API with 10 endpoints, full January 2026 evaluation |

---

*Generated from `backend/app/api.py` and `backend/app/schemas.py`*