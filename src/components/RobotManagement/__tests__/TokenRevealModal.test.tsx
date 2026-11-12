import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { TokenRevealModal } from '../TokenRevealModal';

const TOKEN = 'krkn-robot-secret-token-value';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  robotName: 'ci-runner',
  token: TOKEN,
  tokenId: 'tid-1',
  expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
};

/** Parent-style harness: the token lives only in parent useState. */
function Harness(props: { onClosed?: () => void }) {
  const [token, setToken] = useState(TOKEN);
  if (!token) {
    return <div data-testid="closed" />;
  }
  return (
    <TokenRevealModal
      {...defaultProps}
      token={token}
      onClose={() => {
        setToken('');
        props.onClosed?.();
      }}
    />
  );
}

describe('TokenRevealModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('masks the token by default and toggles visibility', async () => {
    render(<TokenRevealModal {...defaultProps} />);

    const input = screen.getByLabelText('Robot token') as HTMLInputElement;
    expect(input.value).toBe(TOKEN);
    expect(input.type).toBe('password');
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show token' }));
    expect((screen.getByLabelText('Robot token') as HTMLInputElement).type).toBe('text');

    await userEvent.click(screen.getByRole('button', { name: 'Hide token' }));
    expect((screen.getByLabelText('Robot token') as HTMLInputElement).type).toBe('password');
  });

  it('copies via the clipboard API and shows Copied feedback', async () => {
    render(<TokenRevealModal {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: 'Copy token to clipboard' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TOKEN);
    await screen.findByText('Copied');
  });

  it('reveals and selects the field with a manual-copy hint when the clipboard fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('not allowed'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<TokenRevealModal {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: 'Copy token to clipboard' }));

    expect(writeText).toHaveBeenCalledWith(TOKEN);
    expect(await screen.findByText(/Copy manually/i)).toBeInTheDocument();
    // On failure the field is revealed
    expect((screen.getByLabelText('Robot token') as HTMLInputElement).type).toBe('text');
  });

  it('keeps Done disabled until the acknowledgement checkbox is checked', async () => {
    render(<TokenRevealModal {...defaultProps} />);

    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();

    await userEvent.click(screen.getByLabelText('I have stored this token securely'));
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
  });

  it('asks for confirmation when closing before acknowledgement', async () => {
    render(<TokenRevealModal {...defaultProps} />);

    // Backdrop / X close before acknowledgement
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    // PatternFly stacks the exit-confirm modal in a hidden accessibility tree
    // while both modals are open, so query it with hidden: true.
    expect(
      await screen.findByRole('heading', {
        name: 'Close without storing the token?',
        hidden: true,
      })
    ).toBeInTheDocument();
    // Still open — the token is still displayed
    expect(screen.getByLabelText('Robot token')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Go back', hidden: true })
    );
    expect(
      screen.queryByRole('heading', {
        name: 'Close without storing the token?',
        hidden: true,
      })
    ).not.toBeInTheDocument();
  });

  it('removes the token from the document after closing', async () => {
    const onClosed = vi.fn();
    render(<Harness onClosed={onClosed} />);

    expect(screen.getByLabelText('Robot token')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('I have stored this token securely'));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onClosed).toHaveBeenCalled();
    expect(screen.queryByLabelText('Robot token')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(TOKEN)).not.toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain(TOKEN);
  });

  it('never writes the token to web storage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(<Harness />);

    await userEvent.click(screen.getByLabelText('I have stored this token securely'));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    for (const call of setItemSpy.mock.calls) {
      expect(call.join(' ')).not.toContain(TOKEN);
    }
    setItemSpy.mockRestore();
  });

  it('shows tokenId, expiry, endpoint, and a snippet that references KRKN_ROBOT_TOKEN without embedding the token', () => {
    render(<TokenRevealModal {...defaultProps} />);

    expect(screen.getByDisplayValue('tid-1')).toBeInTheDocument();
    expect(screen.getByText(/in 90 days/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(new RegExp(`${window.location.origin}/api/mcp`)).length
    ).toBeGreaterThan(0);

    const snippet = screen.getByText(/KRKN_ROBOT_TOKEN/);
    expect(snippet.textContent ?? '').not.toContain(TOKEN);
  });
});
