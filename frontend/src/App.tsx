import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { DayAheadDeskPage } from '@/pages/DayAheadDeskPage';
import { AccuracyAnalyticsPage } from '@/pages/AccuracyAnalyticsPage';
import { MethodologyPage } from '@/pages/MethodologyPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<DayAheadDeskPage />} />
            <Route path="/accuracy" element={<AccuracyAnalyticsPage />} />
            <Route path="/analytics" element={<AccuracyAnalyticsPage />} />
            <Route path="/method" element={<MethodologyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
};


export default App;
