import { useState } from 'react';
import { TerminalIcon } from '@patternfly/react-icons';
import { TerminalContent } from './TerminalContent';
import './QuakeTerminal.css';

interface QuakeTerminalProps {
  /** Height of terminal as percentage of viewport (default: 40) */
  heightPercent?: number;
}

export function QuakeTerminal({ heightPercent = 40 }: QuakeTerminalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Trigger Strip - positioned below masthead */}
      <button
        type="button"
        className={`quake-terminal-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={handleToggle}
        aria-label={isOpen ? 'Close terminal' : 'Open terminal'}
        aria-expanded={isOpen}
      >
        <div className="quake-terminal-trigger-content">
          <TerminalIcon className="quake-terminal-trigger-icon" />
          <span className="quake-terminal-trigger-label">
            cluster terminal<span className="quake-terminal-cursor">_</span>
          </span>
        </div>
        <div className="quake-terminal-trigger-arrow">
          {isOpen ? '▲' : '▼'}
        </div>
      </button>

      {/* Backdrop - dark overlay when terminal is open */}
      {isOpen && (
        <button
          type="button"
          className="quake-terminal-backdrop"
          onClick={handleToggle}
          aria-label="Close terminal"
          tabIndex={-1}
        />
      )}

      {/* Terminal Panel - slides down from top */}
      <div
        className={`quake-terminal-panel ${isOpen ? 'is-open' : ''}`}
        style={{ height: `${heightPercent}vh` }}
      >
        <div className="quake-terminal-content">
          <div className="quake-terminal-body" id="terminal-body">
            <TerminalContent isOpen={isOpen} onClose={handleToggle} />
          </div>
        </div>
      </div>
    </>
  );
}
