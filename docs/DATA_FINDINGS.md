# Elexon Data Exploration & Domain Findings

This document summarizes the quantitative and architectural findings from exploring the Elexon Insights Solution (BMRS) actual wind outturn (`FUELHH`) and forecast (`WINDFOR`) streaming endpoints for the evaluation window **2025-12-31 to 2026-02-02** (covering all January 2026 day-ahead trading decisions).

---

## 1. OpenAPI Specification & Endpoint Contracts

The OpenAPI definition for the Insights Solution was verified via the Azure API Management Developer Portal:
- **Base URL**: `https://data.elexon.co.uk/bmrs/api/v1` (Public, no API key required).
- **APIM Spec Resource**: `https://developer.data.elexon.co.uk/developer/apis/prod-insol-insights-api?api-version=2022-04-01-preview`

### Query Parameter Contracts
| Endpoint | Supported Query Parameters | Return Grain | Notes |
| :--- | :--- | :--- | :--- |
| **`GET /datasets/FUELHH/stream`** | `settlementDateFrom` (`yyyy-MM-dd`)<br>`settlementDateTo` (`yyyy-MM-dd`)<br>`fuelType` (`WIND`)<br>*(or `publishDateTimeFrom`/`To`)* | Half-hourly (30-min) | Returns actual outturn generation in average MW per 30-min settlement period. Filtering by `fuelType=WIND` directly restricts payload to national wind. |
| **`GET /datasets/WINDFOR/stream`** | `publishDateTimeFrom` (ISO 8601 UTC)<br>`publishDateTimeTo` (ISO 8601 UTC) | **Hourly (60-min)** | **Crucial finding**: There is **no target time filter** (`startTimeFrom`/`startTimeTo`). The endpoint filters strictly by publication timestamp. |

---

## 2. Dataset Characteristics (2025-12-31 to 2026-02-02)

### A. FUELHH (Actual Generation)
- **Total Records**: 1,632 rows ($34\text{ days} \times 48\text{ settlement periods/day} = 1,632$).
- **Data Completeness**:
  - Missing intervals in 30-min grid: **0 (100% complete)**.
  - Null count: **0 (0.00%)** across all columns.
  - Duplicate rows / startTimes: **0**.
- **Unit Sanity (MW)**:
  - Minimum Generation: **1,695.00 MW**
  - Maximum Generation: **17,805.00 MW**
  - Mean Generation: **11,443.04 MW**
  - Median Generation: **11,725.50 MW**
  - Negative values: **0**; Exceedances (>35 GW): **0**.
  - All values align with Great Britain's installed transmission wind fleet capacity (~30 GW).

### B. WINDFOR (Forecast Generation)
- **Total Records Pulled**: 19,856 rows across 272 publication batches.
- **Data Completeness**:
  - Null count: **0 (0.00%)**.
  - Duplicate `(startTime, publishTime)` pairs: **0**.
- **Target Time Resolution**:
  - **100% of rows have `startTime.minute == 0`**. WINDFOR forecasts are provided strictly at **1-hour resolution**, not half-hourly.
- **Versions per Target Timestamp**:
  - Unique target delivery hours: 865.
  - Number of forecast updates per target hour: Min 8, Median 24, Mean 22.95, Max 32.
- **Forecast Horizon ($startTime - publishTime$)**:
  - Range: $-25.5\text{ hours}$ to $+66.5\text{ hours}$ (up to 2.8 days forward).
  - Horizon quantiles: p25 = 3.5h, p50 = 21.5h, p75 = 39.5h, p90 = 51.5h.

---

## 3. Key Discoveries & Surprises

### 1. Resolution Mismatch: Hourly Forecasts vs. Half-Hourly Actuals
- **The Reality**: The UK Balancing Mechanism and settlement system operates on half-hourly settlement periods (48 per day). However, National Grid ESO's `WINDFOR` feed is published on **hourly intervals** (`:00`).
- **Desk Impact**: To evaluate accuracy and size buffers, the desk must adopt a transparent alignment policy:
  - **Method A (Hourly Aggregation)**: Average the two half-hourly actual outturn periods into a single hourly average ($HH_1 + HH_2)/2$.
  - **Method B (Half-Hourly Broadcast)**: Map each hourly forecast to both constituent settlement periods (`:00` and `:30`).
  - *Both methods preserve total energy (MWh), but Method A isolates meteorological model error from sub-hourly within-hour ramps.*

### 2. Negative Forecast Horizons: Retrospective Re-Analysis Rows (20.55% of WINDFOR)
- **The Surprise**: 4,081 out of 19,856 rows (20.55%) have `publishTime > startTime` (negative horizons up to -25.5 hours).
- **The Cause**: When National Grid ESO publishes a model update, the payload includes model "nowcasts" and retrospective re-analysis points covering the preceding ~24 hours.
- **Trading Rule**: Any row where `publishTime >= startTime` must be filtered out for trading desk analytics. A day-ahead decision must strictly condition on **forward-looking** forecasts.

### 3. Rigid Publication Cadence & Auction Cutoff Mechanics
- **Cadence**: WINDFOR updates are published ~8 times per day at predictable times: **02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, and 22:30 UTC**.
- **Auction Timing**: The UK day-ahead power auction closes at **11:00 or 12:00 UTC on D-1**.
  - If gate closure is **11:00 UTC**, the latest available forecast run was published at **09:30 UTC** (lead time to delivery day D is 14.5h to 38.5h).
  - If gate closure is **12:00 UTC**, the **11:30 UTC** run is available.
  - The application backend must let the trader toggle or verify the exact decision gate time.

### 4. Significant Over-Forecasting Bias in January 2026
Evaluating the day-ahead desk information set (latest forecast available at D-1 11:00 UTC for all 744 hours of January 2026):
- **Mean Bias Error (MBE = Forecast - Actual)**: **+1,840.30 MW** (+15.89% of mean actual generation).
- **Mean Absolute Error (MAE)**: **2,122.81 MW** (18.33% of mean actual generation).
- **Root Mean Squared Error (RMSE)**: **2,616.69 MW**.
- **Extreme Errors**:
  - Max Over-forecast: **+6,833.00 MW** (model anticipated 20,400 MW; actual outturn was only 13,567 MW).
  - Max Under-forecast: **-4,128.00 MW**.

### 5. Quantitative Safety Buffer Implications
In day-ahead electricity trading, selling forecasted volume that does not materialize forces the utility into the balancing mechanism at penalty cash-out prices (System Buy Price):
- **Unadjusted Trading**: Bidding 100% of the raw wind forecast would have resulted in an average energy shortfall of **1,840 MW every hour** across January 2026.
- **Empirical Safety Buffers**:
  - To cover generation shortfalls with **90% confidence**, the trading desk needs a safety deduction buffer of **4,312.40 MW**.
  - To cover with **95% confidence**, the desk needs a buffer of **5,418.53 MW**.
- This strongly validates the desk's requirement for quantitative accuracy and quantile-based buffer sizing tools.

---

## 4. Architectural Recommendations for Next Steps

1. **ETL & Data Pipeline**:
   - Ingest `FUELHH` and `WINDFOR` streams and persist to SQLite / parquet / fast in-memory store in the FastAPI backend.
   - Index by `(startTime, publishTime)`.
2. **Point-in-Time Query Engine**:
   - Provide a function `get_latest_forecast(target_date, decision_time)` that strictly filters `publishTime <= decision_time` to eliminate look-ahead bias.
3. **Analytics Engine**:
   - Support both hourly resolution (aggregated actuals) and half-hourly broadcast.
   - Compute error distributions, MAE, RMSE, MBE, and quantile buffers (P50, P80, P90, P95, P99).
