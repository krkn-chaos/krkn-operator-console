import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignatureStatusIcon } from './SignatureStatusIcon';

describe('SignatureStatusIcon', () => {
  it.each([
    ['signed', 'Signed image'],
    ['unsigned', 'Unsigned image'],
    ['untrusted', 'Untrusted image'],
    ['unknown', 'Unknown image signature status'],
  ] as const)('renders the %s status with an accessible label', (status, label) => {
    render(<SignatureStatusIcon status={status} />);

    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
  });

  it('treats a missing status as unknown', () => {
    render(<SignatureStatusIcon />);

    expect(screen.getByRole('img', { name: 'Unknown image signature status' })).toBeInTheDocument();
  });
});
