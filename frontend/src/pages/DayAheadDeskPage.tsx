import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Wind,
  ShieldAlert,
  Clock,
  TrendingUp,
  Eye,
  EyeOff,
  Download,
  History,
  Sparkles,
  Flame,
  Zap,
  Building2,
  DollarSign,
} from 'lucide-react';

import { useMeta, useForecast, useActuals } from '@/api/hooks';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { DateStepper } from '@/components/DateStepper';
import { CutoffSelect } from '@/components/CutoffSelect';
import { SkeletonKpiGrid, SkeletonChart } from '@/components/SkeletonLoader';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { formatMW, formatTimeHHMM, formatDateTimeUTC } from '@/lib/utils';

// 48-period UK winter normalized consumer demand profile (fractions of peak demand)
const UK_WINTER_DEMAND_PROFILE = [
  0.68, 0.66, 0.65, 0.64, 0.64, 0.63, 0.63, 0.64, // SP 1-8 (00:00 - 04:00)
  0.66, 0.70, 0.76, 0.82, 0.88, 0.91, 0.92, 0.92, // SP 9-16 (04:30 - 08:00)
  0.92, 0.91, 0.90, 0.90, 0.89, 0.89, 0.88, 0.88, // SP 17-24 (08:30 - 12:00)
  0.88, 0.88, 0.89, 0.89, 0.90, 0.92, 0.95, 0.98, // SP 25-32 (12:30 - 16:00)
  1.00, 1.00, 0.99, 0.97, 0.95, 0.93, 0.90, 0.87, // SP 33-40 (16:30 - 20:00)
  0.84, 0.80, 0.77, 0.74, 0.72, 0.70, 0.69, 0.68, // SP 41-48 (20:30 - 24:00)
];

export const DayAheadDeskPage: React.FC = () => {
  const { data: meta, isLoading: metaLoading } = useMeta();

  // Requirements: Cutoff control defaulting to 09:00; date stepper limited to supported delivery days
  const [deliveryDate, setDeliveryDate] = useState<string>('2026-01-15');
  const [cutoff, setCutoff] = useState<string>('09:00');
  const [showRevisions, setShowRevisions] = useState<boolean>(false);
  const [revealActual, setRevealActual] = useState<boolean>(false);

  // Day-Ahead Wholesale Power & Thermal Procurement Deficit Calculator state
  const [showProcurement, setShowProcurement] = useState<boolean>(true);
  const [peakDemand, setPeakDemand] = useState<number>(32000); // Default 32 GW national GB peak
  const [daPrice, setDaPrice] = useState<number>(75); // £75/MWh Day-ahead thermal
  const [cashoutPrice, setCashoutPrice] = useState<number>(165); // £165/MWh System Buy Price cashout

  // Set page title
  React.useEffect(() => {
    document.title = 'GridBricks | Day-Ahead Decision Desk';
  }, []);

  // Sync initial date from metadata once available
  React.useEffect(() => {
    if (meta?.available_dates?.length && !meta.available_dates.includes(deliveryDate)) {
      setDeliveryDate(meta.available_dates[14] || meta.available_dates[0]);
    }
  }, [meta, deliveryDate]);

  const {
    data: forecastData,
    isLoading: forecastLoading,
    error: forecastError,
    refetch: refetchForecast,
  } = useForecast(deliveryDate, cutoff);

  const { data: actualsData } = useActuals(deliveryDate);

  // Combine forecast points, revisions, and optional actuals
  const points = forecastData?.points || [];
  const actuals = actualsData?.points || [];
  const actualsMap = useMemo(() => {
    return new Map(actuals.map((a) => [a.settlementPeriod, a.generation_mw]));
  }, [actuals]);

  // Extract up to 3 distinct earlier revision trajectories for the fan line toggle
  const earlierRevisionRuns = useMemo(() => {
    if (!forecastData?.revisions?.length) return [];
    const runsMap = new Map<string, Map<number, number>>();

    forecastData.revisions.forEach((rev) => {
      const pubIso = rev.publishTime;
      if (!runsMap.has(pubIso)) {
        runsMap.set(pubIso, new Map<number, number>());
      }
      const dt = new Date(rev.startTime);
      const hour = dt.getUTCHours();
      runsMap.get(pubIso)!.set(hour, rev.forecast_mw);
    });

    const sortedPubTimes = Array.from(runsMap.keys()).sort();
    // Exclude the latest run (already plotted) and take the latest 3 earlier runs
    const earlierPubTimes = sortedPubTimes.slice(0, -1).slice(-3);

    return earlierPubTimes.map((pubTime, idx) => ({
      key: `rev_${idx}`,
      publishTime: pubTime,
      label: `Prior Run ${formatTimeHHMM(pubTime)} UTC`,
      hourMap: runsMap.get(pubTime)!,
    }));
  }, [forecastData?.revisions]);

  // Build chart dataset with 48 half-hour settlement periods
  const chartData = useMemo(() => {
    return points.map((p) => {
      const actMW = actualsMap.get(p.settlementPeriod);
      const errorMW = actMW !== undefined ? p.forecast_mw - actMW : null;
      const hour = (p.settlementPeriod - 1) >> 1;
      const sp = p.settlementPeriod;
      const demandFraction = UK_WINTER_DEMAND_PROFILE[(sp - 1) % 48] || 0.8;
      const demandMw = peakDemand * demandFraction;
      const thermalRawMw = Math.max(0, demandMw - p.forecast_mw);
      const thermalP90Mw = Math.max(0, demandMw - p.risk_band_p90_mw);

      const row: Record<string, any> = {
        settlementPeriod: p.settlementPeriod,
        startTimeUtc: p.startTime,
        publishedAtUtc: p.publishTime,
        timeLabel: `SP${p.settlementPeriod} (${formatTimeHHMM(p.startTime)})`,
        timeOnly: formatTimeHHMM(p.startTime),
        forecast: p.forecast_mw,
        actual: actMW ?? null,
        p90Hedge: p.risk_band_p90_mw,
        p95Hedge: p.risk_band_p95_mw,
        riskBand: [p.risk_band_p90_mw, p.forecast_mw],
        bufferMw: Math.max(0, p.forecast_mw - p.risk_band_p90_mw),
        horizon: p.horizon_hours,
        error: errorMW,
        demand: demandMw,
        thermalRaw: thermalRawMw,
        thermalP90: thermalP90Mw,
      };

      // Attach earlier revision versions if present
      earlierRevisionRuns.forEach((rev) => {
        row[rev.key] = rev.hourMap.get(hour) ?? null;
      });

      return row;
    });
  }, [points, actualsMap, earlierRevisionRuns, peakDemand]);

  // Aggregate KPI summary metrics
  const meanForecast = useMemo(() => {
    if (!points.length) return 0;
    return points.reduce((acc, p) => acc + p.forecast_mw, 0) / points.length;
  }, [points]);

  const peakPoint = useMemo(() => {
    if (!points.length) return { forecast_mw: 0, settlementPeriod: 1, startTime: '' };
    return points.reduce(
      (max, p) => (p.forecast_mw > max.forecast_mw ? p : max),
      points[0]
    );
  }, [points]);

  const p90Buffer = forecastData?.p90_buffer_mw ?? 0;
  const riskAdjustedAverage = Math.max(0, meanForecast - p90Buffer);

  // Aggregated Wholesale Power & Thermal Procurement summary
  const procurementSummary = useMemo(() => {
    if (!chartData.length) {
      return {
        totalDemandMwh: 0,
        totalWindMwh: 0,
        totalThermalRawMwh: 0,
        totalThermalP90Mwh: 0,
        peakThermalMw: 0,
        hedgedSavingsGbp: 0,
        windCoveragePct: 0,
        bufferMwh: 0,
      };
    }
    let totalDemandMwh = 0;
    let totalWindMwh = 0;
    let totalThermalRawMwh = 0;
    let totalThermalP90Mwh = 0;
    let peakThermalMw = 0;

    chartData.forEach((r) => {
      totalDemandMwh += r.demand * 0.5; // 30-min settlement period = 0.5 hours
      totalWindMwh += r.forecast * 0.5;
      totalThermalRawMwh += r.thermalRaw * 0.5;
      totalThermalP90Mwh += r.thermalP90 * 0.5;
      if (r.thermalP90 > peakThermalMw) peakThermalMw = r.thermalP90;
    });

    const bufferMwh = Math.max(0, totalThermalP90Mwh - totalThermalRawMwh);
    const spreadGbp = Math.max(0, cashoutPrice - daPrice);
    const hedgedSavingsGbp = bufferMwh * spreadGbp;
    const windCoveragePct =
      totalDemandMwh > 0 ? Math.min(100, (totalWindMwh / totalDemandMwh) * 100) : 0;

    return {
      totalDemandMwh,
      totalWindMwh,
      totalThermalRawMwh,
      totalThermalP90Mwh,
      peakThermalMw,
      hedgedSavingsGbp,
      windCoveragePct,
      bufferMwh,
    };
  }, [chartData, cashoutPrice, daPrice]);

  // Latest model publication timestamp used
  const latestPublishTime = points[0]?.publishTime
    ? formatTimeHHMM(points[0].publishTime) + ' UTC'
    : '—';

  // Plain-English insight line generator
  const insightText = useMemo(() => {
    if (!points.length) return '';
    return `At ${cutoff} London (D-1), latest available NWP model was published at ${latestPublishTime}. Expected wind generation averages ${formatMW(
      meanForecast
    )}, peaking at ${formatMW(peakPoint.forecast_mw)} (SP ${
      peakPoint.settlementPeriod
    }). Applying the recommended ${formatMW(
      p90Buffer
    )} safety buffer hedges against systematic over-forecasting shortfalls with 90% confidence. Net thermal procurement required across the delivery day is ${Math.round(
      procurementSummary.totalThermalP90Mwh
    ).toLocaleString()} MWh (${Math.round(procurementSummary.peakThermalMw).toLocaleString()} MW peak).`;
  }, [
    cutoff,
    latestPublishTime,
    meanForecast,
    peakPoint,
    p90Buffer,
    points.length,
    procurementSummary.totalThermalP90Mwh,
    procurementSummary.peakThermalMw,
  ]);

  // CSV export handler for the 48-period data table
  const handleDownloadCsv = () => {
    if (!chartData.length) return;
    const headers = [
      'Settlement Period',
      'Delivery Time (UTC)',
      'Forecast (MW)',
      'Published At (UTC)',
      'Horizon (Hours)',
      'Buffer (MW)',
      'Risk-Adjusted Hedge (MW)',
      ...(showProcurement
        ? ['Consumer Demand (MW)', 'Thermal Procurement Raw (MW)', 'Thermal Procurement P90 (MW)']
        : []),
      ...(revealActual ? ['Actual Generation (MW)', 'Error (MW)'] : []),
    ];

    const rows = chartData.map((r) => [
      r.settlementPeriod,
      r.timeOnly,
      r.forecast.toFixed(1),
      formatDateTimeUTC(r.publishedAtUtc),
      r.horizon.toFixed(2),
      r.bufferMw.toFixed(1),
      r.p90Hedge.toFixed(1),
      ...(showProcurement
        ? [r.demand.toFixed(1), r.thermalRaw.toFixed(1), r.thermalP90.toFixed(1)]
        : []),
      ...(revealActual
        ? [
            r.actual !== null ? r.actual.toFixed(1) : '',
            r.error !== null ? r.error.toFixed(1) : '',
          ]
        : []),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `wind_forecast_desk_${deliveryDate}_cutoff_${cutoff.replace(':', '')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 1. Loading State
  if (metaLoading || (forecastLoading && !forecastData)) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div className="h-8 w-64 bg-stone-200 rounded animate-pulse" />
          <div className="h-10 w-80 bg-stone-200 rounded animate-pulse" />
        </div>
        <SkeletonKpiGrid />
        <SkeletonChart height="h-96" />
      </div>
    );
  }

  // 2. Error State
  if (forecastError) {
    return (
      <ErrorState
        title="Failed to load trading desk forecast"
        message={
          forecastError instanceof Error
            ? forecastError.message
            : 'An unexpected error occurred while querying the decision backend.'
        }
        onRetry={refetchForecast}
      />
    );
  }

  // 3. Empty State
  if (!points.length) {
    return (
      <EmptyState
        title="No Forecast Records Found"
        description={`No wind forecast runs were published prior to the ${cutoff} cutoff for delivery date ${deliveryDate}.`}
        action={
          <button
            onClick={() => setCutoff('09:00')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-burgundy-700 hover:bg-burgundy-800 text-white shadow-xs"
          >
            Reset to Default (09:00 London)
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Interactive Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-stone-200/90">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 flex items-center space-x-2">
            <span>Day-Ahead Decision Desk</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-burgundy-50 text-burgundy-900 border border-burgundy-200 font-mono font-semibold">
              National Wind (GB)
            </span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Point-in-time forecast selected strictly prior to auction cutoff. Calibrated safety buffer
            hedges cash-out imbalance penalties.
          </p>
        </div>

        {/* Date Stepper & Cutoff Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <DateStepper
            currentDate={deliveryDate}
            availableDates={meta?.available_dates || [deliveryDate]}
            onChange={setDeliveryDate}
          />
          <CutoffSelect cutoff={cutoff} onChange={setCutoff} />
        </div>
      </div>

      {/* 4 Required KPIs: Average, Peak, Publish Time Used, Risk-Adjusted Average */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Average Forecast"
          value={formatMW(meanForecast)}
          subtitle="Mean Day-Ahead Wind Volume"
          tooltip="Average forecasted national wind generation across all 48 half-hour settlement periods, published prior to D-1 decision gate."
          icon={Wind}
          variant="burgundy"
        />

        <KpiCard
          title="Peak Forecast"
          value={formatMW(peakPoint.forecast_mw)}
          subtitle={`Peak at SP ${peakPoint.settlementPeriod} (${formatTimeHHMM(
            peakPoint.startTime
          )} UTC)`}
          tooltip="Maximum anticipated wind power generation period during the 24-hour delivery day."
          icon={TrendingUp}
          variant="beige"
        />

        <KpiCard
          title="Publish Time Used"
          value={latestPublishTime}
          subtitle={`Gate Cutoff: ${cutoff} London (D-1)`}
          tooltip="Exact publication timestamp of the most recent Elexon WINDFOR dataset available prior to the specified auction cutoff."
          icon={Clock}
          variant="default"
          badge="D-1 Model"
        />

        <KpiCard
          title="Risk-Adjusted Average"
          value={formatMW(riskAdjustedAverage)}
          subtitle={`P90 Buffer: -${formatMW(p90Buffer)}`}
          tooltip="Safe auction bid volume after applying the quantitative 90th percentile historical over-forecast shortfall deduction (Forecast - Buffer)."
          icon={ShieldAlert}
          variant="burgundy"
          badge="90% Confidence"
        />
      </div>

      {/* Short Plain-English Insight Line Above the Main Chart */}
      <div className="rounded-xl border border-beige-300 bg-beige-50/80 px-4 py-3 text-xs text-stone-800 flex items-start space-x-3 shadow-2xs">
        <Sparkles className="w-4 h-4 text-burgundy-700 mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          <strong className="text-burgundy-900 font-semibold">Desk Insight: </strong>
          {insightText}
        </p>
      </div>

      {/* Main Delivery Profile Chart with Shaded Risk Band, Faint Revisions, and Back-Test Overlay */}
      <ChartCard
        title="Day-Ahead Delivery Generation Profile (48 Half-Hours)"
        subtitle={`Delivery Date: ${deliveryDate} | Cutoff: ${cutoff} London | Lead Time: ~15h to 39h`}
        tooltip="Physical generation trajectory for physical delivery day D. The burgundy line represents the latest available forecast at decision cutoff. The shaded warm beige area indicates the P90 downside risk band. Use the toggles to inspect model revisions or reveal historical actuals."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Thermal Procurement Calculator Toggle */}
            <button
              id="toggle-procurement-button"
              onClick={() => setShowProcurement(!showProcurement)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 ${
                showProcurement
                  ? 'bg-burgundy-700 text-white border-burgundy-800 shadow-2xs'
                  : 'bg-white border-stone-300 text-stone-700 hover:text-stone-900 hover:bg-beige-50'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${showProcurement ? 'text-white' : 'text-burgundy-700'}`} />
              <span>{showProcurement ? 'Hide Thermal Gap' : 'Thermal Procurement'}</span>
            </button>

            {/* Earlier Versions Toggle */}
            <button
              id="toggle-revisions-button"
              onClick={() => setShowRevisions(!showRevisions)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 ${
                showRevisions
                  ? 'bg-beige-200 border-beige-400 text-stone-900 shadow-2xs'
                  : 'bg-white border-stone-300 text-stone-700 hover:text-stone-900 hover:bg-beige-50'
              }`}
            >
              <History className="w-3.5 h-3.5 text-stone-600" />
              <span>{showRevisions ? 'Hide Earlier Runs' : 'Show Earlier Runs'}</span>
            </button>

            {/* Reveal Actual (Back-Test) Toggle */}
            <button
              id="reveal-actual-button"
              onClick={() => setRevealActual(!revealActual)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-600 ${
                revealActual
                  ? 'bg-stone-800 border-stone-900 text-white shadow-2xs'
                  : 'bg-white border-stone-300 text-stone-700 hover:text-stone-900 hover:bg-beige-50'
              }`}
            >
              {revealActual ? <EyeOff className="w-3.5 h-3.5 text-stone-300" /> : <Eye className="w-3.5 h-3.5 text-stone-600" />}
              <span>{revealActual ? 'Hide Actuals (Back-Test)' : 'Reveal Actual (Back-Test)'}</span>
            </button>
          </div>
        }
        height="h-96"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id="riskBandFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ddc5a9" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#ddc5a9" stopOpacity={0.12} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e8e5df" vertical={false} />

            <XAxis
              dataKey="timeOnly"
              stroke="#78716c"
              fontSize={11}
              tickLine={false}
              interval={3}
            />

            <YAxis
              stroke="#78716c"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)} GW`}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-stone-200 p-3 rounded-xl shadow-xl text-xs space-y-1.5 font-sans">
                    <p className="font-semibold text-stone-900 border-b border-stone-100 pb-1 flex justify-between items-center">
                      <span>{d.timeLabel}</span>
                      <span className="text-[10px] text-stone-500 font-mono">
                        Lead {d.horizon.toFixed(1)}h
                      </span>
                    </p>

                    <div className="flex justify-between space-x-4">
                      <span className="text-burgundy-700 font-medium">Latest Forecast:</span>
                      <span className="font-mono text-stone-900 font-bold">
                        {formatMW(d.forecast)}
                      </span>
                    </div>

                    <div className="flex justify-between space-x-4 text-beige-800">
                      <span>P90 Safe Hedge:</span>
                      <span className="font-mono font-bold">{formatMW(d.p90Hedge)}</span>
                    </div>

                    <div className="flex justify-between space-x-4 text-stone-600 text-[11px]">
                      <span>Safety Buffer:</span>
                      <span className="font-mono">-{formatMW(d.bufferMw)}</span>
                    </div>

                    {showProcurement && (
                      <div className="border-t border-stone-100 pt-1.5 mt-1 space-y-1">
                        <div className="flex justify-between space-x-4 text-stone-700">
                          <span className="font-medium">Consumer Demand:</span>
                          <span className="font-mono text-stone-900 font-bold">
                            {formatMW(d.demand)}
                          </span>
                        </div>
                        <div className="flex justify-between space-x-4 text-burgundy-800">
                          <span className="font-medium">Thermal / DA Purchase (P90):</span>
                          <span className="font-mono font-bold text-burgundy-900">
                            {formatMW(d.thermalP90)}
                          </span>
                        </div>
                        <div className="flex justify-between space-x-4 text-stone-500 text-[11px]">
                          <span>Thermal (Raw Wind):</span>
                          <span className="font-mono">{formatMW(d.thermalRaw)}</span>
                        </div>
                      </div>
                    )}

                    {revealActual && d.actual !== null && (
                      <div className="border-t border-stone-100 pt-1.5 mt-1 space-y-1">
                        <div className="flex justify-between space-x-4 text-stone-800">
                          <span className="font-medium">Actual Outturn:</span>
                          <span className="font-mono text-stone-900 font-bold">
                            {formatMW(d.actual)}
                          </span>
                        </div>
                        {d.error !== null && (
                          <div className="flex justify-between space-x-4 text-[11px]">
                            <span className={d.error > 0 ? 'text-burgundy-700' : 'text-beige-800'}>
                              {d.error > 0 ? 'Over-Forecast Shortfall:' : 'Under-Forecast Surplus:'}
                            </span>
                            <span className="font-mono font-medium">
                              {d.error > 0
                                ? `+${d.error.toFixed(0)} MW`
                                : `${d.error.toFixed(0)} MW`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <Legend
              wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }}
              formatter={(value) => <span className="text-stone-700 font-medium">{value}</span>}
            />

            {/* Shaded Risk Band (Area between Forecast and P90 Safe Hedge) */}
            <Area
              type="monotone"
              dataKey="p90Hedge"
              name="P90 Risk Hedge Band"
              fill="url(#riskBandFill)"
              stroke="#b59672"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />

            {/* Faint Earlier Versions (Toggleable) */}
            {showRevisions &&
              earlierRevisionRuns.map((run, i) => (
                <Line
                  key={run.key}
                  type="monotone"
                  dataKey={run.key}
                  name={run.label}
                  stroke="#ada597"
                  strokeWidth={1.2}
                  strokeOpacity={0.6 + i * 0.15}
                  strokeDasharray="2 2"
                  dot={false}
                />
              ))}

            {/* Consumer Demand Profile */}
            {showProcurement && (
              <Line
                type="monotone"
                dataKey="demand"
                name="Consumer Demand Load"
                stroke="#4f3f31"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            )}

            {/* Thermal / DA Purchase Required (P90) */}
            {showProcurement && (
              <Line
                type="monotone"
                dataKey="thermalP90"
                name="Thermal / DA Purchase Req. (P90)"
                stroke="#6f142e"
                strokeWidth={2.5}
                dot={false}
              />
            )}

            {/* Bold Latest-Forecast Line (Signature Burgundy) */}
            <Line
              type="monotone"
              dataKey="forecast"
              name="Latest Forecast at Cutoff"
              stroke="#871736"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#871736' }}
            />

            {/* Optional Actual Outturn Overlay (Back-Test Toggle) */}
            {revealActual && (
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Outturn (FUELHH)"
                stroke="#282520"
                strokeWidth={2}
                dot={{ r: 2.5, fill: '#282520' }}
                activeDot={{ r: 5, fill: '#282520' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Day-Ahead Wholesale Power & Thermal Procurement Deficit Calculator */}
      {showProcurement && (
        <div className="rounded-xl border border-beige-300 bg-gradient-to-br from-beige-50/90 via-white to-warmgrey-50 p-5 shadow-xs space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-beige-300/80">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-burgundy-50 border border-burgundy-200">
                  <Flame className="w-5 h-5 text-burgundy-700" />
                </div>
                <h3 className="text-base font-bold text-stone-900 tracking-tight">
                  Day-Ahead Wholesale Power & Thermal Procurement Calculator
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-beige-100 text-burgundy-900 border border-beige-300 font-semibold font-mono">
                  Utility Decision Support
                </span>
              </div>
              <p className="text-xs text-stone-600 max-w-2xl leading-relaxed">
                Determines how much additional wholesale electricity must be procured from thermal plants (e.g. CCGT/gas peakers) or the day-ahead auction to satisfy consumer demand beyond available wind generation, accounting for quantified forecast error buffers.
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-500 font-medium">Portfolio Preset:</span>
              <button
                type="button"
                onClick={() => setPeakDemand(32000)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  peakDemand === 32000
                    ? 'bg-burgundy-700 text-white border-burgundy-800 shadow-2xs'
                    : 'bg-white border-stone-300 text-stone-700 hover:bg-beige-50'
                }`}
              >
                National GB (32 GW)
              </button>
              <button
                type="button"
                onClick={() => setPeakDemand(8000)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  peakDemand === 8000
                    ? 'bg-burgundy-700 text-white border-burgundy-800 shadow-2xs'
                    : 'bg-white border-stone-300 text-stone-700 hover:bg-beige-50'
                }`}
              >
                Tier-1 Utility (8 GW)
              </button>
              <button
                type="button"
                onClick={() => setPeakDemand(3000)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  peakDemand === 3000
                    ? 'bg-burgundy-700 text-white border-burgundy-800 shadow-2xs'
                    : 'bg-white border-stone-300 text-stone-700 hover:bg-beige-50'
                }`}
              >
                Mid Supplier (3 GW)
              </button>
            </div>
          </div>

          {/* Interactive Sliders & Parameter Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
            {/* Peak Demand Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-stone-700 font-medium flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-burgundy-700" />
                  <span>Consumer Peak Demand:</span>
                </span>
                <span className="font-mono text-burgundy-800 font-bold">
                  {peakDemand.toLocaleString()} MW
                </span>
              </div>
              <input
                type="range"
                min={1000}
                max={45000}
                step={500}
                value={peakDemand}
                onChange={(e) => setPeakDemand(Number(e.target.value))}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-burgundy-700"
              />
              <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                <span>1 GW</span>
                <span>Winter Peak Model (48 SP)</span>
                <span>45 GW</span>
              </div>
            </div>

            {/* Day-Ahead Thermal Price */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-stone-700 font-medium flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-beige-700" />
                  <span>Day-Ahead Auction Price:</span>
                </span>
                <span className="font-mono text-stone-900 font-bold">£{daPrice}/MWh</span>
              </div>
              <input
                type="range"
                min={40}
                max={200}
                step={5}
                value={daPrice}
                onChange={(e) => setDaPrice(Number(e.target.value))}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-700"
              />
              <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                <span>£40/MWh</span>
                <span>Wholesale Baseload</span>
                <span>£200/MWh</span>
              </div>
            </div>

            {/* Imbalance Cashout System Buy Price */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-stone-700 font-medium flex items-center space-x-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-burgundy-700" />
                  <span>System Buy Price (Cashout):</span>
                </span>
                <span className="font-mono text-burgundy-900 font-bold">£{cashoutPrice}/MWh</span>
              </div>
              <input
                type="range"
                min={80}
                max={400}
                step={5}
                value={cashoutPrice}
                onChange={(e) => setCashoutPrice(Number(e.target.value))}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-burgundy-700"
              />
              <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                <span>£80/MWh</span>
                <span>Penalty Spread: £{Math.max(0, cashoutPrice - daPrice)}/MWh</span>
                <span>£400/MWh</span>
              </div>
            </div>
          </div>

          {/* 4 Procurement KPI Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-1">
              <span className="text-[11px] text-stone-500 uppercase tracking-wide font-medium font-mono">
                Total Consumer Demand
              </span>
              <p className="text-xl font-bold font-mono text-stone-900">
                {Math.round(procurementSummary.totalDemandMwh).toLocaleString()}{' '}
                <span className="text-xs font-sans text-stone-500 font-normal">MWh</span>
              </p>
              <p className="text-[11px] text-stone-500">
                Wind Coverage:{' '}
                <strong className="text-burgundy-700 font-mono">
                  {procurementSummary.windCoveragePct.toFixed(1)}%
                </strong>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-burgundy-200/90 shadow-2xs space-y-1">
              <span className="text-[11px] text-stone-500 uppercase tracking-wide font-medium font-mono">
                Day-Ahead Thermal Req (P90)
              </span>
              <p className="text-xl font-bold font-mono text-burgundy-800">
                {Math.round(procurementSummary.totalThermalP90Mwh).toLocaleString()}{' '}
                <span className="text-xs font-sans text-stone-500 font-normal">MWh</span>
              </p>
              <p className="text-[11px] text-stone-500">
                Unadjusted Wind Req:{' '}
                <span className="font-mono text-stone-700">
                  {Math.round(procurementSummary.totalThermalRawMwh).toLocaleString()} MWh
                </span>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-beige-300 shadow-2xs space-y-1">
              <span className="text-[11px] text-stone-500 uppercase tracking-wide font-medium font-mono">
                Peak Thermal Capacity
              </span>
              <p className="text-xl font-bold font-mono text-stone-900">
                {formatMW(procurementSummary.peakThermalMw)}
              </p>
              <p className="text-[11px] text-stone-500">
                Buffer Reserve Volume:{' '}
                <strong className="text-beige-800 font-mono">
                  +{Math.round(procurementSummary.bufferMwh).toLocaleString()} MWh
                </strong>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-br from-beige-100/90 to-beige-50 border border-beige-300 shadow-2xs space-y-1">
              <span className="text-[11px] text-burgundy-900 uppercase tracking-wide font-semibold font-mono">
                Imbalance Penalty Hedged
              </span>
              <p className="text-xl font-bold font-mono text-burgundy-900">
                £{(procurementSummary.hedgedSavingsGbp / 1000).toFixed(0)}k{' '}
                <span className="text-xs font-sans text-stone-600 font-normal">protected</span>
              </p>
              <p className="text-[11px] text-stone-600">
                Avoids £{Math.max(0, cashoutPrice - daPrice)}/MWh cash-out shortfall premium
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 48-Row Granular Settlement Period Table with CSV Download */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-sm font-bold text-stone-900 tracking-wide flex items-center space-x-2">
              <span>Settlement Period Schedule (48 Half-Hours)</span>
              <span className="text-[11px] text-stone-500 font-mono">
                {deliveryDate} | Cutoff: {cutoff}
              </span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Target delivery start time, published model run, forecast lead horizon, consumer demand, and quantitative buffer.
            </p>
          </div>

          <button
            id="download-csv-button"
            onClick={handleDownloadCsv}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-burgundy-700 hover:bg-burgundy-800 text-white flex items-center space-x-1.5 shadow-2xs transition-colors self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto max-h-[460px] rounded-lg border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-beige-100/80 text-stone-700 uppercase font-mono sticky top-0 border-b border-stone-200 z-10 shadow-2xs">
              <tr>
                <th className="py-2.5 px-3">SP</th>
                <th className="py-2.5 px-3">Time (UTC)</th>
                <th className="py-2.5 px-3 text-right">Forecast (MW)</th>
                <th className="py-2.5 px-3">Published At (UTC)</th>
                <th className="py-2.5 px-3 text-right">Horizon</th>
                <th className="py-2.5 px-3 text-right">Buffer (MW)</th>
                <th className="py-2.5 px-3 text-right">P90 Safe Hedge (MW)</th>
                {showProcurement && (
                  <>
                    <th className="py-2.5 px-3 text-right text-stone-800">Demand (MW)</th>
                    <th className="py-2.5 px-3 text-right text-burgundy-800">Thermal Req (MW)</th>
                  </>
                )}
                {revealActual && (
                  <>
                    <th className="py-2.5 px-3 text-right text-stone-700">Actual (MW)</th>
                    <th className="py-2.5 px-3 text-right">Error (MW)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-mono text-stone-800">
              {chartData.map((row) => (
                <tr
                  key={row.settlementPeriod}
                  className="hover:bg-beige-50/50 transition-colors"
                >
                  <td className="py-2 px-3 font-semibold text-stone-600">
                    {row.settlementPeriod}
                  </td>
                  <td className="py-2 px-3 text-stone-700 font-sans">{row.timeOnly}</td>
                  <td className="py-2 px-3 text-right text-burgundy-700 font-bold">
                    {row.forecast.toFixed(0)}
                  </td>
                  <td className="py-2 px-3 text-stone-500 text-[11px]">
                    {formatDateTimeUTC(row.publishedAtUtc)}
                  </td>
                  <td className="py-2 px-3 text-right text-stone-600">
                    {row.horizon.toFixed(1)}h
                  </td>
                  <td className="py-2 px-3 text-right text-beige-800 font-medium">
                    {row.bufferMw.toFixed(0)}
                  </td>
                  <td className="py-2 px-3 text-right text-stone-900 font-bold">
                    {row.p90Hedge.toFixed(0)}
                  </td>
                  {showProcurement && (
                    <>
                      <td className="py-2 px-3 text-right text-stone-800 font-mono">
                        {row.demand.toFixed(0)}
                      </td>
                      <td className="py-2 px-3 text-right text-burgundy-800 font-bold font-mono">
                        {row.thermalP90.toFixed(0)}
                      </td>
                    </>
                  )}
                  {revealActual && (
                    <>
                      <td className="py-2 px-3 text-right text-stone-700 font-semibold">
                        {row.actual !== null ? row.actual.toFixed(0) : '—'}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-semibold ${
                          row.error === null
                            ? 'text-stone-400'
                            : row.error > 0
                            ? 'text-burgundy-700'
                            : 'text-stone-600'
                        }`}
                      >
                        {row.error !== null
                          ? row.error > 0
                            ? `+${row.error.toFixed(0)}`
                            : row.error.toFixed(0)
                          : '—'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
