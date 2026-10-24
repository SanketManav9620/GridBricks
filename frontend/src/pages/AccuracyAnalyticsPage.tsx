import React, { useState } from 'react';
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
} from 'recharts';
import { ShieldCheck, BarChart2, Activity, TrendingDown, Target } from 'lucide-react';
import {
  useAccuracySummary,
  useAccuracyDaily,
  useAccuracyByHour,
  useAccuracyByHorizon,
  useAccuracyDistribution,
} from '@/api/hooks';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { CutoffSelect } from '@/components/CutoffSelect';
import { SkeletonKpiGrid, SkeletonChart } from '@/components/SkeletonLoader';
import { ErrorState } from '@/components/ErrorState';
import { formatMW } from '@/lib/utils';

export const AccuracyAnalyticsPage: React.FC = () => {
  const [cutoff, setCutoff] = useState<string>('11:00');

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useAccuracySummary(cutoff);

  const { data: dailyData } = useAccuracyDaily(cutoff);
  const { data: hourlyData } = useAccuracyByHour(cutoff);
  const { data: horizonData } = useAccuracyByHorizon(cutoff);
  const { data: distData } = useAccuracyDistribution(cutoff, 500);

  if (summaryLoading && !summary) {
    return (
      <div className="space-y-6">
        <SkeletonKpiGrid />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  if (summaryError) {
    return (
      <ErrorState
        title="Failed to load accuracy analytics"
        message={
          summaryError instanceof Error ? summaryError.message : 'Error querying analytics backend.'
        }
        onRetry={refetchSummary}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Quantitative Accuracy & Safety Buffer Sizing</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Historical forecast verification across all 744 hours of January 2026. Evaluating
            systematic bias and buffer requirements.
          </p>
        </div>

        <div>
          <CutoffSelect cutoff={cutoff} onChange={setCutoff} />
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <KpiCard
          title="Mean Bias Error (MBE)"
          value={summary ? `${summary.bias_mw > 0 ? '+' : ''}${formatMW(summary.bias_mw)}` : '—'}
          subtitle={
            summary
              ? `${((summary.bias_mw / summary.mean_actual_mw) * 100).toFixed(1)}% of mean generation`
              : ''
          }
          tooltip="Average signed forecast error: (1/N) * sum(Forecast - Actual). Positive value indicates persistent over-forecasting (shortfall risk)."
          icon={Activity}
          variant="amber"
          badge={summary?.bias_mw && summary.bias_mw > 0 ? 'Over-Forecast' : 'Under-Forecast'}
        />

        <KpiCard
          title="Mean Absolute Error"
          value={formatMW(summary?.mae_mw)}
          subtitle={summary ? `WAPE: ${summary.wape_pct.toFixed(1)}%` : ''}
          tooltip="Average absolute error magnitude: (1/N) * sum(|Forecast - Actual|). Reflects standard dispersion regardless of direction."
          icon={BarChart2}
          variant="default"
        />

        <KpiCard
          title="Root Mean Sq Error"
          value={formatMW(summary?.rmse_mw)}
          subtitle="Penalizes large errors"
          tooltip="Square root of mean squared error. Heavily penalizes extreme forecast misses during sudden meteorological wind ramp events."
          icon={TrendingDown}
          variant="rose"
        />

        <KpiCard
          title="Recommended P90 Buffer"
          value={formatMW(summary?.recommended_buffer_p90_mw)}
          subtitle="90% shortfall protection"
          tooltip="90th percentile of historical over-forecast shortfalls. Sizing a generation deduction of this amount protects the utility from cash-out penalties in 90% of hours."
          icon={ShieldCheck}
          variant="amber"
          badge="P90 Risk"
        />

        <KpiCard
          title="P95 Safety Buffer"
          value={formatMW(summary?.recommended_buffer_p95_mw)}
          subtitle="95% high-confidence hedge"
          tooltip="95th percentile conservative buffer for highly risk-averse trading desks or high-price imbalance stress periods."
          icon={Target}
          variant="teal"
          badge="P95 Ultra-Safe"
        />
      </div>

      {/* Row 1: Daily Progression & Diurnal Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Error & Buffer Progression */}
        <ChartCard
          title="Daily MAE & Expanding Safety Buffer Progression"
          subtitle="MAE and dynamic expanding-window safety buffer (strictly using days prior to D)"
          tooltip="Evaluates day-to-day error volatility. The amber line shows the dynamic buffer calibrated on expanding history, proving zero look-ahead data leakage."
          height="h-80"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={dailyData || []}
              margin={{ top: 10, right: 15, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="delivery_date"
                stroke="#64748b"
                fontSize={10}
                tickFormatter={(d) => d.slice(8)} // show day '01', '02', etc.
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)} GW`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-navy-900 border border-slate-700 p-2.5 rounded-lg text-xs space-y-1 shadow-lg font-mono">
                      <p className="font-semibold text-white font-sans">{d.delivery_date}</p>
                      <p className="text-teal-400">MAE: {formatMW(d.mae)}</p>
                      <p className={d.bias > 0 ? 'text-amber-400' : 'text-sky-400'}>
                        Bias: {d.bias > 0 ? `+${d.bias.toFixed(0)}` : d.bias.toFixed(0)} MW
                      </p>
                      <p className="text-amber-300">
                        P90 Expanding Buffer: {formatMW(d.recommended_buffer_mw)}
                      </p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar
                dataKey="mae"
                name="Daily MAE (MW)"
                fill="#2dd4bf"
                opacity={0.7}
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="recommended_buffer_mw"
                name="Dynamic P90 Buffer"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Diurnal Error Profile (By Hour of Day 0-23) */}
        <ChartCard
          title="Diurnal Hourly Error Profile (00:00 to 23:00 UTC)"
          subtitle="Forecast MAE and Bias across the 24 hours of the delivery day"
          tooltip="Highlights intra-day error concentration. Identifies whether morning peak ramp or evening peak hours experience heightened forecast volatility."
          height="h-80"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData || []} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="hour"
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(h) => `${h}:00`}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)} GW`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-navy-900 border border-slate-700 p-2.5 rounded-lg text-xs space-y-1 shadow-lg font-mono">
                      <p className="font-semibold text-white font-sans">Hour {d.hour}:00 UTC</p>
                      <p className="text-teal-400">MAE: {formatMW(d.mae)}</p>
                      <p className="text-amber-400">
                        Bias: {d.bias > 0 ? `+${d.bias.toFixed(0)}` : d.bias.toFixed(0)} MW
                      </p>
                      <p className="text-slate-300">
                        Within ±10%: {d.pct_within_10pct.toFixed(1)}%
                      </p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="mae" name="Hourly MAE (MW)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bias" name="Hourly Bias (MW)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Horizon Degradation & Error Distribution Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horizon Degradation */}
        <ChartCard
          title="Lead-Time Horizon Error Degradation"
          subtitle="Progression of error metrics as forecast horizon expands"
          tooltip="Illustrates how meteorological certainty decreases with forecast horizon (e.g. 0-6h intraday vs 24-48h two-day ahead)."
          height="h-80"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={horizonData || []} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="horizon_bucket" stroke="#64748b" fontSize={11} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)} GW`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-navy-900 border border-slate-700 p-2.5 rounded-lg text-xs space-y-1 shadow-lg font-mono">
                      <p className="font-semibold text-white font-sans">{d.horizon_bucket}</p>
                      <p className="text-teal-400">MAE: {formatMW(d.mae)}</p>
                      <p className="text-rose-400">RMSE: {formatMW(d.rmse)}</p>
                      <p className="text-amber-400">
                        Bias: {d.bias > 0 ? `+${d.bias.toFixed(0)}` : d.bias.toFixed(0)} MW
                      </p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="mae" name="MAE (MW)" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rmse" name="RMSE (MW)" fill="#fb7185" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Error Histogram Distribution */}
        <ChartCard
          title="Forecast Error Distribution Histogram"
          subtitle={`Frequency distribution of (Forecast - Actual) in 500 MW bins with P90 Buffer overlay`}
          tooltip="Visualizes the asymmetry and fat-tail risk of wind forecasts. The amber reference line marks the 90% confidence buffer threshold."
          height="h-80"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distData || []} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="bin_label"
                stroke="#64748b"
                fontSize={10}
                interval={2}
                angle={-30}
                textAnchor="end"
              />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-navy-900 border border-slate-700 p-2.5 rounded-lg text-xs space-y-1 shadow-lg font-mono">
                      <p className="font-semibold text-white font-sans">Bin: {d.bin_label} MW</p>
                      <p className="text-teal-400">Frequency: {d.frequency_pct.toFixed(1)}%</p>
                      <p className="text-slate-400">Count: {d.count} periods</p>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                x="[0, 500)"
                stroke="#64748b"
                strokeDasharray="3 3"
                label={{ value: 'Zero Bias', fill: '#94a3b8', fontSize: 10 }}
              />
              <Bar
                dataKey="frequency_pct"
                name="Frequency (%)"
                fill="#0ea5e9"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};
