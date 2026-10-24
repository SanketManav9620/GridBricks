import {
  HealthResponse,
  MetaResponse,
  ForecastResponse,
  ActualsResponse,
  AccuracySummaryResponse,
  DailyAccuracyItem,
  HourlyAccuracyItem,
  HorizonAccuracyItem,
  ErrorHistogramItem,
  TimeseriesPoint,
} from '@/types/api';


const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, String(val));
      }
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    let errorMsg = `API request failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorMsg =
          typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Ignore json parse error on non-json error responses
    }
    throw new ApiError(response.status, errorMsg);
  }

  return response.json();
}

export const apiClient = {
  getHealth: () => request<HealthResponse>('/health'),
  getMeta: () => request<MetaResponse>('/meta'),
  getForecast: (deliveryDate: string, cutoff: string) =>
    request<ForecastResponse>('/forecast', { delivery_date: deliveryDate, cutoff }),
  getActuals: (deliveryDate: string) =>
    request<ActualsResponse>('/actuals', { delivery_date: deliveryDate }),
  getAccuracySummary: (cutoff: string) =>
    request<AccuracySummaryResponse>('/accuracy/summary', { cutoff }),
  getAccuracyDaily: (cutoff: string) => request<DailyAccuracyItem[]>('/accuracy/daily', { cutoff }),
  getAccuracyByHour: (cutoff: string) =>
    request<HourlyAccuracyItem[]>('/accuracy/by-hour', { cutoff }),
  getAccuracyByHorizon: (cutoff: string) =>
    request<HorizonAccuracyItem[]>('/accuracy/by-horizon', { cutoff }),
  getAccuracyDistribution: (cutoff: string, binSize: number = 500) =>
    request<ErrorHistogramItem[]>('/accuracy/distribution', { cutoff, bin_size_mw: binSize }),
  getAccuracyTimeseries: (cutoff: string) =>
    request<TimeseriesPoint[]>('/accuracy/timeseries', { cutoff }),
};

