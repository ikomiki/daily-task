import { render, screen } from '@testing-library/react';
import type React from 'react';
import { TopBar } from './TopBar.js';

const FakeLink = ({
  to,
  children,
  ...props
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}) => (
  <a href={to} {...props}>
    {children}
  </a>
);

describe('TopBar', () => {
  it('renders brand label', () => {
    render(<TopBar linkComponent={FakeLink} />);
    expect(screen.getByText('habits')).toBeInTheDocument();
  });

  it('uses custom homeLabel', () => {
    render(<TopBar linkComponent={FakeLink} homeLabel="myapp" />);
    expect(screen.getByText('myapp')).toBeInTheDocument();
  });

  it('renders rightSlot', () => {
    render(<TopBar linkComponent={FakeLink} rightSlot={<span>v1.0</span>} />);
    expect(screen.getByText('v1.0')).toBeInTheDocument();
  });

  it('home link has aria-label containing homeLabel', () => {
    render(<TopBar linkComponent={FakeLink} homeLabel="habits" />);
    expect(screen.getByRole('link', { name: /habits/i })).toBeInTheDocument();
  });
});
