import { forwardRef, memo } from 'react';
import Anser from 'anser';
import './LogTerminal.css';

interface LogTerminalProps {
  logs: readonly string[];
  compact?: boolean;
  ariaLabel?: string;
  firstLine?: number;
}

const LogLine = memo(function LogLine({ text }: { text: string }) {
  const chunks = Anser.ansiToJson(text, { use_classes: false });
  return (
    <div>
      {chunks.map((chunk, index) => (
        <span
          key={index}
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
  );
});

export const LogTerminal = forwardRef<HTMLDivElement, LogTerminalProps>(function LogTerminal(
  { logs, compact = false, ariaLabel, firstLine = 0 },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`log-terminal${compact ? ' log-terminal--compact' : ''}`}
      aria-label={ariaLabel}
    >
      {logs.map((text, index) => <LogLine key={firstLine + index} text={text} />)}
    </div>
  );
});
