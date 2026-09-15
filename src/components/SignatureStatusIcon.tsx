import { Tooltip } from '@patternfly/react-core';
import {
  BanIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  QuestionIcon,
} from '@patternfly/react-icons';
import type { SignatureStatus } from '../types/api';

const statusDetails: Record<SignatureStatus, {
  label: string;
  description: string;
  color: string;
  icon: typeof CheckCircleIcon;
}> = {
  signed: {
    label: 'Signed image',
    description: 'The image signature was verified successfully.',
    color: 'var(--pf-v5-global--success-color--100)',
    icon: CheckCircleIcon,
  },
  unsigned: {
    label: 'Unsigned image',
    description: 'The image does not have a signature.',
    color: 'var(--pf-v5-global--warning-color--100)',
    icon: ExclamationTriangleIcon,
  },
  untrusted: {
    label: 'Untrusted image',
    description: 'The image signature could not be trusted.',
    color: 'var(--pf-v5-global--danger-color--100)',
    icon: BanIcon,
  },
  unknown: {
    label: 'Unknown image signature status',
    description: 'The image signature status could not be determined.',
    color: 'var(--pf-v5-global--Color--200)',
    icon: QuestionIcon,
  },
};

interface SignatureStatusIconProps {
  status?: SignatureStatus;
}

export function SignatureStatusIcon({ status = 'unknown' }: SignatureStatusIconProps) {
  const details = statusDetails[status] || statusDetails.unknown;
  const Icon = details.icon;

  return (
    <Tooltip content={`${details.label}: ${details.description}`}>
      <span
        role="img"
        aria-label={details.label}
        style={{ color: details.color, display: 'inline-flex', alignItems: 'center' }}
      >
        <Icon aria-hidden="true" />
      </span>
    </Tooltip>
  );
}
