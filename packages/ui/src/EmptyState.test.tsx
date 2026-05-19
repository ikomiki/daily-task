import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState.js';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items" />);
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('renders hint when provided', () => {
    render(<EmptyState title="No items" hint="Add one to get started" />);
    expect(screen.getByText('Add one to get started')).toBeInTheDocument();
  });

  it('does not render hint when omitted', () => {
    render(<EmptyState title="No items" />);
    expect(screen.queryByText('Add one')).toBeNull();
  });

  it('renders icon when provided', () => {
    render(<EmptyState title="No items" icon={<span data-testid="icon">★</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
