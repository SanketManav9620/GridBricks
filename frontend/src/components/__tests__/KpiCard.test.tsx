import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KpiCard } from '../KpiCard';
import { Wind } from 'lucide-react';

describe('KpiCard Component', () => {
  it('renders title and value correctly', () => {
    render(<KpiCard title="Avg Forecast" value="14,250 MW" />);
    expect(screen.getByText('Avg Forecast')).toBeInTheDocument();
    expect(screen.getByText('14,250 MW')).toBeInTheDocument();
  });

  it('renders subtitle and badge when provided', () => {
    render(
      <KpiCard
        title="Peak Forecast"
        value="18,100 MW"
        subtitle="Delivery period 36"
        badge="Peak"
      />
    );
    expect(screen.getByText('Delivery period 36')).toBeInTheDocument();
    expect(screen.getByText('Peak')).toBeInTheDocument();
  });

  it('renders with custom icon', () => {
    const { container } = render(
      <KpiCard title="Wind Gen" value="12,000 MW" icon={Wind} variant="teal" />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders info tooltip when tooltip prop is passed', () => {
    render(
      <KpiCard
        title="P90 Risk Buffer"
        value="1,840 MW"
        tooltip="90th percentile of historical over-forecast error"
      />
    );
    expect(screen.getByLabelText('Information')).toBeInTheDocument();
  });
});
