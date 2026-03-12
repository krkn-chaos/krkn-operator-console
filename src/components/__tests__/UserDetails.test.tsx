import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserDetails } from '../UserDetails';
import type { UserDetails as UserDetailsType } from '../../types/api';

describe('UserDetails', () => {
  const mockUser: UserDetailsType = {
    userId: 'test@example.com',
    name: 'John',
    surname: 'Doe',
    role: 'admin',
    organization: 'Test Organization',
    active: true,
    created: '2023-01-01T12:00:00Z',
    lastLogin: '2023-01-15T14:30:00Z',
  };

  it('should render all user fields correctly', () => {
    render(<UserDetails user={mockUser} />);

    // Check basic fields
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Test Organization')).toBeInTheDocument();
  });

  it('should format dates properly using toLocaleString', () => {
    const userWithDates: UserDetailsType = {
      ...mockUser,
      created: '2023-01-01T12:00:00Z',
      lastLogin: '2023-01-15T14:30:00Z',
    };

    render(<UserDetails user={userWithDates} />);

    const createdDate = new Date('2023-01-01T12:00:00Z').toLocaleString();
    const loginDate = new Date('2023-01-15T14:30:00Z').toLocaleString();

    expect(screen.getByText(createdDate)).toBeInTheDocument();
    expect(screen.getByText(loginDate)).toBeInTheDocument();
  });

  it('should show correct label color for admin role', () => {
    render(<UserDetails user={mockUser} />);

    const roleLabel = screen.getByText('ADMIN');
    expect(roleLabel).toBeInTheDocument();
    // PatternFly Label with color prop renders the text
    expect(roleLabel.textContent).toBe('ADMIN');
  });

  it('should show correct label color for user role', () => {
    const regularUser: UserDetailsType = {
      ...mockUser,
      role: 'user',
    };

    render(<UserDetails user={regularUser} />);

    const roleLabel = screen.getByText('USER');
    expect(roleLabel).toBeInTheDocument();
  });

  it('should show correct status label for enabled user', () => {
    render(<UserDetails user={mockUser} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should show correct status label for disabled user', () => {
    const disabledUser: UserDetailsType = {
      ...mockUser,
      active: false,
    };

    render(<UserDetails user={disabledUser} />);

    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('should show "N/A" for missing optional organization field', () => {
    const userWithoutOrg: UserDetailsType = {
      ...mockUser,
      organization: undefined,
    };

    render(<UserDetails user={userWithoutOrg} />);

    // Find all "N/A" texts and verify at least one exists for organization
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should show "N/A" for missing createdAt field', () => {
    const userWithoutCreatedAt: UserDetailsType = {
      ...mockUser,
      created: undefined,
    };

    render(<UserDetails user={userWithoutCreatedAt} />);

    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThan(0);
  });

  it('should show "Never" for missing lastLogin field', () => {
    const userWithoutLogin: UserDetailsType = {
      ...mockUser,
      lastLogin: undefined,
    };

    render(<UserDetails user={userWithoutLogin} />);

    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('should return null when user is null', () => {
    const { container } = render(<UserDetails user={null} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render complete user with all fields', () => {
    render(<UserDetails user={mockUser} />);

    // Verify all labels are present
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created At')).toBeInTheDocument();
    expect(screen.getByText('Last Login')).toBeInTheDocument();
  });
});
