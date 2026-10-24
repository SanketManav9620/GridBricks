import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';

describe('EmptyState Component', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No Data Found" description="Try selecting a different date" />);
    expect(screen.getByText('No Data Found')).toBeInTheDocument();
    expect(screen.getByText('Try selecting a different date')).toBeInTheDocument();
  });

  it('renders action button and triggers callback', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        action={<button onClick={handleAction}>Reset Filters</button>}
      />
    );
    const btn = screen.getByText('Reset Filters');
    fireEvent.click(btn);
    expect(handleAction).toHaveBeenCalled();
  });
});

describe('ErrorState Component', () => {
  it('renders error message and retry button', () => {
    const handleRetry = vi.fn();
    render(<ErrorState message="API connection failed" onRetry={handleRetry} />);
    expect(screen.getByText('API connection failed')).toBeInTheDocument();

    const retryBtn = screen.getByText('Retry Query');
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalled();
  });
});
