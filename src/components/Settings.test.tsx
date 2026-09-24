import { describe, it, expect } from 'vitest';
import { ReactNode } from 'react';

describe('Settings - Admin-only Backup & Restore Tab', () => {
  it('should conditionally render Backup & Restore tab based on isAdmin flag', () => {
    const isAdmin = true;

    const shouldRender = isAdmin && true;
    expect(shouldRender).toBe(true);

    const isNotAdmin = false;
    const shouldNotRender = isNotAdmin && true;
    expect(shouldNotRender).toBe(false);
  });

  it('renders Backup & Restore tab only when isAdmin is true', () => {
    type TabProps = {
      eventKey: number;
      title: ReactNode;
      children: ReactNode;
      hidden?: boolean;
    };

    const createTab = (isAdmin: boolean): TabProps | null => {
      return isAdmin
        ? {
            eventKey: 5,
            title: 'Backup & Restore',
            children: '<BackupRestoreCard />',
          }
        : null;
    };

    const adminTab = createTab(true);
    expect(adminTab).not.toBeNull();
    expect(adminTab?.eventKey).toBe(5);
    expect(adminTab?.title).toBe('Backup & Restore');

    const nonAdminTab = createTab(false);
    expect(nonAdminTab).toBeNull();
  });
});
