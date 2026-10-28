# GridBricks — Design System & UI Specification

**Version:** 2.0 (Greyish, Beige & Burgundy Theme)  
**Status:** Production Ready  
**Last Updated:** October 2026  

---

## 1. Design Philosophy

GridBricks is an **institutional energy trading desk application** tailored for UK wholesale electricity traders and portfolio managers. The visual identity is built on a sophisticated, timeless palette of **warm greyish neutrals, creamy sand beige, and rich British burgundy**:

| Principle | Implementation |
|-----------|----------------|
| **Institutional Authority** | Soft warm greyish backdrop (`#f7f6f3`), crisp white cards, and deep burgundy brand accents (`#871736`) |
| **Financial Risk Clarity** | P90 safety buffer shaded in warm sand beige (`#ddc5a9`), thermal procurement in burgundy gradients |
| **High Information Density** | 48-period settlement tables, 744-hour timeseries with interactive brush zoom, sortable daily verification grids |
| **Accessibility & Contrast** | Full WCAG AA contrast on light surfaces, focus-visible rings in burgundy, semantic HTML |

---

## 2. Color System (Tailwind Config)

### The Greyish, Beige & Burgundy Triple

```text
Greyish Canvas (#f7f6f3) + Warm Beige (#f5f0e8 / #ebdccb) + Signature Burgundy (#871736)
```

### Core Palette Tokens

| Token | Hex | Role | Usage |
|-------|-----|------|-------|
| `canvas-100` | `#f7f6f3` | **Base Surface** | Full page body background, soft neutral backdrop |
| `white` | `#ffffff` | **Card Surface** | Primary metric cards, chart containers, data tables |
| `beige-50` | `#faf8f5` | **Soft Surface** | Callout backgrounds, insight banners |
| `beige-100` | `#f5f0e8` | **Warm Fill** | Table header surfaces, secondary buttons, badge fills |
| `beige-200` | `#ebdccb` | **Sand Accent** | Active revision toggles, secondary border accents |
| `beige-300` | `#ddc5a9` | **Hedge Shade** | P90 risk hedge band gradient fill |
| `beige-500` | `#b59672` | **Bronze Border** | Dashed P90 buffer threshold stroke |
| `burgundy-50` | `#fdf3f5` | **Tint** | Logo background container, alert callouts |
| `burgundy-100` | `#fbe6ea` | **Subtle Accent** | Active pill highlights, focus containers |
| `burgundy-700` | `#871736` | **Primary Brand** | Active navigation pills, latest forecast line, primary CTA buttons |
| `burgundy-800` | `#6f142e` | **Deep Wine** | Thermal procurement requirement line, KPI numbers |
| `burgundy-900` | `#561225` | **Midnight Wine** | RMSE bar chart, table emphasis values |
| `stone-200` | `#e7e5df` | **Border Neutral** | Card borders, table dividers, Cartesian grid strokes |
| `stone-700` | `#4f4a40` | **Secondary Text** | Axis labels, table timestamps, secondary copy |
| `stone-900` | `#1c1917` | **Primary Text** | Headings, table numbers, KPI data values |

### Semantic Chart Roles

```tsx
// Latest Forecast at Gate → Rich Burgundy (#871736, 2.5px solid)
// P90 Safe Hedge Band → Warm Sand/Beige fill (#ddc5a9) with bronze dashed line (#b59672)
// Consumer Demand Profile → Deep Espresso (#4f3f31, dashed 2px)
// Thermal / DA Purchase Req → Deep Burgundy (#6f142e, 2.5px solid)
// Historical Actuals (FUELHH) → Warm Charcoal (#282520, 2px with dots)
// Prior NWP Model Revisions → Warm Grey / Taupe (#ada597, dashed 1.2px)
```

---

## 3. Component Design & Structure

### Navigation & Header (`AppShell.tsx`)
- Sticky top navigation bar on `#faf9f6` with 95% opacity backdrop blur.
- Brand logo: Turbine SVG in `#871736` with `#fdf3f5` burgundy rounded background.
- Active navigation tab: Solid Burgundy `#871736` with crisp white text.
- Inactive navigation tab: Subdued `#57534e` text with warm hover states.
- Live API connectivity badge: Emerald pulse indicator on warm stone pill.

### Decision Desk Controls
- **DateStepper**: Dropdown picker with previous/next carousel arrows bounded to January 2026 delivery days.
- **CutoffSelect**: Instantaneous gate selection (09:00, 09:30, 11:00, 11:30, 12:00, 14:00 London).

### Metric Tiles (`KpiCard.tsx`)
- High-contrast card with mono-spaced numeric readout.
- Contextual badges in warm beige with deep stone/burgundy typography.
- Interactive accessible info tooltip explaining exact domain formulation.

### Interactive Thermal Deficit Calculator
- Interactive sliders for Consumer Peak Demand (1 GW to 45 GW), Day-Ahead Auction Price (£40–£200/MWh), and Imbalance Cashout System Buy Price (£80–£400/MWh).
- Dynamic quantification of MWh shortfall volumes and avoided cashout penalty cost.
