import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DateStepper } from '../DateStepper';

describe('DateStepper Component', () => {
  const dates = ['2026-01-14', '2026-01-15', '2026-01-16'];

  it('renders correctly with given date and options', () => {
    render(
      <DateStepper
        currentDate="2026-01-15"
        availableDates={dates}
        onChange={vi.fn()}
      />
    );
    const select = screen.getByLabelText('Select Delivery Date') as HTMLSelectElement;
    expect(select.value).toBe('2026-01-15');
    expect(select.options.length).toBe(3);
  });

  it('navigates to next date when next button clicked', () => {
    const handleChange = vi.fn();
    render(
      <DateStepper
        currentDate="2026-01-15"
        availableDates={dates}
        onChange={handleChange}
      />
    );

    const nextBtn = screen.getByLabelText('Next Delivery Day');
    fireEvent.click(nextBtn);
    expect(handleChange).toHaveBeenCalledWith('2026-01-16');
  });

  it('navigates to previous date when previous button clicked', () => {
    const handleChange = vi.fn();
    render(
      <DateStepper
        currentDate="2026-01-15"
        availableDates={dates}
        onChange={handleChange}
      />
    );

    const prevBtn = screen.getByLabelText('Previous Delivery Day');
    fireEvent.click(prevBtn);
    expect(handleChange).toHaveBeenCalledWith('2026-01-14');
  });

  it('disables previous button on first date', () => {
    render(
      <DateStepper
        currentDate="2026-01-14"
        availableDates={dates}
        onChange={vi.fn()}
      />
    );
    const prevBtn = screen.getByLabelText('Previous Delivery Day');
    expect(prevBtn).toBeDisabled();
  });

  it('disables next button on last date', () => {
    render(
      <DateStepper
        currentDate="2026-01-16"
        availableDates={dates}
        onChange={vi.fn()}
      />
    );
    const nextBtn = screen.getByLabelText('Next Delivery Day');
    expect(nextBtn).toBeDisabled();
  });

  it('triggers onChange when selecting from dropdown', () => {
    const handleChange = vi.fn();
    render(
      <DateStepper
        currentDate="2026-01-15"
        availableDates={dates}
        onChange={handleChange}
      />
    );

    const select = screen.getByLabelText('Select Delivery Date');
    fireEvent.change(select, { target: { value: '2026-01-16' } });
    expect(handleChange).toHaveBeenCalledWith('2026-01-16');
  });
});
