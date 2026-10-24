/**
 * TypeScript API contracts matching backend/app/schemas.py
 */

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}

export interface MetaResponse {
  min_delivery_date: string;
  max_delivery_date: string;
  available_dates: string[];
  default_cutoff: string;
  market: string;
  fuel_type: string;
  total_actual_periods: number;
  total_forecast_versions: number;
}

export interface ForecastPoint {
  settlementPeriod: number;
  startTime: string;
  forecast_mw: number;
  publishTime: string;
  horizon_hours: number;
  risk_band_p90_mw: number;
  risk_band_p95_mw: number;
}

export interface RevisionItem {
  publishTime: string;
  startTime: string;
  forecast_mw: number;
  horizon_hours: number;
}

export interface ForecastResponse {
  delivery_date: string;
  cutoff: string;
  cutoff_time: string;
  points: ForecastPoint[];
  revisions: RevisionItem[];
  p90_buffer_mw: number;
  p95_buffer_mw: number;
}

export interface ActualPoint {
  settlementPeriod: number;
  startTime: string;
  generation_mw: number;
}

export interface ActualsResponse {
  delivery_date: string;
  points: ActualPoint[];
}

export interface AccuracySummaryResponse {
  cutoff: string;
  evaluation_window: string;
  total_delivery_periods: number;
  bias_mw: number;
  mae_mw: number;
  rmse_mw: number;
  wape_pct: number;
  p50_abs_error_mw: number;
  p90_abs_error_mw: number;
  p95_abs_error_mw: number;
  p90_over_forecast_mw: number;
  pct_within_10pct: number;
  mean_actual_mw: number;
  mean_forecast_mw: number;
  recommended_buffer_p90_mw: number;
  recommended_buffer_p95_mw: number;
}

export interface DailyAccuracyItem {
  delivery_date: string;
  count: number;
  bias: number;
  mae: number;
  rmse: number;
  wape: number;
  p90_over_forecast: number;
  pct_within_10pct: number;
  recommended_buffer_mw: number;
}

export interface HourlyAccuracyItem {
  hour: number;
  count: number;
  bias: number;
  mae: number;
  rmse: number;
  wape: number;
  p90_over_forecast: number;
  pct_within_10pct: number;
}

export interface HorizonAccuracyItem {
  horizon_bucket: string;
  count: number;
  bias: number;
  mae: number;
  rmse: number;
  wape: number;
  p90_over_forecast: number;
}

export interface ErrorHistogramItem {
  bin_min: number;
  bin_max: number;
  bin_label: string;
  count: number;
  frequency_pct: number;
}
