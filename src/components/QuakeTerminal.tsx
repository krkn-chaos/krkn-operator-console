import { useState } from 'react';
import './QuakeTerminal.css';

interface QuakeTerminalProps {
  /** Height of terminal as percentage of viewport (default: 25) */
  heightPercent?: number;
}

export function QuakeTerminal({ heightPercent = 25 }: QuakeTerminalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Trigger Strip - positioned below masthead */}
      <div
        className="quake-terminal-trigger"
        onClick={handleToggle}
        title={isOpen ? 'Close terminal' : 'Open terminal'}
      >
        <div className="quake-terminal-trigger-icon">
          {isOpen ? '▲' : '▼'}
        </div>
      </div>

      {/* Backdrop - dark overlay when terminal is open */}
      {isOpen && (
        <div
          className="quake-terminal-backdrop"
          onClick={handleToggle}
        />
      )}

      {/* Terminal Panel - slides down from top */}
      <div
        className={`quake-terminal-panel ${isOpen ? 'is-open' : ''}`}
        style={{ height: `${heightPercent}vh` }}
      >
        <div className="quake-terminal-content">
          {/* Terminal content will go here */}
          <div className="quake-terminal-header">
            <span>Terminal</span>
            <button
              className="quake-terminal-close"
              onClick={handleToggle}
            >
              ✕
            </button>
          </div>
          <div className="quake-terminal-body">
            {/* Placeholder for terminal UI */}
            <pre style={{ color: '#00ff00', fontFamily: 'monospace' }}>
              $ Welcome to Krkn Terminal{'\n'}
              $ Ready...
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}
