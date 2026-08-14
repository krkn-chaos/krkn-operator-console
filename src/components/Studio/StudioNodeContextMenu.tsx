/**
 * StudioNodeContextMenu - Context menu for node actions
 *
 * Provides Edit, Show Configuration, Delete, and Clone actions for scenario nodes.
 * Triggered by right-click on node.
 */

import { useEffect, useRef } from 'react';
import {
  Menu,
  MenuContent,
  MenuList,
  MenuItem,
  Divider,
} from '@patternfly/react-core';
import type { StudioNode } from '../../types/api';

interface StudioNodeContextMenuProps {
  node: StudioNode;
  onEdit: (node: StudioNode) => void;
  position: { x: number; y: number };
  onClose: () => void;
  onOpenClone: (nodeId: string) => void;
  onOpenDelete: (nodeId: string) => void;
  onShowConfig: (node: StudioNode) => void;
}

export function StudioNodeContextMenu({
  node,
  onEdit,
  position,
  onClose,
  onOpenClone,
  onOpenDelete,
  onShowConfig,
}: StudioNodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isConfigured = node.status === 'configured';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleEdit = () => {
    onClose();
    onEdit(node);
  };

  const handleDeleteClick = () => {
    onClose();
    onOpenDelete(node.nodeId);
  };

  const handleCloneClick = () => {
    onClose();
    onOpenClone(node.nodeId);
  };

  const handleShowConfig = () => {
    onClose();
    onShowConfig(node);
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        backgroundColor: 'var(--pf-v5-global--BackgroundColor--100)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
        borderRadius: '4px',
        border: '1px solid var(--pf-v5-global--BorderColor--100)',
      }}
    >
      <Menu>
        <MenuContent>
          <MenuList>
            <MenuItem onClick={handleEdit}>
              {isConfigured ? 'Edit Configuration' : 'Configure'}
            </MenuItem>
            {isConfigured && (
              <MenuItem onClick={handleShowConfig}>
                Show Configuration
              </MenuItem>
            )}
            <Divider component="li" />
            {isConfigured && (
              <MenuItem onClick={handleCloneClick}>
                Clone Node
              </MenuItem>
            )}
            <MenuItem onClick={handleDeleteClick}>
              Delete Node
            </MenuItem>
          </MenuList>
        </MenuContent>
      </Menu>
    </div>
  );
}
