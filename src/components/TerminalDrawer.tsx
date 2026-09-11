import { DrawerPanelContent, DrawerHead, DrawerActions, DrawerCloseButton, DrawerPanelBody } from '@patternfly/react-core';
import { TerminalContent } from './TerminalContent';
import './TerminalDrawer.css';

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TerminalDrawer({ isOpen, onClose }: TerminalDrawerProps) {
  return (
    <DrawerPanelContent
      isResizable
      defaultSize="500px"
      minSize="400px"
    >
      <DrawerHead>
        <span className="terminal-drawer-title">Cluster Terminal</span>
        <DrawerActions>
          <DrawerCloseButton onClick={onClose} />
        </DrawerActions>
      </DrawerHead>
      <DrawerPanelBody className="terminal-drawer-body">
        <TerminalContent isOpen={isOpen} onClose={onClose} />
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
}
