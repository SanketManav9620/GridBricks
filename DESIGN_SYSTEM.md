# GridBricks — Design System & UI Specification

**Version:** 1.0  
**Status:** Production Ready  
**Last Updated:** 2026-10-26

---

## 1. Design Philosophy

GridBricks is a **professional trading desk application** for UK Day-Ahead wind power analytics. The UI must convey:

| Principle | Implementation |
|-----------|----------------|
| **Trust & Authority** | Dark navy base, precise typography, consistent data density |
| **Information Density** | 48-period tables, 744-hour timeseries, sortable verification grids |
| **Operational Clarity** | Explicit risk bands, buffer sizing callouts, plain-language insights |
| **Accessibility First** | WCAG AA contrast, focus-visible rings, keyboard navigation, semantic HTML |

**No "AI vibe" aesthetics** — no gradient hero sections, no floating blobs, no playful illustrations. This is a Bloomberg-terminal-grade tool.

---

## 2. Color System (Tailwind Config)

### Core Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `navy-950` | `#060a14` | Page background, deepest surface |
| `navy-900` | `#0b132b` | Cards, panels, header bar |
| `navy-850` | `#111c3d` | Elevated surfaces, modals |
| `navy-800` | `#1c2541` | Borders, dividers, hover states |
| `navy-700` | `#2b3658` | Active borders, input focus |
| `navy-600` | `#3a476f` | Disabled states |

### Semantic Accents

| Token | Hex | Semantic Meaning |
|-------|-----|------------------|
| `teal-400` | `#2dd4bf` | **Primary** — Forecast line, positive actions, "good" data |
| `teal-500` | `#14b8a6` | Primary hover, active states |
| `amber-400` | `#fbbf24` | **Warning/Risk** — P90 buffer, over-forecast bias, safety margins |
| `amber-500` | `#f59e0b` | Warning hover, buffer badges |
| `sky-400` | `#38bdf8` | **Actuals/Truth** — FUELHH outturn, verification |
| `rose-400` | `#fb7185` | **Danger** — RMSE, large misses, critical thresholds |

### Status Semantics (Never Decorative)

```tsx
// Over-forecast (desk shortfall) → AMBER
// Under-forecast (surplus) → TEAL
// Neutral/structural → SLATE
// Critical/extreme → ROSE
```

---

## 3. Typography

### Font Stack

```css
font-sans: 'Inter', system-ui, -apple-system, sans-serif;   /* UI, body, labels */
font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;  /* Data, numbers, code */
```

### Scale (Rem-based, fluid)

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | `0.75rem` (12px) | 1.4 | Table cells, timestamps, metadata |
| `text-sm` | `0.875rem` (14px) | 1.5 | Body copy, tooltips, form labels |
| `text-base` | `1rem` (16px) | 1.6 | Primary reading text |
| `text-lg` | `1.125rem` (18px) | 1.5 | Section headers, KPI values |
| `text-xl` | `1.25rem` (20px) | 1.4 | Page titles |
| `text-2xl` | `1.5rem` (24px) | 1.3 | Hero headlines (rare) |

**All numeric data uses `font-mono` with `tabular-nums`** for alignment.

---

## 4. Spacing & Layout

### Grid System

- **Max container:** `max-w-7xl` (1280px) — trading desk density
- **Gutters:** `px-4 sm:px-6 lg:px-8`
- **Vertical rhythm:** `space-y-6` between major sections
- **Card padding:** `p-5` (20px) standard, `p-6` (24px) for dense tables

### Breakpoints

| Breakpoint | Width | Use Case |
|------------|-------|----------|
| `sm` | 640px | 2-col KPI grid, inline nav |
| `md` | 768px | 3-col KPI, side-by-side charts |
| `lg` | 1024px | 4-col KPI, full table visibility |
| `xl` | 1280px | Max content width |

---

## 5. Component Library

### 5.1 AppShell (`AppShell.tsx`)

**Structure:**
```
<header sticky> → Brand + Nav (3 links) + Status pills
<main flex-1> → Page content (max-w-7xl, centered)
<footer> → Attribution + Elexon link
```

**Navigation Items:**
1. **Day-Ahead Desk** (`/`) — `Activity` icon — Trading decision interface
2. **Accuracy & Buffer Sizing** (`/accuracy`) — `BarChart3` — Analytics & verification
3. **Methodology** (`/method`) — `BookOpen` — Reference documentation

**Status Indicators (right side):**
- Live BMRS pulse (teal animated dot)
- "Jan 2026 Decisions" badge (amber shield)

### 5.2 KpiCard (`KpiCard.tsx`)

**Props:**
```tsx
interface KpiCardProps {
  title: string;                    // Metric name
  value: string;                    // Formatted primary value
  subtitle?: string;                // Secondary context
  tooltip: string;                  // Plain-language definition (required)
  icon: LucideIcon;                 // Semantic icon
  variant: 'default' | 'teal' | 'amber' | 'rose' | 'blue' | 'sky';
  badge?: string;                   // Optional confidence tag
}
```

**Visual Variants:**
| Variant | Border/Accent | Use Case |
|---------|---------------|----------|
| `teal` | `border-teal-500/30` | Forecast volumes, positive metrics |
| `amber` | `border-amber-500/30` | Risk buffers, over-forecast bias |
| `rose` | `border-rose-500/30` | RMSE, penalties, extreme misses |
| `sky` | `border-sky-500/30` | Actuals, verification data |
| `blue` | `border-blue-500/30` | Peak, horizon, timing |
| `default` | `border-slate-700` | Neutral metadata |

**Interaction:** Hover reveals tooltip (InfoTooltip), focus ring for keyboard.

### 5.3 ChartCard (`ChartCard.tsx`)

**Props:**
```tsx
interface ChartCardProps {
  title: string;
  subtitle?: string;
  tooltip: string;                    // Required: explains what the chart shows
  height: string;                     // e.g., "h-96", "h-80"
  actions?: ReactNode;                // Toolbar: toggles, downloads
  children: ReactNode;                // Recharts composition
}
```

**Chrome:**
- Subtle border `border-slate-800`
- Background `bg-navy-900/60 backdrop-blur-md`
- Title (semibold) + subtitle (muted) + tooltip trigger
- Action toolbar right-aligned

### 5.4 DateStepper (`DateStepper.tsx`)

**Props:**
```tsx
interface DateStepperProps {
  currentDate: string;                // YYYY-MM-DD
  availableDates: string[];           // Sorted, from /meta
  onChange: (date: string) => void;
}
```

**UX:**
- Previous/Next chevrons (disabled at bounds)
- Date pill with native `<input type="date">` fallback
- Keyboard: ←/→ arrows, Enter to commit

### 5.5 CutoffSelect (`CutoffSelect.tsx`)

**Props:**
```tsx
interface CutoffSelectProps {
  cutoff: string;                     // HH:MM (24hr)
  onChange: (cutoff: string) => void;
  options?: string[];                 // Default: ['08:00','09:00','10:00','11:00']
}
```

**UX:**
- Select dropdown with London-time labels
- Default `09:00` (D-1 gate)
- ARIA label: "Decision cutoff gate"

### 5.6 SkeletonLoader (`SkeletonLoader.tsx`)

**Components:**
- `SkeletonKpiGrid` — 4-card grid pulse
- `SkeletonChart` — Chart area pulse with height prop

**Animation:** `animate-pulse` on `bg-navy-800` blocks.

### 5.7 ErrorState / EmptyState

**ErrorState:** Title, message, retry button (calls refetch)
**EmptyState:** Title, description, action button (e.g., reset cutoff)

---

## 6. Page Specifications

### 6.1 Day-Ahead Decision Desk (`/`)

**Purpose:** Single-day trading decision interface — point-in-time forecast + risk bands + back-test toggle.

**Layout:**
```
Header: Title + "National Wind (GB)" badge + insight tagline
Controls: DateStepper + CutoffSelect (inline, responsive)
KPI Row (4): Avg Forecast | Peak | Publish Time | Risk-Adjusted Avg
Insight Bar: Plain-English desk note (teal accent)
Main Chart: 48-period profile with:
  - Teal line: Latest forecast at cutoff
  - Amber dashed area: P90 risk hedge band (forecast → p90Hedge)
  - Faint dotted lines: Earlier model revisions (toggle)
  - Sky line: Actual outturn (toggle, back-test)
  - Brush/zoom not needed (single day)
Table (48 rows): SP | Time | Forecast | Published | Horizon | Buffer | P90 Hedge | [Actual | Error]
Export: CSV download button
```

**Data Flow:**
```
useMeta() → available_dates
useForecast(date, cutoff) → 48 points + revisions + p90/p95 buffers
useActuals(date) → 48 actuals (for back-test)
```

**Key Interactions:**
- Date stepper → refetches forecast + actuals
- Cutoff select → refetches forecast (different model run)
- "Show Earlier Runs" → fans 3 prior revisions
- "Reveal Actual" → overlays FUELHH + computes error per SP
- CSV exports current view (with/without actuals)

---

### 6.2 Accuracy & Buffer Sizing (`/accuracy`)

**Purpose:** Month-wide empirical verification — statistical proof of buffer sizing.

**Layout:**
```
Header: Title + "January 2026 (744 Hours)" badge + CutoffSelect
KPI Row (5): MAE | RMSE | Bias (signed) | WAPE | P90 Over-Forecast
Buffer Callout: Amber gradient card with plain-language trading rule
Chart 1 (Full): 744-hour timeseries with Brush zoom
  - Teal: Day-ahead forecast
  - Sky: Actual outturn
  - Amber dashed: P90 hedge
Row 2: Error Histogram (500MW bins) | Diurnal Hourly Profile (24 bars MAE+Bias)
Row 3: Error by Horizon (5 buckets: 0-6h, 6-12h, 12-24h, 24-48h, 48h+)
Daily Table (31 rows, sortable): Date | Bias | MAE | RMSE | WAPE | P90 Miss | Dynamic Buffer
Export: Daily CSV download
```

**Sortable Columns:** All numeric + date. Click header → toggles asc/desc. Keyboard accessible.

**Data Flow:**
```
useAccuracySummary(cutoff) → 14 metrics
useAccuracyTimeseries(cutoff) → 744 points
useAccuracyDaily(cutoff) → 31 daily aggregates + expanding buffer
useAccuracyByHour(cutoff) → 24 hourly profiles
useAccuracyByHorizon(cutoff) → 5 horizon buckets
useAccuracyDistribution(cutoff, 500) → histogram bins
```

**Key Insight:** The expanding buffer column shows *strict walk-forward* sizing — each day's buffer uses only prior days' errors.

---

### 6.3 Methodology (`/method`)

**Purpose:** Reference documentation — no interactivity, pure content.

**Sections:**
1. **Day-Ahead Timing & Cutoff Gate** — D-1 auction mechanics, London→UTC conversion, zero look-ahead guarantee
2. **Point-in-Time Selection & Resolution** — Argmax publishTime ≤ gate, hourly→half-hourly broadcast, reanalysis cleansing (20.55% filtered)
3. **Quantitative Metrics** — Formulas for MBE, MAE, RMSE, WAPE, percentiles, within-10%
4. **Safety Buffer Sizing** — P90 quantile of over-forecast, Safe Bid = max(0, Forecast - Buffer), expanding window
5. **Assumptions & Limitations** — National vs zonal, BM curtailment, January seasonality, single-gate approximation

**Visual:** Card per section, colored left accent bar (teal/sky/amber/slate), code blocks for formulas.

---

## 7. Data Visualization Standards (Recharts)

### Color Mapping (Consistent Across All Charts)

| Series | Color | Stroke Width | Style |
|--------|-------|--------------|-------|
| Latest Forecast | `teal-400` (`#2dd4bf`) | 3px | Solid, bold |
| P90 Hedge / Safe Bid | `amber-400` (`#fbbf24`) | 1.5px | Dashed `4 4` |
| P95 Hedge | `amber-500` (`#f59e0b`) | 1px | Dashed `2 2` |
| Actual Outturn | `sky-400` (`#38bdf8`) | 2.5px | Solid |
| Earlier Revisions | `slate-400` (`#94a3b8`) | 1.2px | Dotted `2 2`, opacity 0.35-0.65 |
| MAE Bars | `teal-500` (`#14b8a6`) | — | Radius top |
| Bias Bars | `amber-400` | — | Radius top |
| RMSE Bars | `rose-400` | — | Radius top |
| Histogram Bars | `sky-500` (`#0ea5e9`) | — | Radius top |

### Axis & Grid

- **Grid:** `stroke="#1e293b"` (slate-800), `strokeDasharray="3 3"`, vertical=false
- **X-Axis:** `stroke="#64748b"` (slate-500), `fontSize=11`, no tick line
- **Y-Axis:** Same, `tickFormatter: (v) => \`${(v/1000).toFixed(0)} GW\``
- **Tooltip:** Custom — `bg-navy-900 border-slate-700 backdrop-blur-md`, mono font for numbers

### ResponsiveContainer

Always `width="100%" height="100%"` inside ChartCard with fixed height prop.

---

## 8. Interaction & Motion

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Page fade-in | 200ms | `ease-out` |
| Button hover | 150ms | `ease-out` |
| Tooltip show | 100ms | `ease-out` |
| Skeleton pulse | 2s | infinite |
| Chart line mount | 400ms | `ease-out` (Recharts default) |

**No decorative animations.** Motion only for state feedback.

---

## 9. Accessibility Checklist

- [ ] All interactive elements have `focus-visible:ring-2 focus-visible:ring-teal-500`
- [ ] Semantic heading hierarchy (h1 → h2 → h3)
- [ ] Tables use `<thead>`, `<tbody>`, `scope="col"`, `tabIndex=0` on sortable headers
- [ ] Color never sole information carrier (text labels + icons + patterns)
- [ ] Contrast ratios: text on navy-950 ≥ 4.5:1 (WCAG AA)
- [ ] ARIA labels on icon-only buttons
- [ ] Keyboard navigation: Tab order logical, Enter/Space on custom controls
- [ ] `prefers-reduced-motion` respected (disable pulse, transitions)

---

## 10. Responsive Behavior

| Component | Mobile (<640px) | Tablet (640-1024px) | Desktop (>1024px) |
|-----------|-----------------|---------------------|-------------------|
| KPI Grid | 1 col | 2 col | 4 col |
| Nav | Icons only | Icons + labels | Icons + labels |
| Chart Height | h-72 | h-80 | h-96 |
| Table | Horizontal scroll | Horizontal scroll | Full visible |
| DateStepper | Stacked | Inline | Inline |
| Brush (timeseries) | Hidden | Visible | Visible |

---

## 11. Content Tone & Microcopy

| Context | Voice |
|---------|-------|
| Page titles | Noun phrases: "Day-Ahead Decision Desk" |
| Subtitles | Descriptive: "Delivery Date: 2026-01-15 \| Cutoff: 09:00 London" |
| Tooltips | Plain English definitions, no jargon without explanation |
| Insight bars | "Desk Insight: At 09:00 London..." — actionable, specific |
| Empty states | "No forecast records found for..." + action button |
| Errors | "Failed to load..." + retry, no technical stack traces |

---

## 12. Implementation Notes

### CSS Custom Properties (index.css)
```css
.card-glow { box-shadow: 0 0 25px -5px rgba(45, 212, 191, 0.05); }
.card-amber-glow { box-shadow: 0 0 25px -5px rgba(245, 158, 11, 0.08); }
```

### Utility Classes (Tailwind)
- `animate-fadeIn` — page entry (defined in tailwind.config.js or global CSS)
- `animate-spin-slow` — logo pulse (3s linear infinite)
- `backdrop-blur-md` — glassmorphism on cards/headers
- `font-mono tabular-nums` — all data cells

### Icons (lucide-react)
Consistent 3.5×3.5 (14px) in nav/KPIs, 5×5 (20px) in section headers.

---

## 13. QA Checklist for New Components

- [ ] Dark mode only (no light mode support needed)
- [ ] Works at 125% and 150% browser zoom
- [ ] Horizontal scroll on tables has visible scrollbar
- [ ] Tooltips don't overflow viewport on mobile
- [ ] CSV export filenames include date + cutoff
- [ ] Loading skeletons match final layout dimensions
- [ ] Error boundaries catch chart render failures
- [ ] All API hooks handle 404/500 gracefully

---

## 14. Future Extensibility

| Feature | Design Impact |
|---------|---------------|
| Multi-market (DE, FR) | Add market selector to AppShell, namespace API |
| Intraday auctions (IDA1/2/3) | New page route, additional cutoff options |
| Portfolio view | Multi-asset KPI grid, correlation heatmap |
| Alerting | Toast/notification system, threshold config |
| User preferences | Theme density, default cutoff, column visibility |

---

*End of Design System Specification*