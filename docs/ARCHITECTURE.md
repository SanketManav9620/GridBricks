# System Architecture & Data Flow

This document details the architectural design, data processing pipeline, and technical specifications for the **UK Wind Power Trading Desk** decision-support platform.

---

## 1. High-Level Architecture Overview

The system is organized into a clean, layered architecture with strict separation of concerns, zero business logic in the view layer, and mathematically pure domain analytics.

```mermaid
flowchart TD
    subgraph External["External Data Source"]
        ELEXON["Elexon Insights API (BMRS)<br/>- FUELHH (Wind Generation Actuals)<br/>- WINDFOR (Wind Generation Forecasts)"]
    end

    subgraph Ingestion["Ingestion & Persistence"]
        CLIENT["elexon_client.py<br/>(httpx, exponential backoff, UTC normalizer)"]
        CLI["ingest.py CLI<br/>(Deduplication, drop invalid rows)"]
        SNAPSHOTS[("backend/data/<br/>actuals_snapshot.csv.gz<br/>forecasts_snapshot.csv.gz")]
    end

    subgraph BackendEngine["Backend Core (FastAPI)"]
        REPO["repository.py Singleton<br/>(In-memory cached DataFrames, fallback fetch)"]
        ANALYTICS["analytics.py (Pure Pandas)<br/>- compute_decision_cutoff (D-1 gate)<br/>- latest_forecast_at_cutoff (no lookahead)<br/>- forecast_revisions<br/>- compute_errors (hourly / half-hourly)<br/>- calculate_metrics (Bias, MAE, RMSE, WAPE)<br/>- recommended_buffer (P90 expanding window)"]
        API["api.py (FastAPI Routes)<br/>- In-memory response caching<br/>- Pydantic schema validation<br/>- OpenAPI docs (/docs)"]
    end

    subgraph FrontendApp["Frontend Client (Vite + React + TS)"]
        CLIENT_API["api.ts (Typed Fetch Client)"]
        QUERY["TanStack Query (Client cache & deduping)"]
        DESK["Day-Ahead Desk Page<br/>(Decision gate, revisions, risk band)"]
        ACCURACY["Accuracy Backtest Page<br/>(Metrics KPIs, histogram, hour & horizon analysis)"]
        METHOD["Methodology Page<br/>(Definitions, gate formulas, assumptions)"]
    end

    ELEXON -->|HTTP REST Chunked Requests| CLIENT
    CLIENT --> CLI
    CLI -->|Write Gzipped CSV| SNAPSHOTS
    SNAPSHOTS -->|Load on Startup| REPO
    CLIENT -.->|Optional Live Fallback| REPO
    REPO --> ANALYTICS
    ANALYTICS --> API
    API -->|JSON REST with CORS| CLIENT_API
    CLIENT_API --> QUERY
    QUERY --> DESK
    QUERY --> ACCURACY
    QUERY --> METHOD
```

---

## 2. Core Subsystems

### 2.1 Ingestion Layer (`backend/app/elexon_client.py`, `backend/app/ingest.py`)
- **HTTP Transport**: Built with `httpx` supporting connection pooling, timeout budgets (15s default), and exponential backoff retry strategies (up to 3 retries with jitter).
- **Date Chunking**: Elexon API restricts date ranges to 7 days per call. The client automatically chunks multi-week date intervals into 1-day windows to prevent gateway timeouts.
- **Timestamp Normalization**: All incoming ISO-8601 timestamps are parsed and converted to timezone-aware UTC (`datetime.timezone.utc`).
- **Compact Persistence**: Ingested datasets are saved as compressed CSV (`.csv.gz`) files in `backend/data/`. This keeps repository footprint minimal (~1.5 MB total for >100,000 rows) while allowing rapid in-memory decompression.

### 2.2 Domain Analytics Engine (`backend/app/analytics.py`)
All analytics functions are implemented as pure, side-effect-free, fully typed Pandas routines:
1. **Decision Gate Cutoff (`compute_decision_cutoff`)**:
   - Converts delivery date $D$ to trading day $D-1$.
   - Computes cutoff time in `Europe/London` timezone (e.g. 09:00 or 11:00 London time) and normalizes to UTC, accounting for British Summer Time (BST) transitions.
2. **Latest Forecast at Cutoff (`latest_forecast_at_cutoff`)**:
   - Strictly enforces the auction gate constraint:
     $$\text{publishTime} \le \text{cutoff}_{\text{UTC}}$$
   - Filters target day delivery periods and selects the row with the maximum `publishTime` per settlement period.
   - Prevents lookahead bias by discarding any forecast published after the auction gate.
3. **Forecast Revisions (`forecast_revisions`)**:
   - Extracts all preceding forecast iterations published prior to the gate to visualize forecast trajectory and volatility.
4. **Error Modeling (`compute_errors`)**:
   - Calculates half-hourly and hourly forecast error:
     $$\text{Error}_t = \text{Forecast}_t - \text{Actual}_t$$
   - Handles positive errors (over-forecasting) and negative errors (under-forecasting).
5. **Statistical Metrics (`calculate_metrics`)**:
   - **Bias (Mean Error)**: $\frac{1}{N} \sum (\text{Forecast} - \text{Actual})$
   - **Mean Absolute Error (MAE)**: $\frac{1}{N} \sum |\text{Forecast} - \text{Actual}|$
   - **Root Mean Squared Error (RMSE)**: $\sqrt{\frac{1}{N} \sum (\text{Forecast} - \text{Actual})^2}$
   - **Weighted Absolute Percentage Error (WAPE)**: $\frac{\sum |\text{Forecast} - \text{Actual}|}{\sum \text{Actual}} \times 100\%$
   - **P90 Over-Forecast Error**: 90th percentile of $\max(\text{Forecast} - \text{Actual}, 0)$
6. **Expanding-Window Safety Buffer (`recommended_buffer_expanding_window`)**:
   - Sizing the safety band for day $D$ using strictly past days $[D_{start}, D-1]$.
   - Guarantees true out-of-sample backtesting without future information leakage.

### 2.3 Application & API Layer (`backend/app/api.py`, `backend/app/repository.py`)
- **Repository Singleton**: Thread-safe in-memory cache loaded once on application startup.
- **REST API Endpoints**:
  - `GET /api/health`: Service health and uptime status.
  - `GET /api/meta`: Available delivery dates, default cutoff, and dataset version metadata.
  - `GET /api/forecast`: 48 half-hourly delivery periods with latest forecast, horizon, earlier revision history, and asymmetric P90 risk bands.
  - `GET /api/actuals`: Realized actual generation for post-auction backtesting.
  - `GET /api/accuracy/summary`: High-level desk KPIs across the entire month.
  - `GET /api/accuracy/daily`: Day-by-day error metrics with expanding buffer tracking.
  - `GET /api/accuracy/by-hour`: Diurnal intraday performance across 24 settlement hours.
  - `GET /api/accuracy/by-horizon`: Accuracy degradation aggregated across forecast horizons (0-6h, 6-12h, 12-24h, 24-48h, 48h+).
  - `GET /api/accuracy/distribution`: Error histogram frequency distribution (500 MW bins).
- **In-Memory Query Cache**: 5-minute TTL cache on parameterized analytics requests for sub-10ms response times.

### 2.4 Frontend Layer (`frontend/src/`)
- **Vite + React 18 + TypeScript**: Strict type safety end-to-end matching backend Pydantic schemas.
- **State Management**: TanStack Query (`@tanstack/react-query`) handles automated background caching, deduplication, and refetching.
- **Visualization**: Recharts composable charts styled with custom tooltips, reference lines, and responsive SVG containers.
- **Design System**: Vanilla CSS and Tailwind CSS using a dark navy palette (`#0a0f1d`), teal primary (`#14b8a6`), amber risk accent (`#f59e0b`), and clean 8px spacing grid.

---

## 3. Data Flow Progression

```mermaid
sequenceDiagram
    autonumber
    actor Trader as Day-Ahead Trader
    participant UI as React Frontend
    participant API as FastAPI Backend
    participant Repo as Data Repository
    participant Engine as Analytics Engine

    Trader->>UI: Selects Delivery Date (e.g. 2026-01-15) & Cutoff (09:00)
    UI->>API: GET /api/forecast?delivery_date=2026-01-15&cutoff=09:00
    API->>Repo: get_forecasts() & get_actuals()
    Repo-->>API: Filtered cached DataFrames
    API->>Engine: latest_forecast_at_cutoff(forecasts, '2026-01-15', '09:00')
    Engine-->>API: 48-period series with max publishTime <= D-1 09:00 London
    API->>Engine: recommended_buffer(errors_up_to_D_minus_1, quantile=0.9)
    Engine-->>API: Sized buffer MW (e.g. 1,840 MW)
    API-->>UI: ForecastResponse (48 points, risk bands, revision trajectories)
    UI-->>Trader: Renders Interactive Chart, Risk Bands & Downloadable Settlement Table
```

---

## 4. Deployment Architecture

```mermaid
flowchart LR
    subgraph DockerEnv["Docker Compose Production Setup"]
        NGINX["Nginx Web Server<br/>(Port 3000 / 80)<br/>- Static SPA Asset Server<br/>- Gzip compression<br/>- Reverse Proxy /api -> Backend:8000"]
        FASTAPI["FastAPI Uvicorn Server<br/>(Port 8000)<br/>- Python 3.11 Slim<br/>- Non-root user 'appuser'<br/>- Healthcheck probe"]
        NGINX -->|Reverse Proxy /api/| FASTAPI
    end

    subgraph Browser["Client Browser"]
        USER["Energy Trading Desk User"]
        USER -->|HTTP :3000| NGINX
    end
```

- **Containerization**: Multi-stage Docker builds reduce image sizes and isolate build dependencies.
- **Security**: Backend runs as unprivileged user (`appuser`, UID 10001); Nginx handles security headers (`X-Frame-Options`, `X-Content-Type-Options`).
- **Zero-Dependency Cold Start**: Pre-packaged CSV.gz data snapshots ensure the container starts in under 2 seconds without requiring external network connectivity during boot.
