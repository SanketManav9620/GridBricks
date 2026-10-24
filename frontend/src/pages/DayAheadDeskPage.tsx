import React, { useState } from 'react';
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
import { Wind, ShieldAlert, Zap, TrendingUp, Eye, EyeOff } from 'lucide-react';
import { useMeta, useForecast, useActuals } from '@/api/hooks';
import { KpiCard } from '@/components/KpiCard';
import { ChartCard } from '@/components/ChartCard';
import { DateStepper } from '@/components/DateStepper';
import { CutoffSelect } from '@/components/CutoffSelect';
import { SkeletonKpiGrid, SkeletonChart } from '@/components/SkeletonLoader';
import { ErrorState } from '@/components/ErrorState';
import { formatMW, formatTimeHHMM } from '@/lib/utils';

export const DayAheadDeskPage: React.FC = () => {
  const { data: meta, isLoading: metaLoading } = useMeta();

  const [deliveryDate, setDeliveryDate] = useState<string>('2026-01-15');
  const [cutoff, setCutoff] = useState<string>('11:00');
  const [showRevisions, setShowRevisions] = useState<boolean>(false);
  const [showTable, setShowTable] = useState<boolean>(false);

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

  if (metaLoading || (!forecastData && forecastLoading)) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="h-8 w-64 bg-navy-800 rounded animate-pulse" />
          <div className="h-10 w-80 bg-navy-800 rounded animate-pulse" />
        </div>
        <SkeletonKpiGrid />
        <SkeletonChart height="h-96" />
      </div>
    );
  }

  if (forecastError) {
    return (
      <ErrorState
        title="Error loading forecast data"
        message={forecastError instanceof Error ? forecastError.message : 'Failed to query API.'}
        onRetry={refetchForecast}
      />
    );
  }

  // Combine forecast points and actual points by settlementPeriod
  const points = forecastData?.points || [];
  const actuals = actualsData?.points || [];
  const actualsMap = new Map(actuals.map((a) => [a.settlementPeriod, a.generation_mw]));

  const chartData = points.map((p) => {
    const actMW = actualsMap.get(p.settlementPeriod);
    const errorMW = actMW !== undefined ? p.forecast_mw - actMW : null;
    return {
      settlementPeriod: p.settlementPeriod,
      timeLabel: `SP${p.settlementPeriod} (${formatTimeHHMM(p.startTime)})`,
      timeOnly: formatTimeHHMM(p.startTime),
      forecast: p.forecast_mw,
      actual: actMW ?? null,
      p90Hedge: p.risk_band_p90_mw,
      p95Hedge: p.risk_band_p95_mw,
      horizon: p.horizon_hours,
      error: errorMW,
    };
  });

  // Calculate day summary metrics
  const meanForecast = points.length
    ? points.reduce((acc, p) => acc + p.forecast_mw, 0) / points.length
    : 0;
  const validActuals = actuals.filter((a) => a.generation_mw !== null);
  const meanActual = validActuals.length
    ? validActuals.reduce((acc, a) => acc + a.generation_mw, 0) / validActuals.length
    : null;
  const p90Buffer = forecastData?.p90_buffer_mw ?? 0;
  const p95Buffer = forecastData?.p95_buffer_mw ?? 0;

  // Max peak generation
  const peakPoint = points.reduce(
    (max, p) => (p.forecast_mw > max.forecast_mw ? p : max),
    points[0] || { forecast_mw: 0, settlementPeriod: 1 }
  );

  return (
    <div className="space-y-6">
      {/* Action Header & Date/Cutoff Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Day-Ahead Decision Dashboard</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Evaluating National Wind volume available before auction close on Day D-1 with
            quantitative shortfall buffers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateStepper
            currentDate={deliveryDate}
            availableDates={meta?.available_dates || [deliveryDate]}
            onChange={setDeliveryDate}
          />
          <CutoffSelect cutoff={cutoff} onChange={setCutoff} />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Day-Ahead Forecast"
          value={formatMW(meanForecast)}
          subtitle="Mean national wind generation"
          tooltip="Average forecasted wind power generation across all 48 half-hour settlement periods, published prior to D-1 cutoff."
          icon={Wind}
          variant="teal"
        />

        <KpiCard
          title="Outturn Actual"
          value={formatMW(meanActual)}
          subtitle={
            meanActual
              ? `${(meanForecast - meanActual).toFixed(0)} MW deviation`
              : 'Pending settlement'
          }
          tooltip="Actual half-hourly wind generation outturn aggregated from BMRS FUELHH."
          icon={Zap}
          variant={meanActual ? (meanForecast > meanActual ? 'amber' : 'teal') : 'default'}
        />

        <KpiCard
          title="Recommended P90 Buffer"
          value={formatMW(p90Buffer)}
          subtitle={`P95 High-Risk Buffer: ${formatMW(p95Buffer)}`}
          tooltip="Conservative deduction from raw forecast based on 90th percentile historical over-forecast shortfall. Selling (Forecast - Buffer) ensures 90% confidence against imbalances."
          icon={ShieldAlert}
          variant="amber"
          badge="90% Confidence"
        />

        <KpiCard
          title="Peak Period Forecast"
          value={formatMW(peakPoint?.forecast_mw)}
          subtitle={`Peak at SP ${peakPoint?.settlementPeriod} (${formatTimeHHMM(peakPoint?.startTime || '')})`}
          tooltip="Maximum expected wind generation half-hour during the delivery day."
          icon={TrendingUp}
          variant="blue"
        />
      </div>

      {/* Main Delivery Profile Chart */}
      <ChartCard
        title="Day-Ahead Delivery Generation Profile (48 Half-Hours)"
        subtitle={`Delivery Date: ${deliveryDate} | D-1 Cutoff: ${cutoff} London | Horizon: ~14.5h to 38.5h`}
        tooltip="Physical profile across 48 half-hourly settlement periods on Day D. The teal line represents the latest available forecast at D-1 decision time. The amber and shaded area indicates the safe bid volume after applying safety buffers."
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowRevisions(!showRevisions)}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1 border transition-colors ${
                showRevisions
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                  : 'bg-navy-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {showRevisions ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showRevisions ? 'Hide Revisions' : 'Show Revisions'}</span>
            </button>

            <button
              onClick={() => setShowTable(!showTable)}
              className="px-2.5 py-1 rounded text-xs font-semibold bg-navy-800 border border-slate-700 text-slate-300 hover:bg-navy-700 transition-colors"
            >
              {showTable ? 'Hide Table' : 'Table View'}
            </button>
          </div>
        }
        height="h-96"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id="p90HedgeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

            <XAxis
              dataKey="timeOnly"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              interval={3}
            />

            <YAxis
              stroke="#64748b"
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
                  <div className="bg-navy-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5 backdrop-blur-md">
                    <p className="font-semibold text-white border-b border-slate-800 pb-1">
                      {d.timeLabel}
                    </p>
                    <div className="flex justify-between space-x-4">
                      <span className="text-teal-400 font-medium">Day-Ahead Forecast:</span>
                      <span className="font-mono text-white">{formatMW(d.forecast)}</span>
                    </div>
                    {d.actual !== null && (
                      <div className="flex justify-between space-x-4">
                        <span className="text-sky-400 font-medium">Actual Outturn:</span>
                        <span className="font-mono text-white">{formatMW(d.actual)}</span>
                      </div>
                    )}
                    {d.error !== null && (
                      <div className="flex justify-between space-x-4">
                        <span className={d.error > 0 ? 'text-amber-400' : 'text-teal-400'}>
                          {d.error > 0 ? 'Over-Forecast Shortfall:' : 'Under-Forecast Surplus:'}
                        </span>
                        <span className="font-mono text-white">
                          {d.error > 0 ? `+${d.error.toFixed(0)} MW` : `${d.error.toFixed(0)} MW`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between space-x-4 border-t border-slate-800 pt-1 text-amber-300">
                      <span>P90 Safe Hedge:</span>
                      <span className="font-mono">{formatMW(d.p90Hedge)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-0.5">
                      Lead time horizon: {d.horizon.toFixed(1)}h
                    </div>
                  </div>
                );
              }}
            />

            <Legend
              wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }}
              formatter={(value) => <span className="text-slate-300">{value}</span>}
            />

            {/* P90 Hedge Band Area */}
            <Area
              type="monotone"
              dataKey="p90Hedge"
              name="P90 Safe Hedge Volume"
              fill="url(#p90HedgeGradient)"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />

            {/* Day-Ahead Latest Forecast */}
            <Line
              type="monotone"
              dataKey="forecast"
              name="Day-Ahead Forecast (Latest at Cutoff)"
              stroke="#2dd4bf"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#2dd4bf' }}
            />

            {/* Actual Outturn */}
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual Outturn (FUELHH)"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={{ r: 2.5, fill: '#38bdf8' }}
              activeDot={{ r: 5, fill: '#38bdf8' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Forecast Revisions Evolution Section (Fan Chart) */}
      {showRevisions && (forecastData?.revisions?.length ?? 0) > 0 && (
        <ChartCard
          title="Forecast Evolution / Revision Fan Chart"
          subtitle="Showing historical forecast trajectories published at different lead times leading up to auction cutoff."
          tooltip="Visualizes how the forecast evolved as the meteorological model updated. Demonstrates convergence or volatility in wind speed predictions."
          height="h-72"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="timeOnly" stroke="#64748b" fontSize={11} interval={3} />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)} GW`}
              />
              <Tooltip />
              <Legend />

              <Line
                type="monotone"
                dataKey="forecast"
                name="Latest at Cutoff"
                stroke="#2dd4bf"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Outturn"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* 48-Period Inspection Table */}
      {showTable && (
        <div className="rounded-xl border border-slate-800 bg-navy-900/80 p-4 overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
              Settlement Period Granular Data (48 Half-Hours)
            </h3>
            <span className="text-xs text-slate-400">All values in MW (UTC)</span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-400 uppercase font-mono sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">SP</th>
                  <th className="py-2 px-3">Delivery Time (UTC)</th>
                  <th className="py-2 px-3 text-right">Forecast (MW)</th>
                  <th className="py-2 px-3 text-right">Actual (MW)</th>
                  <th className="py-2 px-3 text-right">Error (MW)</th>
                  <th className="py-2 px-3 text-right">P90 Safe Hedge (MW)</th>
                  <th className="py-2 px-3 text-right">Horizon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {chartData.map((row) => (
                  <tr key={row.settlementPeriod} className="hover:bg-navy-800/40 transition-colors">
                    <td className="py-2 px-3 font-semibold text-slate-300">
                      {row.settlementPeriod}
                    </td>
                    <td className="py-2 px-3 text-slate-300">{row.timeOnly}</td>
                    <td className="py-2 px-3 text-right text-teal-300 font-semibold">
                      {row.forecast.toFixed(0)}
                    </td>
                    <td className="py-2 px-3 text-right text-sky-300">
                      {row.actual !== null ? row.actual.toFixed(0) : '—'}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        row.error === null
                          ? 'text-slate-500'
                          : row.error > 0
                            ? 'text-amber-400'
                            : 'text-teal-400'
                      }`}
                    >
                      {row.error !== null
                        ? row.error > 0
                          ? `+${row.error.toFixed(0)}`
                          : row.error.toFixed(0)
                        : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-300">
                      {row.p90Hedge.toFixed(0)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">
                      {row.horizon.toFixed(1)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
