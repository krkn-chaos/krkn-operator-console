/**
 * TokenRevealModal component
 *
 * Security-critical one-time display of a robot's MCP token.
 *
 * **Security rules (binding):**
 * - The token value arrives only via props and is held ONLY in the parent
 *   component's useState. This component never copies it into local state,
 *   reducer/context, URL, logs, or toasts.
 * - The token is rendered in a masked password field with an explicit
 *   show/hide toggle, never as plain text by default.
 * - The client snippet references the `KRKN_ROBOT_TOKEN` environment
 *   variable; the token itself is NEVER embedded in the snippet.
 * - "Done" stays disabled until the admin acknowledges storing the token.
 * - Closing via Escape/backdrop/X before acknowledgement asks for
 *   confirmation ("The token will not be shown again").
 *
 * @component
 */

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  CodeBlock,
  CodeBlockCode,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  Modal,
  ModalVariant,
  TextInput,
} from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon } from '@patternfly/react-icons';

interface TokenRevealModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /**
   * Called when the modal should fully close (after acknowledgement or exit
   * confirmation). The parent MUST clear the token from its state here.
   */
  onClose: () => void;
  /** Name of the robot the token belongs to */
  robotName: string;
  /** The one-time token value — held only in the parent's useState */
  token: string;
  /** Server-side identifier of the issued token */
  tokenId: string;
  /** ISO timestamp of token expiry */
  expiresAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDaysUntil(expiresAt: string, now: Date): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (Number.isNaN(ms)) {
    return '';
  }
  const days = Math.round(ms / DAY_MS);
  if (days < 1) {
    return 'in less than a day';
  }
  return days === 1 ? 'in 1 day' : `in ${days} days`;
}

export function TokenRevealModal({
  isOpen,
  onClose,
  robotName,
  token,
  tokenId,
  expiresAt,
}: TokenRevealModalProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clipboardFailed, setClipboardFailed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset transient UI state (never the token, which lives in the parent)
  // each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setRevealed(false);
      setCopied(false);
      setClipboardFailed(false);
      setAcknowledged(false);
      setShowExitConfirm(false);
    }
  }, [isOpen]);

  // Clear confirmation flag when the exit confirmation modal closes.
  useEffect(() => {
    if (!isOpen) {
      setShowExitConfirm(false);
    }
  }, [isOpen]);

  const requestClose = () => {
    if (acknowledged) {
      onClose();
    } else {
      setShowExitConfirm(true);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setClipboardFailed(false);
    } catch {
      // Clipboard unavailable (e.g. insecure context): reveal and select the
      // field so the admin can copy manually.
      setClipboardFailed(true);
      setRevealed(true);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  };

  const endpoint = `${window.location.origin}/api/mcp`;
  const now = new Date();
  const absoluteExpiry = new Date(expiresAt).toLocaleString();
  const relativeExpiry = formatDaysUntil(expiresAt, now);

  const snippet = [
    '# Store the token in your secret manager, then reference it via:',
    'export KRKN_ROBOT_TOKEN="$(<read from your secret manager>)"',
    '',
    `curl -X POST ${endpoint} \\`,
    '  -H "Authorization: Bearer $KRKN_ROBOT_TOKEN" \\',
    '  -H "Content-Type: application/json"',
  ].join('\n');

  return (
    <>
      <Modal
        variant={ModalVariant.medium}
        title={`Robot token for "${robotName}"`}
        isOpen={isOpen}
        onClose={requestClose}
        onEscapePress={requestClose}
        actions={[
          <Button
            key="done"
            variant="primary"
            isDisabled={!acknowledged}
            onClick={onClose}
          >
            Done
          </Button>,
        ]}
      >
        <Form>
          <Alert
            variant="warning"
            title="This token is shown only once"
            isInline
            style={{ marginBottom: '1rem' }}
          >
            <p>Copy it now and store it in a secret manager — it cannot be retrieved again.</p>
            <p>
              The token grants MCP access with the permissions of this robot&apos;s groups, but it
              cannot be used to sign in to this console.
            </p>
          </Alert>

          <FormGroup label="Token" fieldId="robot-token">
            <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem grow={{ default: 'grow' }}>
                <TextInput
                  id="robot-token"
                  ref={inputRef}
                  value={token}
                  type={revealed ? 'text' : 'password'}
                  readOnly
                  aria-label="Robot token"
                  autoComplete="off"
                  spellCheck={false}
                />
              </FlexItem>
              <FlexItem>
                <Button
                  variant="control"
                  aria-label={revealed ? 'Hide token' : 'Show token'}
                  onClick={() => setRevealed(!revealed)}
                >
                  {revealed ? <EyeSlashIcon /> : <EyeIcon />}
                </Button>
              </FlexItem>
              <FlexItem>
                <Button
                  variant="control"
                  onClick={handleCopy}
                  aria-label="Copy token to clipboard"
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </FlexItem>
            </Flex>
            {clipboardFailed && (
              <p style={{ marginTop: '0.5rem' }}>
                Clipboard access failed — the token is revealed and selected above. Copy manually.
              </p>
            )}
          </FormGroup>

          <FormGroup label="Token ID" fieldId="robot-token-id">
            <TextInput
              id="robot-token-id"
              value={tokenId}
              readOnly
              aria-label="Token ID"
            />
          </FormGroup>

          <FormGroup label="Expires" fieldId="robot-token-expiry">
            <div id="robot-token-expiry">
              {absoluteExpiry}
              {relativeExpiry ? ` (${relativeExpiry})` : ''}
            </div>
          </FormGroup>

          <FormGroup label="MCP endpoint" fieldId="robot-token-endpoint">
            <div id="robot-token-endpoint">
              <code>{endpoint}</code>
            </div>
          </FormGroup>

          <FormGroup label="Client usage" fieldId="robot-token-snippet">
            <CodeBlock>
              <CodeBlockCode>{snippet}</CodeBlockCode>
            </CodeBlock>
          </FormGroup>

          <Checkbox
            id="robot-token-acknowledged"
            name="robot-token-acknowledged"
            label="I have stored this token securely"
            isChecked={acknowledged}
            onChange={(_event, checked) => setAcknowledged(checked)}
          />
        </Form>
      </Modal>

      {/* Exit confirmation before acknowledgement */}
      <Modal
        variant={ModalVariant.small}
        title="Close without storing the token?"
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        actions={[
          <Button
            key="close"
            variant="danger"
            onClick={() => {
              setShowExitConfirm(false);
              onClose();
            }}
          >
            Close anyway
          </Button>,
          <Button key="back" variant="link" onClick={() => setShowExitConfirm(false)}>
            Go back
          </Button>,
        ]}
      >
        The token will not be shown again. Make sure you have copied and stored it securely before
        closing.
      </Modal>
    </>
  );
}
