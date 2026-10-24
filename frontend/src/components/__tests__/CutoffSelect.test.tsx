import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CutoffSelect } from '../CutoffSelect';

describe('CutoffSelect Component', () => {
  it('renders default cutoff selection and options', () => {
    render(<CutoffSelect cutoff="09:00" onChange={vi.fn()} />);

    const select = screen.getByLabelText('Select D-1 Decision Cutoff Time') as HTMLSelectElement;
    expect(select.value).toBe('09:00');
    expect(screen.getByText('09:00 London (Default Desk Gate)')).toBeInTheDocument();
  });

  it('calls onChange when user selects a different cutoff', () => {
    const handleChange = vi.fn();
    render(<CutoffSelect cutoff="09:00" onChange={handleChange} />);

    const select = screen.getByLabelText('Select D-1 Decision Cutoff Time');
    fireEvent.change(select, { target: { value: '11:00' } });
    expect(handleChange).toHaveBeenCalledWith('11:00');
  });
});
