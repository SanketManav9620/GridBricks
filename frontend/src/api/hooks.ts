import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export const queryKeys = {
  health: ['health'] as const,
  meta: ['meta'] as const,
  forecast: (date: string, cutoff: string) => ['forecast', date, cutoff] as const,
  actuals: (date: string) => ['actuals', date] as const,
  accuracySummary: (cutoff: string) => ['accuracy', 'summary', cutoff] as const,
  accuracyDaily: (cutoff: string) => ['accuracy', 'daily', cutoff] as const,
  accuracyByHour: (cutoff: string) => ['accuracy', 'by-hour', cutoff] as const,
  accuracyByHorizon: (cutoff: string) => ['accuracy', 'by-horizon', cutoff] as const,
  accuracyDistribution: (cutoff: string, binSize: number) =>
    ['accuracy', 'distribution', cutoff, binSize] as const,
};

export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: apiClient.getMeta,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useForecast(deliveryDate: string, cutoff: string) {
  return useQuery({
    queryKey: queryKeys.forecast(deliveryDate, cutoff),
    queryFn: () => apiClient.getForecast(deliveryDate, cutoff),
    enabled: Boolean(deliveryDate && cutoff),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useActuals(deliveryDate: string) {
  return useQuery({
    queryKey: queryKeys.actuals(deliveryDate),
    queryFn: () => apiClient.getActuals(deliveryDate),
    enabled: Boolean(deliveryDate),
    staleTime: 1000 * 60 * 10,
  });
}

export function useAccuracySummary(cutoff: string) {
  return useQuery({
    queryKey: queryKeys.accuracySummary(cutoff),
    queryFn: () => apiClient.getAccuracySummary(cutoff),
    enabled: Boolean(cutoff),
    staleTime: 1000 * 60 * 10,
  });
}

export function useAccuracyDaily(cutoff: string) {
  return useQuery({
    queryKey: queryKeys.accuracyDaily(cutoff),
    queryFn: () => apiClient.getAccuracyDaily(cutoff),
    enabled: Boolean(cutoff),
    staleTime: 1000 * 60 * 10,
  });
}

export function useAccuracyByHour(cutoff: string) {
  return useQuery({
    queryKey: queryKeys.accuracyByHour(cutoff),
    queryFn: () => apiClient.getAccuracyByHour(cutoff),
    enabled: Boolean(cutoff),
    staleTime: 1000 * 60 * 10,
  });
}

export function useAccuracyByHorizon(cutoff: string) {
  return useQuery({
    queryKey: queryKeys.accuracyByHorizon(cutoff),
    queryFn: () => apiClient.getAccuracyByHorizon(cutoff),
    enabled: Boolean(cutoff),
    staleTime: 1000 * 60 * 10,
  });
}

export function useAccuracyDistribution(cutoff: string, binSize: number = 500) {
  return useQuery({
    queryKey: queryKeys.accuracyDistribution(cutoff, binSize),
    queryFn: () => apiClient.getAccuracyDistribution(cutoff, binSize),
    enabled: Boolean(cutoff),
    staleTime: 1000 * 60 * 10,
  });
}
