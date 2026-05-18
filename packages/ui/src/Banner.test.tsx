import { render, screen } from '@testing-library/react';
import { Banner } from './Banner.js';

describe('Banner', () => {
  it('renders children', () => {
    render(<Banner>Test message</Banner>);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders without pulse dot by default', () => {
    const { container } = render(<Banner>msg</Banner>);
    expect(container.querySelector('.animate-pulse-dot')).toBeNull();
  });

  it('renders pulse dot when pulse=true', () => {
    const { container } = render(<Banner pulse>msg</Banner>);
    expect(container.querySelector('.animate-pulse-dot')).not.toBeNull();
  });

  it('applies warning tone classes by default', () => {
    const { container } = render(<Banner>msg</Banner>);
    expect(container.firstChild).toHaveClass('border-amber-500/60');
  });
});
