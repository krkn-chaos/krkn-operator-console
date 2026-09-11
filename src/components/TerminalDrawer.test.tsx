import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Drawer, DrawerContent } from '@patternfly/react-core';
import { TerminalDrawer } from './TerminalDrawer';

vi.mock('./TerminalContent', () => ({
  TerminalContent: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="terminal-content">
      {isOpen && <div>Terminal Open</div>}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

function renderDrawer(isOpen: boolean, onClose = vi.fn()) {
  return render(
    <Drawer isExpanded={isOpen}>
      <DrawerContent panelContent={<TerminalDrawer isOpen={isOpen} onClose={onClose} />}>
        <div>Page content</div>
      </DrawerContent>
    </Drawer>
  );
}

describe('TerminalDrawer', () => {
  it('should render the drawer panel with title', () => {
    renderDrawer(true);
    expect(screen.getByText('Cluster Terminal')).toBeInTheDocument();
  });

  it('should render TerminalContent when open', () => {
    renderDrawer(true);
    expect(screen.getByText('Terminal Open')).toBeInTheDocument();
  });

  it('should not show terminal content when closed', () => {
    renderDrawer(false);
    expect(screen.queryByText('Terminal Open')).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer(true, onClose);

    const closeButton = screen.getByLabelText('Close drawer panel');
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should pass onClose to TerminalContent', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer(true, onClose);

    const terminalCloseButton = screen.getByText('Close');
    await user.click(terminalCloseButton);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
