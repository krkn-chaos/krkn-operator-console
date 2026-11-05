import { forwardRef, useMemo } from 'react';
import Anser from 'anser';
import './LogTerminal.css';

interface LogTerminalProps {
  logs: readonly string[];
  compact?: boolean;
  ariaLabel?: string;
}

export const LogTerminal = forwardRef<HTMLDivElement, LogTerminalProps>(function LogTerminal(
  { logs, compact = false, ariaLabel },
  ref,
) {
  const parsedLogs = useMemo(
    () => logs.map((log) => Anser.ansiToJson(log, { use_classes: false })),
    [logs],
  );

  return (
    <div
      ref={ref}
      className={`log-terminal${compact ? ' log-terminal--compact' : ''}`}
      aria-label={ariaLabel}
    >
      {parsedLogs.map((chunks, logIndex) => (
        <div key={logIndex}>
          {chunks.map((chunk, chunkIndex) => (
            <span
              key={chunkIndex}
              style={{
                color: chunk.fg ? `rgb(${chunk.fg})` : undefined,
                backgroundColor: chunk.bg ? `rgb(${chunk.bg})` : undefined,
                fontWeight: chunk.decoration?.includes('bold') ? 'bold' : undefined,
                textDecoration: chunk.decoration?.includes('underline') ? 'underline' : undefined,
              }}
            >
              {chunk.content}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
});
