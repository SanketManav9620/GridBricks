# Unlisted YouTube Video Presentation Guide & Script
## UK Wind Power Day-Ahead Trading Desk (January 2026)

This guide provides a professional, rehearsed script for your **10-minute unlisted YouTube video submission**, split exactly into two 5-minute halves:
- **Part 1 (0:00 – 5:00): Client Pitch to the Energy Utility Trading Team**
- **Part 2 (5:00 – 10:00): Internal Technical Lead Architecture & Code Review**

---

## Preparation Checklist Before Recording
1. **Screen Resolution**: Set display to 1080p (1920x1080) with 100% or 110% scaling for razor-sharp visibility.
2. **Browser Window**: Open `http://localhost:5173` in Chrome/Edge. Ensure browser bookmarks bar is clean or hidden (`Ctrl+Shift+B`).
3. **Tabs to Have Ready**:
   - Tab 1: `http://localhost:5173` (Day-Ahead Decision Desk)
   - Tab 2: `http://localhost:5173/accuracy` (Accuracy & Buffer Sizing)
   - Tab 3: `http://localhost:5173/method` (Methodology Reference)
   - Tab 4: VS Code / IDE displaying the project root, `backend/app/analytics.py`, and test suite.
4. **Recording Tool**: OBS Studio, Loom, or Zoom ("Record to this computer"). Record system audio + clear microphone.

---

# Part 1: Client Pitch (Max 5 Minutes)
**Target Persona**: Head of Wholesale Power Trading & Portfolio Optimization at a UK Energy Utility  
**Core Objective**: Demonstrate how GridBricks prevents millions in imbalance cash-out penalties while providing clear thermal procurement guidance for January 2026.

---

### Minute 0:00 – 1:00 | Problem Context & Executive Introduction
> *"Good morning, and thank you for having us. Today, we are thrilled to present the results of our pilot project designed specifically for your wholesale day-ahead electricity trading desk.*
>
> *As a major UK energy utility, your team faces a daily high-stakes challenge: every day by 11:00 or 12:00 London time, you must commit to wholesale electricity purchases on the EPEX SPOT or Nord Pool day-ahead auctions for physical delivery across 48 half-hour settlement periods tomorrow.*
>
> *To meet your consumer demand, you rely on renewable generation forecasts—specifically national wind power. But wind is weather-dependent and volatile. If you buy too little power because the forecast over-estimated wind generation, your shortfall is penalised at real-time cashout—the System Buy Price (SBP)—which frequently spikes to £300, £500, or even £1,000 per megawatt-hour.*
>
> *We built **GridBricks UK Wind Desk** to solve this exact problem: providing you with point-in-time forecasts free from look-ahead bias, mathematically calibrated safety buffers, and an interactive thermal deficit calculator to ensure you procure the exact volume of additional power required."*

---

### Minute 1:00 – 2:30 | Live Walkthrough: Day-Ahead Decision Desk
*(Switch screen to `http://localhost:5173`)*

> *"Here is the Day-Ahead Decision Desk. Let’s look at a typical high-demand winter delivery day—January 15th, 2026.*
>
> *First, notice our **D-1 Cutoff Gate** selector in the top right. We have defaulted this to 09:00 London time. That guarantees zero look-ahead bias: only Numerical Weather Prediction models published on or before 09:00 on day D-1 are used. For January 15th delivery, the latest available Elexon WINDFOR dataset was published at 07:30 UTC.*
>
> *Looking at our top KPI ribbon:
> 1. **Average Forecast**: We project an average of **14,235 MW** of national wind.
> 2. **Peak Forecast**: Generation peaks at **18,100 MW** during Settlement Period 34.
> 3. **Publish Time Used**: 07:30 UTC on D-1.
> 4. **Risk-Adjusted Average**: Here is our proprietary innovation. Instead of bidding the raw 14.2 GW into the auction, we deduct a calibrated **P90 Safety Buffer of 2,150 MW**, leaving a conservative, protected bid volume of **12,085 MW**.*
>
> *In the main chart below, the deep burgundy curve shows our latest D-1 forecast across all 48 half-hours. The shaded beige area underneath represents our P90 downside risk hedge band. We can also toggle **'Show Earlier Runs'** to see how NWP weather models revised their trajectories over the past 24 hours."*

---

### Minute 2:30 – 3:45 | Thermal Procurement & Cashout Penalty Calculator
*(Scroll down slightly to the Thermal Procurement Calculator section)*

> *"Now let’s look at the core question your trading desk answers every day: **How much thermal power must we procure beyond wind to serve consumer demand?**
>
> *We have built an interactive Day-Ahead Wholesale Power & Thermal Procurement Calculator directly into the desk.
> - Let’s select our **Portfolio Preset: National GB (32 GW peak)** or adjust the slider to your utility's specific customer demand.
> - With wholesale baseload power at £75/MWh and cashout prices at £165/MWh, the system dynamically calculates the net thermal gap across every 30-minute period.
> - If you bid the raw unadjusted wind forecast, an unexpected wind drop forces you into the balancing mechanism. By bidding our **P90 risk-hedged volume**, the calculator shows we require **358,000 MWh of thermal generation** across the day, while saving an estimated **£185,000 in avoided cashout penalties** on this single delivery day alone!
>
> *Traders can also hit **'Download CSV'** to immediately export the 48-period dispatch schedule formatted for direct submission to your trading ETRM system."*

---

### Minute 3:45 – 5:00 | Quantitative Verification & ROI Wrap-up
*(Click navigation tab: **'Accuracy & Buffer Sizing'** at `http://localhost:5173/accuracy`)*

> *"To prove this isn’t guesswork, our second module conducts rigorous quantitative backtesting across all **744 delivery hours of January 2026**.
>
> *Here are the empirical findings:
> - **Mean Bias Error (MBE)**: The Elexon day-ahead wind forecast had a persistent positive bias of **+1,840 MW**. That means the weather models systematically over-estimated wind generation! If you traded unhedged, you would have faced physical generation deficits in over 68% of delivery hours!
> - **MAE & RMSE**: An MAE of 2,122 MW and RMSE of 2,616 MW.
> - **P90 Over-Forecast Miss**: In the worst 10% of hours, over-forecasting exceeded **4,777 MW**.
>
> *Our platform takes this historical error distribution and dynamically sizes an expanding-window buffer for every future trading day.
>
> *In summary, GridBricks gives your trading desk complete visibility over wind generation uncertainty, guarantees zero look-ahead bias, sizes your safety margins mathematically, and tells you exactly how much thermal power to purchase. We look forward to partnering with your team for full production deployment."*

---

# Part 2: Technical Architecture & Code Review (Max 5 Minutes)
**Target Persona**: Internal Engineering Tech Lead reviewing the codebase and development practices  
**Core Objective**: Explain system architecture, zero-lookahead methodology, pure domain analytics, typing, resilience, containerization, and test coverage.

---

### Minute 5:00 – 6:15 | Architectural Layering & Domain Design
*(Switch screen to IDE showing directory structure or `docs/ARCHITECTURE.md`)*

> *"Hello team. For the technical review portion, I’ll walk through the architecture, algorithmic rigor, codebase layout, and software engineering practices behind GridBricks.
>
> *The system follows a strict three-tier clean architecture separating pure domain analytics from the web presentation layer:
>
> ```text
> React Frontend (Vite / TanStack Query / Tailwind / Recharts)
>                             ↓ REST JSON (/api)
> FastAPI Presentation Layer (Pydantic v2 schemas / In-memory caching)
>                             ↓ Pure function calls
> Pandas Domain Analytics Layer (Zero look-ahead cutoffs / Quantiles / WAPE)
>                             ↓ Repository Pattern
> Gzipped Data Snapshot / Resilient Elexon HTTP Client
> ```
>
> *In `backend/app/analytics.py`, all domain mathematics are pure, stateless, typed Python functions. They accept Pandas DataFrames and return validated structures. There are zero framework dependencies inside `analytics.py`, making every calculation 100% unit-testable in isolation."*

---

### Minute 6:15 – 7:30 | Decision Cutoff Gate & Data Cleansing Mechanics
*(Open `backend/app/analytics.py` in editor to show `latest_forecast_at_cutoff`)*

> *"Let’s look at how we enforce the D-1 decision gate without data leakage.
>
> 1. **Timezone Normalization**: In `compute_decision_cutoff()`, we calculate:
>    $$\text{Gate}_{\text{UTC}} = (\text{delivery\_date} - 1\text{ day}) \text{ at HH:MM in Europe/London} \to \text{UTC}$$
>    This accounts dynamically for Daylight Saving Time (GMT vs BST).
>
> 2. **Zero Look-Ahead Filter**: We strictly filter records where `publishTime <= Gate_UTC` and `publishTime <= startTime`.
>
> 3. **Data Discovery & Anomaly Cleansing**: During exploratory analysis of the raw Elexon BMRS `WINDFOR` stream (documented in `docs/DATA_FINDINGS.md`), we uncovered that **20.55% of records had `publishTime > startTime`**—retrospective meteorological reanalyses! If ingested naively, this would leak future data into past decisions. Our pipeline strictly filters these out.
>
> 4. **Resolution Harmonization**: `WINDFOR` provides hourly forecasts; `FUELHH` provides 30-minute settlement periods. We broadcast the hourly forecast to both constituent settlement periods for trading execution, and average the settlement periods to hourly mean for physical energy backtesting."*

---

### Minute 7:30 – 8:30 | Asymmetric Sizing & Expanding Window Backtesting
*(Show `recommended_buffer` and `recommended_buffer_expanding_window` in `analytics.py`)*

> *"In electricity trading, error symmetry does not exist:
> - **Under-forecasting ($e < 0$)** generates surplus spill energy, cashed out at System Sell Price.
> - **Over-forecasting ($e > 0$)** creates physical shortfalls, triggering penal System Buy Price cashout charges.
>
> *Hence, in `recommended_buffer()`, we size the safety buffer against the **90th percentile of positive errors ($e > 0$)**.
>
> *Furthermore, in `recommended_buffer_expanding_window()`, we guarantee strict walk-forward backtesting: the safety buffer applied on delivery day $D$ is calibrated solely using historical errors from preceding days $[D_{\text{start}}, D-1]$. Future information never leaks into past trading recommendations."*

---

### Minute 8:30 – 9:30 | Frontend Engineering, Design System & Testing
*(Show `frontend/src/` and terminal with test results)*

> *"On the frontend:
> - Built with **React 18**, **TypeScript 5.7**, **Vite**, and **TanStack React Query** for automated query caching, stale-while-revalidate background fetches, and optimistic UI transitions.
> - **Design System**: Per client specifications, we designed an institutional **Greyish, Warm Beige, and Burgundy** palette (`#f7f6f3` canvas, `#ebdccb` warm sand accents, and `#871736` British burgundy brand accents).
> - **Visualizations**: Implemented with **Recharts**, featuring custom accessible tooltips, multi-line revision fan traces, brush zoom controls for the 744-hour timeseries, and 500 MW histogram distributions.
>
> *Quality Assurance:
> - **Backend**: 42 unit and integration tests across `test_analytics.py`, `test_api.py`, `test_elexon_client.py`, and `test_repository.py`. All **42 passed**!
> - **Frontend**: 15 Vitest and React Testing Library component tests covering `DateStepper`, `CutoffSelect`, `KpiCard`, and `EmptyState`. All **15 passed**!
> - **Static Typing**: Strict Mypy type-checking on backend, strict TypeScript compiler `tsc -b` on frontend."*

---

### Minute 9:30 – 10:00 | Containerization, Deployment & Wrap-Up
*(Show `docker-compose.yml` and `vercel.json`)*

> *"Deployment & Orchestration:
> - **Docker Compose**: Multi-stage Python 3.13-slim container with unprivileged user `appuser` and Nginx reverse proxy serving the compiled React bundle on port 80/3000.
> - **Vercel Serverless Ready**: Root `vercel.json` with `/api/index.py` serverless runtime and in-memory gzipped dataset snapshots.
> - **GitHub CI**: Automated pipeline in `.github/workflows/ci.yml` verifying linting, type safety, test suites, and Docker builds on every push.
>
> *This concludes our technical overview. The codebase is clean, thoroughly tested, and ready for institutional deployment. Thank you!"*

---

