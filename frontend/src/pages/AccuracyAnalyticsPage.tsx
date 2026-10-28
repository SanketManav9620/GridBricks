import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Brush,
} from 'recharts';
import {
  ShieldCheck,
  BarChart2,
  Activity,
  TrendingDown,
  Target,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Download,
  Lightbulb,
} from 'lucide-react';
import {
  useAccuracySummary,
  useAccuracyDaily,
  useAccuracyByHour,
  useAccuracyByHorizon,
  useAccuracyDistribution,
  useAccuracyTimeseries,
} from '@/api/hooks';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { CutoffSelect } from '@/components/CutoffSelect';
import { SkeletonKpiGrid, SkeletonChart } from '@/components/SkeletonLoader';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { formatMW, formatPercent } from '@/lib/utils';
import { DailyAccuracyItem } from '@/types/api';

type SortField =
  | 'delivery_date'
  | 'bias'
  | 'mae'
  | 'rmse'
  | 'wape'
  | 'p90_over_forecast'
  | 'recommended_buffer_mw';
type SortDirection = 'asc' | 'desc';

export const AccuracyAnalyticsPage: React.FC = () => {
  // Set page title
  React.useEffect(() => {
    document.title = 'GridBricks | Accuracy & Safety Buffer Sizing';
  }, []);

  // Requirement: All views react to cutoff control, defaulting to 09:00
  const [cutoff, setCutoff] = useState<string>('09:00');

  // Daily table sorting state
  const [sortField, setSortField] = useState<SortField>('delivery_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Backend queries reacting dynamically to cutoff selection
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useAccuracySummary(cutoff);

  const { data: timeseriesData } = useAccuracyTimeseries(cutoff);
  const { data: dailyData } = useAccuracyDaily(cutoff);
  const { data: hourlyData } = useAccuracyByHour(cutoff);
  const { data: horizonData } = useAccuracyByHorizon(cutoff);
  const { data: distData } = useAccuracyDistribution(cutoff, 500);

  // Format month-long hourly timeseries data for Recharts (744 hours)
  const timeseriesChartData = useMemo(() => {
    if (!timeseriesData?.length) return [];
    return timeseriesData.map((pt) => {
      const dt = new Date(pt.startTime);
      const dayStr = String(dt.getUTCDate()).padStart(2, '0');
      const hrStr = String(dt.getUTCHours()).padStart(2, '0');
      const timeLabel = `${dayStr} Jan ${hrStr}:00`;

      return {
        startTime: pt.startTime,
        delivery_date: pt.delivery_date,
        timeLabel,
        displayDate: `${dayStr} Jan`,
        forecast: pt.forecast_mw,
        actual: pt.actual_mw,
        p90Hedge: pt.p90_hedge_mw,
        error: pt.error_mw,
      };
    });
  }, [timeseriesData]);

  // Sortable daily verification table rows
  const sortedDailyData = useMemo(() => {
    if (!dailyData?.length) return [];
    return [...dailyData].sort((a: DailyAccuracyItem, b: DailyAccuracyItem) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      aVal = Number(aVal);
      bVal = Number(bVal);
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [dailyData, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // CSV export for daily error verification table
  const handleDownloadDailyCsv = () => {
    if (!sortedDailyData.length) return;
    const headers = [
      'Delivery Date',
      'Hours Evaluated',
      'Mean Bias (MW)',
      'MAE (MW)',
      'RMSE (MW)',
      'WAPE (%)',
      'P90 Over-Forecast (MW)',
      'Within ±10% (%)',
      'Expanding Safety Buffer (MW)',
    ];

    const rows = sortedDailyData.map((r) => [
      r.delivery_date,
      r.count,
      r.bias.toFixed(1),
      r.mae.toFixed(1),
      r.rmse.toFixed(1),
      r.wape.toFixed(2),
      r.p90_over_forecast.toFixed(1),
      r.pct_within_10pct.toFixed(1),
      r.recommended_buffer_mw.toFixed(1),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_accuracy_verification_cutoff_${cutoff.replace(':', '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Loading State
  if (summaryLoading && !summary) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div className="h-8 w-64 bg-stone-200 rounded animate-pulse" />
          <div className="h-10 w-44 bg-stone-200 rounded animate-pulse" />
        </div>
        <SkeletonKpiGrid />
        <SkeletonChart height="h-96" />
      </div>
    );
  }

  // Error State
  if (summaryError) {
    return (
      <ErrorState
        title="Failed to calculate accuracy analytics"
        message={
          summaryError instanceof Error
            ? summaryError.message
            : 'An unexpected error occurred while communicating with the analytics backend.'
        }
        onRetry={refetchSummary}
      />
    );
  }

  // Empty State
  if (!summary) {
    return (
      <EmptyState
        title="No Accuracy Analytics Available"
        description={`No verified delivery errors were found for cutoff ${cutoff}.`}
        action={
          <button
            onClick={() => setCutoff('09:00')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-burgundy-700 hover:bg-burgundy-800 text-white"
          >
            Reset to Default (09:00 London)
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Cutoff Control */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-stone-200/90">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 flex items-center space-x-2">
            <span>Quantitative Accuracy & Risk Verification</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-beige-100 text-burgundy-900 border border-beige-300 font-mono font-semibold">
              January 2026 (744 Hours)
            </span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Empirical statistical verification of Elexon Day-Ahead Wind forecasts against actual outturn. All metrics update dynamically with decision cutoff.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-stone-600 font-medium hidden sm:inline">D-1 Cutoff:</span>
          <CutoffSelect cutoff={cutoff} onChange={setCutoff} />
        </div>
      </div>

      {/* KPI Row (5 Metrics with Definitions in Tooltips): MAE, RMSE, Bias, WAPE, P90 Over-Forecast */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <KpiCard
          title="Mean Absolute Error (MAE)"
          value={formatMW(summary.mae_mw)}
          subtitle={`WAPE: ${summary.wape_pct.toFixed(1)}%`}
          tooltip="MAE = (1/N) * Σ |Forecast - Actual|. Average absolute error magnitude across all delivery hours, indicating standard model dispersion regardless of over/under direction."
          icon={BarChart2}
          variant="burgundy"
        />

        <KpiCard
          title="Root Mean Sq Error (RMSE)"
          value={formatMW(summary.rmse_mw)}
          subtitle="Penalizes extreme misses"
          tooltip="RMSE = √((1/N) * Σ (Forecast - Actual)²). Quadratic metric that severely penalizes large forecast misses, vital for identifying sudden meteorological ramp failures."
          icon={TrendingDown}
          variant="burgundy"
        />

        <KpiCard
          title="Mean Bias Error (MBE)"
          value={`${summary.bias_mw > 0 ? '+' : ''}${formatMW(summary.bias_mw)}`}
          subtitle={`${((summary.bias_mw / summary.mean_actual_mw) * 100).toFixed(1)}% of mean outturn`}
          tooltip="Bias = (1/N) * Σ (Forecast - Actual). Systematic directional deviation. A positive bias means the model persistently over-forecasts generation, causing short cash-out imbalances."
          icon={Activity}
          variant="beige"
          badge={summary.bias_mw > 0 ? 'Over-Forecast Risk' : 'Under-Forecast'}
        />

        <KpiCard
          title="WAPE"
          value={formatPercent(summary.wape_pct)}
          subtitle="Weighted Abs Percentage"
          tooltip="WAPE = (Σ |Forecast - Actual| / Σ Actual) * 100%. Capacity-weighted relative accuracy. Avoids division by zero during low-wind periods."
          icon={Target}
          variant="beige"
        />

        <KpiCard
          title="P90 Over-Forecast Shortfall"
          value={formatMW(summary.p90_over_forecast_mw)}
          subtitle="90th percentile miss"
          tooltip="P90 Over-Forecast = 90th percentile of (Forecast - Actual). In 90% of hours, generation shortfall does not exceed this quantity."
          icon={ShieldCheck}
          variant="burgundy"
          badge="Downside Tail"
        />
      </div>

      {/* Recommended Buffer Callout in Plain Language */}
      <div className="rounded-xl border border-beige-300 bg-gradient-to-r from-beige-50/90 via-white to-beige-50/60 p-5 shadow-xs space-y-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-burgundy-50 border border-burgundy-200">
            <Lightbulb className="w-5 h-5 text-burgundy-700" />
          </div>
          <h3 className="text-base font-bold text-stone-900 tracking-tight">
            Recommended Trading Safety Buffer: {formatMW(summary.recommended_buffer_p90_mw)}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-burgundy-50 text-burgundy-900 border border-burgundy-200 font-semibold font-mono">
            90% Shortfall Protection
          </span>
        </div>

        <div className="text-xs text-stone-700 leading-relaxed space-y-2">
          <p>
            Across all 744 hours of January 2026, Day-Ahead wind forecasts at cutoff {cutoff} London exhibited a persistent positive bias of{' '}
            <strong className="text-burgundy-800 font-semibold">
              +{formatMW(summary.bias_mw)}
            </strong>
            . Submitting raw unadjusted forecasts into the day-ahead auction systematically leaves the trading desk short in physical delivery, triggering punitive System Buy Price (SBP) cash-out charges.
          </p>
          <p>
            <strong className="text-stone-900 font-semibold">Trading Desk Rule: </strong>
            To protect day-ahead bid positions with <strong className="text-burgundy-800">90% statistical confidence</strong>, deduct{' '}
            <strong className="text-burgundy-800 font-semibold font-mono">
              {formatMW(summary.recommended_buffer_p90_mw)}
            </strong>{' '}
            from the raw latest forecast before auction submission (<code className="px-1.5 py-0.5 rounded bg-white text-burgundy-800 border border-beige-300 font-mono shadow-2xs">Safe Bid = max(0, Raw Forecast - Buffer)</code>). For high-risk or price-spike periods, a P95 buffer of{' '}
            <strong className="text-beige-800 font-semibold font-mono">
              {formatMW(summary.recommended_buffer_p95_mw)}
            </strong>{' '}
            ensures 95% protection against deficit cash-out risk.
          </p>
        </div>
      </div>

      {/* Chart 1: Whole-Month Forecast vs Actual with Interactive Zoom / Brush (744 Hours) */}
      <ChartCard
        title="Full-Month Day-Ahead Forecast vs Actual Generation (January 2026)"
        subtitle={`All 744 hourly delivery periods at ${cutoff} cutoff | Use the brush bar below to zoom and inspect any multi-day weather front`}
        tooltip="Dual-line timeseries comparing day-ahead forecast vs actual generation outturn across all 31 days of January 2026. The warm bronze dashed curve illustrates the P90 safe hedge volume. Drag the brush handles at the bottom to zoom into specific storm ramps or calm periods."
        height="h-96"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={timeseriesChartData}
            margin={{ top: 15, right: 20, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e5df" vertical={false} />

            <XAxis
              dataKey="timeLabel"
              stroke="#78716c"
              fontSize={10}
              tickLine={false}
              interval={47} // show approximately 1 tick per 2 days
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
                  <div className="bg-white border border-stone-200 p-3 rounded-lg shadow-xl text-xs space-y-1.5 font-sans">
                    <p className="font-semibold text-stone-900 border-b border-stone-100 pb-1 flex justify-between">
                      <span>{d.timeLabel} UTC</span>
                      <span className="font-mono text-stone-500">{d.delivery_date}</span>
                    </p>
                    <div className="flex justify-between space-x-4">
                      <span className="text-burgundy-700 font-medium">Day-Ahead Forecast:</span>
                      <span className="font-mono text-stone-900 font-semibold">{formatMW(d.forecast)}</span>
                    </div>
                    {d.actual !== null && (
                      <div className="flex justify-between space-x-4 text-stone-700">
                        <span className="font-medium">Actual Outturn:</span>
                        <span className="font-mono text-stone-900 font-semibold">{formatMW(d.actual)}</span>
                      </div>
                    )}
                    {d.error !== null && (
                      <div className="flex justify-between space-x-4 text-[11px]">
                        <span className={d.error > 0 ? 'text-burgundy-700' : 'text-beige-800'}>
                          {d.error > 0 ? 'Over-Forecast Miss:' : 'Under-Forecast Miss:'}
                        </span>
                        <span className="font-mono font-medium text-stone-800">
                          {d.error > 0 ? `+${d.error.toFixed(0)} MW` : `${d.error.toFixed(0)} MW`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between space-x-4 border-t border-stone-100 pt-1 text-beige-800">
                      <span>P90 Safe Hedge:</span>
                      <span className="font-mono font-semibold">{formatMW(d.p90Hedge)}</span>
                    </div>
                  </div>
                );
              }}
            />

            <Legend
              wrapperStyle={{ paddingTop: '6px', fontSize: '11px' }}
              formatter={(value) => <span className="text-stone-700 font-medium">{value}</span>}
            />

            {/* P90 Hedge Band Line */}
            <Line
              type="monotone"
              dataKey="p90Hedge"
              name="P90 Safe Hedge"
              stroke="#b59672"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />

            {/* Day-Ahead Forecast */}
            <Line
              type="monotone"
              dataKey="forecast"
              name="Day-Ahead Forecast (Cutoff)"
              stroke="#871736"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#871736' }}
            />

            {/* Actual Outturn Line */}
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual Outturn (FUELHH)"
              stroke="#282520"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: '#282520' }}
            />

            {/* Month-Wide Interactive Brush Slider */}
            <Brush
              dataKey="timeLabel"
              height={32}
              stroke="#871736"
              fill="#f7f6f3"
              tickFormatter={(idx) => {
                const pt = timeseriesChartData[idx];
                return pt ? pt.displayDate : '';
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Row 2: Error Histogram & Diurnal Hourly Error Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Histogram Distribution */}
        <ChartCard
          title="Forecast Error Distribution (Forecast - Actual)"
          subtitle="Histogram in 500 MW bins illustrating positive skew and tail shortfall risk"
          tooltip="Visualizes the distribution of hourly errors (Forecast - Actual). Bins to the right of zero indicate over-forecasting (desk shortfall). The marker highlights the zero-error boundary."
          height="h-80"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distData || []} margin={{ top: 15, right: 15, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e5df" vertical={false} />
              <XAxis
                dataKey="bin_label"
                stroke="#78716c"
                fontSize={10}
                interval={1}
                angle={-30}
                textAnchor="end"
              />
              <YAxis
                stroke="#78716c"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-stone-200 p-2.5 rounded-lg text-xs space-y-1 shadow-lg font-mono">
                      <p className="font-semibold text-stone-900 font-sans">Bin: {d.bin_label} MW</p>
                      <p className="text-burgundy-700">Frequency: {d.frequency_pct.toFixed(1)}%</p>
                      <p className="text-stone-500">Count: {d.count} hours</p>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                x="[0, 500)"
                stroke="#78716c"
                strokeDasharray="3 3"
                label={{ value: 'Zero Error', fill: '#78716c', fontSize: 10, position: 'top' }}
              />
              <Bar
                dataKey="frequency_pct"
                name="Frequency (%)"
                fill="#871736"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Diurnal Error Profile (By Hour of Day 00:00 to 23:00 UTC) */}
        <ChartCard
          title="Diurnal Hourly Error Profile (00:00 to 23:00 UTC)"
          subtitle="MAE and Mean Bias across the 24 hours of the delivery day"
          tooltip="Examines error variation across settlement hours. Reveals whether morning wind ramps or evening peak demand periods suffer higher bias."
          height="h-80"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData || []} margin={{ top: 15, right: 15, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e5df" vertical={false} />
              <XAxis
                dataKey="hour"
                stroke="#78716c"
                fontSize={11}
                tickLine={false}
                tickFormatter={(h) => `${h}:00`}
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
                    <div className="bg-white border border-stone-200 p-2.5 rounded-lg text-xs space-y-1 shadow-lg font-mono">
                      <p className="font-semibold text-stone-900 font-sans">Hour {d.hour}:00 UTC</p>
                      <p className="text-burgundy-700">MAE: {formatMW(d.mae)}</p>
                      <p className="text-beige-800">
                        Bias: {d.bias > 0 ? `+${d.bias.toFixed(0)}` : d.bias.toFixed(0)} MW
                      </p>
                      <p className="text-stone-700">
                        P90 Shortfall: {formatMW(d.p90_over_forecast)}
                      </p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="mae" name="Hourly MAE (MW)" fill="#871736" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bias" name="Hourly Bias (MW)" fill="#cbb08f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3: Error by Forecast Horizon */}
      <ChartCard
        title="Error by Forecast Horizon / Lead Time"
        subtitle="Error metric progression across lead-time buckets (0-6h, 6-12h, 12-24h, 24-48h, 48h+)"
        tooltip="Demonstrates the degradation of weather model precision as forecast horizon increases from intraday (0-6h) to two-day ahead (24-48h)."
        height="h-72"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={horizonData || []} margin={{ top: 15, right: 15, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e5df" vertical={false} />
            <XAxis dataKey="horizon_bucket" stroke="#78716c" fontSize={11} tickLine={false} />
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
                  <div className="bg-white border border-stone-200 p-2.5 rounded-lg text-xs space-y-1 shadow-lg font-mono">
                    <p className="font-semibold text-stone-900 font-sans">{d.horizon_bucket}</p>
                    <p className="text-burgundy-700">MAE: {formatMW(d.mae)}</p>
                    <p className="text-burgundy-900">RMSE: {formatMW(d.rmse)}</p>
                    <p className="text-beige-800">
                      Bias: {d.bias > 0 ? `+${d.bias.toFixed(0)}` : d.bias.toFixed(0)} MW
                    </p>
                    <p className="text-stone-600">WAPE: {d.wape.toFixed(1)}%</p>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="mae" name="MAE (MW)" fill="#871736" radius={[4, 4, 0, 0]} />
            <Bar dataKey="rmse" name="RMSE (MW)" fill="#541025" radius={[4, 4, 0, 0]} />
            <Bar dataKey="bias" name="Bias (MW)" fill="#cbb08f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Row 4: Sortable Daily Error Table */}
      <div className="rounded-xl border border-stone-200/90 bg-white p-5 overflow-hidden shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-stone-200/80">
          <div>
            <h3 className="text-sm font-semibold text-stone-900 tracking-wide flex items-center space-x-2">
              <span>Daily Error Verification Schedule (31 Days)</span>
              <span className="text-[11px] text-stone-500 font-mono">Cutoff: {cutoff}</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Click table headers to sort ascending or descending. Dynamic expanding buffer is computed with strictly past data.
            </p>
          </div>

          <button
            id="download-daily-csv-button"
            onClick={handleDownloadDailyCsv}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-burgundy-700 hover:bg-burgundy-800 text-white flex items-center space-x-1.5 shadow-2xs transition-colors self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Daily CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto max-h-[440px] rounded border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-beige-100/80 text-stone-700 uppercase font-mono sticky top-0 border-b border-stone-200 z-10 shadow-2xs select-none">
              <tr>
                <th
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSort('delivery_date')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('delivery_date');
                    }
                  }}
                  className="py-2.5 px-3 cursor-pointer hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-burgundy-600"
                >
                  <div className="flex items-center space-x-1">
                    <span>Delivery Date</span>
                    {sortField === 'delivery_date' ? (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-burgundy-700" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-burgundy-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400" />
                    )}
                  </div>
                </th>

                <th
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSort('bias')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('bias');
                    }
                  }}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-burgundy-600"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Bias (MW)</span>
                    {sortField === 'bias' ? (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-burgundy-700" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-burgundy-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400" />
                    )}
                  </div>
                </th>

                <th
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSort('mae')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('mae');
                    }
                  }}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-burgundy-600"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>MAE (MW)</span>
                    {sortField === 'mae' ? (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-burgundy-700" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-burgundy-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400" />
                    )}
                  </div>
                </th>

                <th
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSort('rmse')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('rmse');
                    }
                  }}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-burgundy-600"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>RMSE (MW)</span>
                    {sortField === 'rmse' ? (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-burgundy-700" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-burgundy-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400" />
                    )}
                  </div>
                </th>

                <th
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSort('wape')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('wape');
                    }
                  }}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-burgundy-600"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>WAPE (%)</span>
                    {sortField === 'wape' ? (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-burgundy-700" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-burgundy-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400" />
                    )}
                  </div>
                </th>

                <th
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSort('p90_over_forecast')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('p90_over_forecast');
                    }
                  }}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-burgundy-600"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>P90 Miss (MW)</span>
                    {sortField === 'p90_over_forecast' ? (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-burgundy-700" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-burgundy-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400" />
                    )}
                  </div>
                </th>

                <th
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSort('recommended_buffer_mw')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('recommended_buffer_mw');
                    }
                  }}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-burgundy-600"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Dynamic Buffer (MW)</span>
                    {sortField === 'recommended_buffer_mw' ? (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-burgundy-700" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-burgundy-700" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-100 font-mono text-stone-700">
              {sortedDailyData.map((row) => (
                <tr key={row.delivery_date} className="hover:bg-beige-50/50 transition-colors">
                  <td className="py-2 px-3 font-semibold text-stone-800">{row.delivery_date}</td>

                  <td
                    className={`py-2 px-3 text-right font-medium ${
                      row.bias > 0 ? 'text-burgundy-700' : 'text-stone-600'
                    }`}
                  >
                    {row.bias > 0 ? `+${row.bias.toFixed(0)}` : row.bias.toFixed(0)}
                  </td>

                  <td className="py-2 px-3 text-right text-stone-700">{row.mae.toFixed(0)}</td>

                  <td className="py-2 px-3 text-right text-burgundy-900 font-semibold">{row.rmse.toFixed(0)}</td>

                  <td className="py-2 px-3 text-right text-stone-800 font-semibold">
                    {row.wape.toFixed(1)}%
                  </td>

                  <td className="py-2 px-3 text-right text-beige-800 font-medium">
                    {row.p90_over_forecast.toFixed(0)}
                  </td>

                  <td className="py-2 px-3 text-right text-burgundy-800 font-bold">
                    {row.recommended_buffer_mw > 0 ? row.recommended_buffer_mw.toFixed(0) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
