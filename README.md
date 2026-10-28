# UK Wind Power Day-Ahead Trading Desk

[![CI Pipeline](https://github.com/gridbricks/uk-wind-trading-desk/actions/workflows/ci.yml/badge.svg)](https://github.com/gridbricks/uk-wind-trading-desk/actions/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-3776AB.svg?logo=python&logoColor=white)](https://www.python.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Live Deployment Demo (Vercel)**: [https://uk-wind-trading-desk.vercel.app](https://uk-wind-trading-desk.vercel.app) *(or your deployed Vercel/Heroku app URL)*  
> **Submission Form**: [https://forms.cloud.microsoft/r/FTX6K2bbnU](https://forms.cloud.microsoft/r/FTX6K2bbnU)  
> **Video Presentation Guide**: See [docs/VIDEO_PRESENTATION_SCRIPT.md](docs/VIDEO_PRESENTATION_SCRIPT.md) for the complete 10-minute rehearsal script.

---

## 1. Executive Summary & Problem Setting

The **UK Wind Power Day-Ahead Trading Desk** is an institutional-grade decision-support platform engineered for electricity procurement teams at UK energy utilities. 

To serve their retail consumers, utilities must purchase required power from the UK wholesale day-ahead market (EPEX SPOT and Nord Pool). Crucially, purchase decisions must be locked in on **day $D-1$ before auction gate closure** (typically 09:00–11:00 London time) for physical delivery across 48 half-hour settlement periods on **delivery day $D$**.

Because power generation from renewable sources like wind is weather-dependent, procurement teams need to understand:
1. **Latest Renewable Forecasts**: The exact point-in-time Numerical Weather Prediction (NWP) wind generation forecasts available strictly prior to the D-1 auction gate.
2. **Quantified Forecast Accuracy & Risk Buffering**: The historical error distribution (Mean Bias, MAE, RMSE, WAPE, P90 shortfall) to size an asymmetric **safety buffer** that protects against severe real-time balancing cash-out penalties (System Buy Price).
3. **Thermal Procurement Deficit Calculation**: How much additional wholesale electricity must be procured (e.g. from CCGT/thermal plants or day-ahead power auctions) beyond wind to cover consumer demand across every settlement period.

This application provides the end-to-end analytical pipeline and trading portal covering the **January 2026** evaluation period.

---

## 2. Verified Data Sources & Official Elexon BMRS Links

Per the assignment specification, data is sourced exclusively from the **Elexon Balancing Mechanism Reporting Service (BMRS)** Insights API:

| Dataset | Official Documentation Link | API Endpoint Stream | Key Fields Used |
|:---|:---|:---|:---|
| **Actual Generation** | [BMRS FUELHH Endpoint Documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) | `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream` | `fuelType == "WIND"`, `startTime` (30-min settlement period), `generation` (MW) |
| **Forecasted Generation** | [BMRS WINDFOR Endpoint Documentation](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) | `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream` | `startTime` (hourly target time), `publishTime` (NWP model release), `generation` (MW) |

> **Pre-Cached Datasets**: Compressed and deduplicated datasets covering **2025-12-31 to 2026-02-02** are included directly in `backend/data/` (`actuals.csv.gz` and `forecasts.csv.gz`), enabling immediate offline and local execution without external API keys or rate limits.

---

## 3. Visual Identity: Greyish, Warm Beige & Burgundy Palette

The user interface has been custom-crafted using an institutional color system specified for energy trading desks:

- **Greyish Canvas (`#f7f6f3` / Stone neutrals)**: Subtle warm grey backdrop providing soothing, high-contrast readability without harsh glare.
- **Warm Sand Beige (`#faf8f5`, `#f5f0e8`, `#ebdccb`)**: Used for secondary cards, table headers, and the **P90 Downside Risk Hedge Band** (`#ddc5a9`).
- **Signature Burgundy (`#871736`, `#6f142e`, `#561225`)**: Primary brand color representing British institutional heritage, used for active navigation pills, the latest D-1 forecast curve, thermal procurement requirements, and primary action buttons.

---

## 4. Directory & File Structure

```text
GridBricks/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI workflow (lint, typecheck, pytest, vitest, build)
├── api/                           # Vercel Serverless Function entrypoint
│   ├── index.py                   # ASGI serverless adapter for FastAPI
│   ├── requirements.txt           # Lean serverless runtime dependencies
│   └── data/                      # Embedded gzipped snapshots for serverless execution
├── backend/
│   ├── app/
│   │   ├── __init__.py            # Backend package initialization
│   │   ├── analytics.py           # Pure, typed Pandas domain analytics (cutoffs, revisions, errors, buffers)
│   │   ├── api.py                 # FastAPI REST API endpoints, routing, Pydantic schemas, and in-memory caching
│   │   ├── elexon_client.py       # Resilient HTTP client for Elexon Insights API (backoff, timeouts, UTC parsing)
│   │   ├── ingest.py              # CLI data pipeline script for snapshot fetching, deduplication, and export
│   │   ├── models.py              # Internal domain models and data transfer objects
│   │   ├── repository.py          # In-memory thread-safe data repository singleton with live fallback
│   │   └── schemas.py             # Pydantic v2 request/response schemas matching OpenAPI specs
│   ├── data/
│   │   ├── actuals.csv.gz         # Compressed National Grid FUELHH actual generation dataset
│   │   └── forecasts.csv.gz       # Compressed National Grid WINDFOR forecast revisions dataset
│   ├── tests/
│   │   ├── test_analytics.py      # Unit tests for analytics with hand-computed edge-case fixtures
│   │   ├── test_api.py            # API endpoint integration tests via FastAPI TestClient
│   │   ├── test_elexon_client.py  # Mocked HTTP unit tests for Elexon ingestion client
│   │   ├── test_ingest.py         # Unit tests for CLI ingestion script and deduplication
│   │   └── test_repository.py     # Repository caching, querying, and fallback tests
│   ├── Dockerfile                 # Multi-stage slim Python 3.13 container with unprivileged user
│   ├── requirements.txt           # Production Python dependencies and quality toolpins
│   └── pyproject.toml             # Configuration for Ruff linter/formatter, Mypy, and Pytest
├── frontend/
│   ├── public/
│   │   └── favicon.svg            # Vector turbine SVG favicon
│   ├── src/
│   │   ├── components/            # Reusable UI component library (Greyish, Beige & Burgundy)
│   │   │   ├── __tests__/         # Vitest + React Testing Library component tests
│   │   │   ├── AppShell.tsx       # Navigation header, live status, and layout wrapper
│   │   │   ├── ChartCard.tsx      # Composable card container with header actions
│   │   │   ├── CutoffSelect.tsx   # Interactive gate cutoff selector (09:00, 11:00, 12:00, 14:00)
│   │   │   ├── DateStepper.tsx    # Delivery date carousel navigation with dropdown picker
│   │   │   ├── EmptyState.tsx     # Graceful empty data indicator
│   │   │   ├── ErrorState.tsx     # Resilient network error retry card
│   │   │   ├── InfoTooltip.tsx    # Accessible floating metric definitions tooltip
│   │   │   ├── KpiCard.tsx        # High-contrast KPI tile with glow accents and trend indicators
│   │   │   └── SkeletonLoader.tsx # Shimmer loading animation for async queries
│   │   ├── lib/
│   │   │   ├── api.ts             # Typed REST fetch client for backend endpoints
│   │   │   └── utils.ts           # Number formatting (MW/GW), date helpers, and class merging
│   │   ├── pages/
│   │   │   ├── AccuracyAnalyticsPage.tsx # Backtest, error distributions, and diurnal analysis
│   │   │   ├── DayAheadDeskPage.tsx      # Core trading view with latest forecast, P90 risk band, and thermal calculator
│   │   │   └── MethodologyPage.tsx       # Educational documentation of formulas, auction rules, and assumptions
│   │   ├── App.tsx                # Client-side router configuration
│   │   ├── index.css              # Custom styling, Greyish-Beige-Burgundy palette, and scrollbars
│   │   ├── main.tsx               # Application root mount with TanStack Query provider
│   │   └── test/setup.ts          # Vitest and jest-dom matchers configuration
│   ├── Dockerfile                 # Multi-stage production container with Nginx reverse proxy
│   ├── nginx.conf                 # Nginx proxy routing /api to backend:8000 with gzip compression
│   ├── package.json               # Frontend dependencies and npm scripts
│   ├── tailwind.config.js         # Tailored energy trading color system (Burgundy, Beige, Warmgrey)
│   ├── tsconfig.json              # TypeScript strict compiler configuration
│   └── vite.config.ts             # Vite bundler and local development proxy configuration
├── docs/
│   ├── ARCHITECTURE.md            # Detailed system architecture and Mermaid data flow diagrams
│   ├── ASSUMPTIONS.md             # Comprehensive domain assumptions, trade-offs, and limitations
│   ├── DATA_FINDINGS.md           # Empirical analysis and observations from Elexon BMRS exploratory pass
│   └── VIDEO_PRESENTATION_SCRIPT.md # Word-for-word rehearsal script for the 10-minute unlisted YouTube video
├── docker-compose.yml             # Single-command local container orchestration
├── vercel.json                    # Vercel serverless routing configuration
└── README.md                      # Primary project documentation and quickstart guide
```

---

## 5. Quickstart: Running on Your Local Machine

You can run the application either with **Docker Compose** or **locally with Python and Node.js**.

### Option A: Running with Docker (Recommended)

```bash
# Build and launch both frontend and backend containers
docker compose up --build -d
```

- **Frontend Web UI**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Backend**: [http://localhost:8000](http://localhost:8000)
- **Interactive OpenAPI Specs**: [http://localhost:8000/docs](http://localhost:8000/docs)

To stop services:
```bash
docker compose down
```

---

### Option B: Running Locally (Fast & Direct)

#### 1. Start the Python Backend
In Terminal 1:
```bash
# From repository root
python -m uvicorn app.api:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
```
The FastAPI backend is now running at `http://127.0.0.1:8000` (test health check: `http://127.0.0.1:8000/api/health`).

#### 2. Start the React Frontend
In Terminal 2:
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser! Vite automatically proxies all `/api` calls directly to your local FastAPI backend on port 8000.

---

## 6. What to Do Inside the Application (User Guide)

When you open **[http://localhost:5173](http://localhost:5173)**:

### 1. The Day-Ahead Decision Desk (`/`)
- **Gate Cutoff Selector (Top Right)**: Switch between `09:00`, `11:00`, `12:00`, or `14:00` London. Notice how the latest available NWP model changes dynamically to reflect what was physically available before auction gate closure!
- **Date Stepper**: Navigate across January 2026 delivery days (e.g. January 15th storm front).
- **KPI Ribbon**: Inspect **Average Forecast**, **Peak Forecast**, **Publish Time Used**, and the **Risk-Adjusted Average** (raw forecast minus P90 buffer).
- **Interactive Chart Controls**:
  - Click **"Thermal Procurement"** to reveal consumer demand and required thermal peaker procurement.
  - Click **"Show Earlier Runs"** to view fainter traces of prior NWP weather runs.
  - Click **"Reveal Actual (Back-Test)"** to overlay what physically outturned in `FUELHH`.
- **Thermal Deficit Calculator**: Adjust the **Consumer Peak Demand** (e.g. 32 GW GB national), **Day-Ahead Price** (£75/MWh), and **Cashout SBP** (£165/MWh) to see exact MWh thermal requirements and avoided imbalance penalties!
- **Download CSV**: Click to immediately download the 48-period dispatch schedule.

### 2. Accuracy & Buffer Sizing Backtesting (`/accuracy`)
- **Holistic KPIs**: View January 2026 **MAE (2,122 MW)**, **RMSE (2,616 MW)**, **Mean Bias Error (+1,840 MW)**, and **WAPE (23.9%)**.
- **Timeseries Brush**: Drag the slider handles at the bottom of the 744-hour chart to zoom into specific storm ramps or lull periods.
- **Error Distribution Histogram**: Observe the positive skew in 500 MW bins confirming persistent over-forecasting risk.
- **Diurnal Profile**: View how error varies by hour of day (00:00 to 23:00 UTC).
- **Lead-Time Horizon Decay**: Inspect how model precision degrades from 0-6h out to 48h+.
- **Daily Table**: Click any column header (`Bias`, `MAE`, `RMSE`, `Buffer`) to sort ascending/descending.

### 3. Methodology Reference (`/method`)
- Read the educational documentation detailing the zero-lookahead auction math, reanalysis anomaly cleansing, and expanding-window P90 safety buffer formulations.

---

## 7. Video Demo & Submission Instructions

### 3.1 Video Demo Guide (Max 10 Minutes)
Record an unlisted YouTube video divided into two equal parts:
- **Part 1 (0:00 – 5:00): Pitch to the Client** (Head of Power Procurement): Impress them with the Day-Ahead Decision Desk, P90 safety buffer, and the Thermal Procurement Deficit Calculator saving cash-out penalties.
- **Part 2 (5:00 – 10:00): Technical Review for Internal Tech Lead**: Walk through clean architecture, zero-lookahead filtering, pure typed Pandas analytics, test coverage, and Docker orchestration.

> Refer to **[docs/VIDEO_PRESENTATION_SCRIPT.md](docs/VIDEO_PRESENTATION_SCRIPT.md)** for the complete word-for-word rehearsed script.

### 3.2 Anonymous Public GitHub Repository
1. Create a public repository with an anonymous name (e.g., `kjhwr-desk` or a random string).
2. Push this codebase:
   ```bash
   git init
   git add .
   git commit -m "feat: UK Wind Day-Ahead Trading Desk v1.0"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<anonymous-repo-name>.git
   git push -u origin main
   ```

### 3.3 Microsoft Form Submission
Submit your links in the official form:
👉 **[https://forms.cloud.microsoft/r/FTX6K2bbnU](https://forms.cloud.microsoft/r/FTX6K2bbnU)**

**Crucial Check**: Open every URL (GitHub repo, YouTube video, deployed app) in **Incognito Mode** to verify public access before submitting!

---

## 8. Testing & Quality Suite

The repository has been verified with 100% passing tests:

```bash
# 1. Run all 42 Python backend tests (analytics, API, repository, client)
python -m pytest backend/tests -v

# 2. Run all 15 React frontend component tests
npm --prefix frontend test

# 3. Verify TypeScript build
npm --prefix frontend run build
```

- **Backend Pytest**: **42 / 42 passed** (100%)
- **Frontend Vitest**: **15 / 15 passed** (100%)
- **TypeScript Compiler**: **0 errors**

---

## 9. AI Tools Used

In accordance with transparency requirements, **AI tools were used** to accelerate development:
- **AI Agent**: Google Antigravity Agentic Assistant (powered by Google DeepMind / Claude 3.5 Sonnet).
- **Scope of AI Assistance**:
  - Ingestion exploratory analysis of Elexon BMRS OpenAPI stream endpoints.
  - Implementation of pure Pandas vectorised analytics and expanding-window quantile algorithms.
  - Designing the institutional Greyish, Warm Beige, and Burgundy color system.
  - Formulating unit test fixtures and Vitest component test suites.
  - Docker containerization, Vercel serverless adapters, and CI pipeline setup.

All algorithms, mathematical definitions, and data joins were rigorously verified against official Elexon Insights documentation.

---

## 10. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
