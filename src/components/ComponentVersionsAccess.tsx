import { useState } from 'react';
import { Button } from '@patternfly/react-core';
import { QuestionCircleIcon } from '@patternfly/react-icons';
import { ComponentVersionsModal } from './ComponentVersionsModal';

/** Top bar shortcut to the component versions dialog for every signed-in user. */
export function ComponentVersionsAccess() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="plain"
        aria-label="Component Versions"
        title="Component Versions"
        onClick={() => setIsOpen(true)}
        style={{ color: 'var(--pf-v5-global--Color--light-100)' }}
      >
        <QuestionCircleIcon />
      </Button>
      <ComponentVersionsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
