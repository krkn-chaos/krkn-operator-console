import { describe, it, expect } from 'vitest';
import { deriveRobotTokenState, formatExpiry } from '../robotTokenStatus';
import type { RobotDetails } from '../../types/api';

function makeRobot(overrides: Partial<RobotDetails> = {}): RobotDetails {
  return {
    name: 'ci-runner',
    description: 'CI robot',
    disabled: false,
    groups: [],
    tokenId: 'tok-123',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('deriveRobotTokenState', () => {
  const now = new Date('2026-11-11T00:00:00Z');

  it.each([
    {
      name: 'disabled robot with token (disabled wins)',
      robot: makeRobot({ disabled: true, tokenId: 'tok-1', tokenExpiresAt: '2027-01-01T00:00:00Z' }),
      expected: 'disabled',
    },
    {
      name: 'disabled robot without token',
      robot: makeRobot({ disabled: true, tokenId: '' }),
      expected: 'disabled',
    },
    {
      name: 'no token (tokenId empty)',
      robot: makeRobot({ tokenId: '' }),
      expected: 'none',
    },
    {
      name: 'expired at exactly tokenExpiresAt (now >= expiry)',
      robot: makeRobot({ tokenExpiresAt: '2026-11-11T00:00:00Z' }),
      expected: 'expired',
    },
    {
      name: 'expired well before now',
      robot: makeRobot({ tokenExpiresAt: '2026-11-01T00:00:00Z' }),
      expected: 'expired',
    },
    {
      name: 'expiring at 13 days remaining (inside window)',
      robot: makeRobot({ tokenExpiresAt: '2026-11-24T00:00:00Z' }),
      expected: 'expiring',
    },
    {
      name: 'active at exactly 14 days remaining (boundary, outside window)',
      robot: makeRobot({ tokenExpiresAt: '2026-11-25T00:00:00Z' }),
      expected: 'active',
    },
    {
      name: 'active with far-future expiry',
      robot: makeRobot({ tokenExpiresAt: '2027-06-01T00:00:00Z' }),
      expected: 'active',
    },
    {
      name: 'active when token has no expiry timestamp',
      robot: makeRobot({ tokenExpiresAt: undefined }),
      expected: 'active',
    },
  ])('should return $expected when $name', ({ robot, expected }) => {
    expect(deriveRobotTokenState(robot, now)).toBe(expected);
  });
});

describe('formatExpiry', () => {
  const now = new Date('2026-11-11T00:00:00Z');

  it.each([
    {
      name: '5 days in the future',
      expiresAt: '2026-11-16T00:00:00Z',
      expected: 'in 5 days',
    },
    {
      name: '13 days (warning window)',
      expiresAt: '2026-11-24T00:00:00Z',
      expected: 'in 13 days',
    },
    {
      name: 'exactly 1 day',
      expiresAt: '2026-11-12T00:00:00Z',
      expected: 'in 1 day',
    },
    {
      name: 'a few hours',
      expiresAt: '2026-11-11T03:00:00Z',
      expected: 'in 3 hours',
    },
    {
      name: 'already expired 2 days ago',
      expiresAt: '2026-11-09T00:00:00Z',
      expected: 'expired 2 days ago',
    },
  ])('should format $name as "$expected"', ({ expiresAt, expected }) => {
    expect(formatExpiry(expiresAt, now)).toBe(expected);
  });

  it('should return minutes for sub-hour differences', () => {
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    expect(formatExpiry(expiresAt, now)).toBe('in 30 minutes');
  });
});
