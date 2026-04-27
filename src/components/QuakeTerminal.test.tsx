import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QuakeTerminal } from './QuakeTerminal';

// Mock TerminalContent
vi.mock('./TerminalContent', () => ({
  TerminalContent: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="terminal-content">
      {isOpen && <div>Terminal Open</div>}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

describe('QuakeTerminal', () => {
  it('should render trigger button', () => {
    render(<QuakeTerminal />);
    expect(screen.getByRole('button', { name: /Open terminal/i })).toBeInTheDocument();
  });

  it('should have proper ARIA attributes when closed', () => {
    render(<QuakeTerminal />);
    const trigger = screen.getByRole('button', { name: /Open terminal/i });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-label', 'Open terminal');
  });

  it('should toggle terminal when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<QuakeTerminal />);

    const trigger = screen.getByRole('button', { name: /Open terminal/i });
    await user.click(trigger);

    expect(screen.getByText('Terminal Open')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-label', 'Close terminal');
  });

  it('should show backdrop when terminal is open', async () => {
    const user = userEvent.setup();
    const { container } = render(<QuakeTerminal />);

    const trigger = screen.getByRole('button', { name: /Open terminal/i });
    await user.click(trigger);

    // Backdrop should be present when open
    const backdrop = container.querySelector('.quake-terminal-backdrop');
    expect(backdrop).toBeInTheDocument();
  });

  it('should close terminal when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<QuakeTerminal />);

    // Open terminal
    const trigger = screen.getByRole('button', { name: /Open terminal/i });
    await user.click(trigger);

    expect(screen.getByText('Terminal Open')).toBeInTheDocument();

    // Click backdrop
    const backdrop = container.querySelector('.quake-terminal-backdrop');
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);

    expect(screen.queryByText('Terminal Open')).not.toBeInTheDocument();
  });

  it('should apply correct CSS classes when open/closed', async () => {
    const user = userEvent.setup();
    render(<QuakeTerminal />);

    const trigger = screen.getByRole('button', { name: /Open terminal/i });

    // Closed state
    expect(trigger).not.toHaveClass('is-open');

    // Open terminal
    await user.click(trigger);
    expect(trigger).toHaveClass('is-open');
  });

  it('should use custom height percentage', () => {
    const { container } = render(<QuakeTerminal heightPercent={50} />);

    const panel = container.querySelector('.quake-terminal-panel');
    expect(panel).toHaveStyle({ height: '50vh' });
  });

  it('should use default height of 40vh', () => {
    const { container } = render(<QuakeTerminal />);

    const panel = container.querySelector('.quake-terminal-panel');
    expect(panel).toHaveStyle({ height: '40vh' });
  });

  it('should have keyboard accessible trigger button', () => {
    render(<QuakeTerminal />);

    const trigger = screen.getByRole('button', { name: /Open terminal/i });
    expect(trigger).toHaveAttribute('type', 'button');
  });

  it('should render terminal icon in trigger', () => {
    const { container } = render(<QuakeTerminal />);

    const icon = container.querySelector('.quake-terminal-trigger-icon');
    expect(icon).toBeInTheDocument();
  });

  it('should show correct arrow direction', async () => {
    const user = userEvent.setup();
    const { container } = render(<QuakeTerminal />);

    const arrow = container.querySelector('.quake-terminal-trigger-arrow');

    // Closed: down arrow
    expect(arrow?.textContent).toBe('▼');

    // Open: up arrow
    const trigger = screen.getByRole('button', { name: /Open terminal/i });
    await user.click(trigger);
    expect(arrow?.textContent).toBe('▲');
  });
});
