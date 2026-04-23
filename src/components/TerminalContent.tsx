import { useState, useEffect, useRef } from 'react';
import { useClusterDiscovery } from '../hooks/useClusterDiscovery';
import { operatorApi } from '../services/operatorApi';
import type { TargetResponse } from '../types/api';
import './TerminalContent.css';

interface TerminalContentProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TerminalContent({ isOpen, onClose }: TerminalContentProps) {
  const { clusters, discoveryUuid, isLoading, error, startDiscovery, reset } = useClusterDiscovery();
  const [currentPage, setCurrentPage] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<TargetResponse | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentInput, setCurrentInput] = useState(''); // Store current input when navigating history
  const previousIsOpenRef = useRef(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const CLUSTERS_PER_PAGE = 50;
  const COLUMNS = 5;
  const ROWS_PER_COLUMN = 10;

  // Handle click anywhere in terminal to restore focus and scroll to bottom
  const handleTerminalClick = () => {
    // Focus input
    inputRef.current?.focus();
    // Scroll to bottom
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // Execute command on selected cluster
  const executeCommand = async (command: string) => {
    if (!selectedCluster || !discoveryUuid) return;

    setIsExecuting(true);

    // Add command to output immediately (with executing indicator)
    const newOutputLines = [
      ...outputLines,
      `☸ ${selectedCluster.clusterName} $ ${command}`,
      'Executing...',
    ];
    setOutputLines(newOutputLines);

    try {
      const result = await operatorApi.executeTerminalCommand({
        cluster_id: selectedCluster.clusterName,
        uuid: discoveryUuid,
        command,
      });

      // Add stdout and stderr to output
      const output: string[] = [];

      if (result.stdout) {
        // Split by newline to preserve multi-line output, filter trailing empty lines
        const stdoutLines = result.stdout.split('\n');
        // Remove empty string at the end if stdout ends with \n
        if (stdoutLines[stdoutLines.length - 1] === '') {
          stdoutLines.pop();
        }
        output.push(...stdoutLines);
      }

      if (result.stderr) {
        // Split by newline to preserve multi-line output, filter trailing empty lines
        const stderrLines = result.stderr.split('\n');
        // Remove empty string at the end if stderr ends with \n
        if (stderrLines[stderrLines.length - 1] === '') {
          stderrLines.pop();
        }
        output.push(...stderrLines);
      }

      // Add exit code if non-zero
      if (result.exitCode !== 0) {
        output.push(`[Exit code: ${result.exitCode}]`);
      }

      // Replace "Executing..." with actual output
      setOutputLines([
        ...outputLines,
        `☸ ${selectedCluster.clusterName} $ ${command}`,
        ...output,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
      // Replace "Executing..." with error
      setOutputLines([
        ...outputLines,
        `☸ ${selectedCluster.clusterName} $ ${command}`,
        `Error: ${errorMessage}`,
      ]);
    } finally {
      setIsExecuting(false);
      // Restore focus to input after command execution
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // Start discovery when terminal opens
  useEffect(() => {
    if (isOpen && !isInitialized && !clusters && !isLoading && !error) {
      startDiscovery();
      setIsInitialized(true);
    }
  }, [isOpen, isInitialized, clusters, isLoading, error, startDiscovery]);

  // Keep scroll at top during loading
  useEffect(() => {
    if (isLoading) {
      const terminalBody = document.getElementById('terminal-body');
      if (terminalBody) {
        terminalBody.scrollTop = 0;
      }
    }
  }, [isLoading]);

  // Auto-focus input when terminal opens and clusters are loaded
  useEffect(() => {
    if (isOpen && clusters && clusters.length > 0 && inputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, clusters]);

  // Auto-scroll to bottom when output changes (only when clusters are loaded)
  useEffect(() => {
    if (bottomRef.current && clusters && clusters.length > 0) {
      // Use setTimeout to ensure DOM is updated before scrolling
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    }
  }, [outputLines, clusters]);

  // Cleanup when terminal closes
  useEffect(() => {
    const wasOpen = previousIsOpenRef.current;
    previousIsOpenRef.current = isOpen;

    // Detect close event
    if (wasOpen && !isOpen) {
      // Delete the target request if exists
      if (discoveryUuid) {
        operatorApi.deleteTargetRequest(discoveryUuid).catch((error) => {
          console.error('Failed to delete target request:', error);
        });
      }

      // Reset terminal state
      reset();
      setCurrentPage(0);
      setInputValue('');
      setOutputLines([]);
      setSelectedCluster(null);
      setIsInitialized(false);
      setCommandHistory([]);
      setHistoryIndex(-1);
      setCurrentInput('');
    }
  }, [isOpen, discoveryUuid, reset]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Ctrl+D to close terminal
    if (e.key === 'd' && e.ctrlKey) {
      e.preventDefault();
      onClose();
      return;
    }

    // Handle Arrow Up - navigate to previous command
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      // Save current input if we're starting to navigate history
      if (historyIndex === -1) {
        setCurrentInput(inputValue);
      }

      const newIndex = historyIndex === -1
        ? commandHistory.length - 1
        : Math.max(0, historyIndex - 1);

      setHistoryIndex(newIndex);
      setInputValue(commandHistory[newIndex]);
      return;
    }

    // Handle Arrow Down - navigate to next command (or back to current input)
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return; // Already at current input

      const newIndex = historyIndex + 1;

      if (newIndex >= commandHistory.length) {
        // Back to current input
        setHistoryIndex(-1);
        setInputValue(currentInput);
      } else {
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
      return;
    }

    if (e.key === 'Enter') {
      if (!inputValue.trim()) {
        // Empty input
        const totalPages = clusters ? Math.ceil(clusters.length / CLUSTERS_PER_PAGE) : 0;
        const hasNextPage = currentPage < totalPages - 1;

        if (hasNextPage) {
          // Go to next page if available
          setCurrentPage(currentPage + 1);
        } else {
          // No next page - add empty line to output (like real terminal)
          const promptSymbol = selectedCluster ? `☸ ${selectedCluster.clusterName} $` : '$';
          setOutputLines([...outputLines, `${promptSymbol} `]);
        }
      } else if (!selectedCluster) {
        // Cluster selection mode
        const command = inputValue.trim();

        // Handle 'exit' command to close terminal
        if (command === 'exit') {
          onClose();
          return;
        }

        // Parse cluster number
        const clusterNumber = parseInt(command, 10);
        if (clusters && clusterNumber >= 1 && clusterNumber <= clusters.length) {
          const cluster = clusters[clusterNumber - 1];
          setSelectedCluster(cluster);
          setOutputLines([
            ...outputLines,
            `$ ${command}`,
            `Connected to cluster: ${cluster.clusterName}`,
            '',
          ]);
        } else {
          setOutputLines([
            ...outputLines,
            `$ ${command}`,
            `Error: Invalid cluster number. Please select 1-${clusters?.length || 0}`,
          ]);
        }
      } else {
        // Command execution mode
        const command = inputValue.trim();

        // Handle 'exit' command to close terminal
        if (command === 'exit') {
          onClose();
          return;
        }

        // Add command to history (avoid duplicates of last command)
        if (command && (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== command)) {
          setCommandHistory([...commandHistory, command]);
        }

        // Execute command on selected cluster
        console.log('Executing command:', command, 'cluster:', selectedCluster?.clusterName, 'uuid:', discoveryUuid);
        executeCommand(command);
      }
      setInputValue('');
      setHistoryIndex(-1); // Reset history navigation
      setCurrentInput(''); // Clear stored input
    }
  };

  // Format clusters into columns
  const formatClustersGrid = (clustersList: TargetResponse[]) => {
    const start = currentPage * CLUSTERS_PER_PAGE;
    const end = start + CLUSTERS_PER_PAGE;
    const pageCluster = clustersList.slice(start, end);

    // Create 5 columns, each with up to 10 items
    const columns: TargetResponse[][] = Array.from({ length: COLUMNS }, () => []);

    pageCluster.forEach((cluster, index) => {
      const columnIndex = Math.floor(index / ROWS_PER_COLUMN);
      if (columnIndex < COLUMNS) {
        columns[columnIndex].push(cluster);
      }
    });

    return columns;
  };

  // Loading state - static (no animation to prevent layout shift)
  if (isLoading) {
    return (
      <div className="terminal-content" style={{ minHeight: '100px' }}>
        <div className="terminal-line" style={{ padding: '1rem 0' }}>
          Loading clusters...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="terminal-content">
        <div className="terminal-line terminal-error">Error: {error}</div>
        <div className="terminal-line">
          Press <span className="terminal-key">r</span> to retry
        </div>
      </div>
    );
  }

  // No clusters found
  if (clusters && clusters.length === 0) {
    return (
      <div className="terminal-content">
        <div className="terminal-line">No clusters found.</div>
      </div>
    );
  }

  // Initial state (should not happen due to useEffect)
  if (!clusters) {
    return (
      <div className="terminal-content">
        <div className="terminal-line">Ready...</div>
      </div>
    );
  }

  // Clusters loaded - render interactive terminal
  const columns = formatClustersGrid(clusters);
  const totalPages = Math.ceil(clusters.length / CLUSTERS_PER_PAGE);
  const hasNextPage = currentPage < totalPages - 1;

  return (
    <div className="terminal-content" onClick={handleTerminalClick}>
      {/* Show cluster selection header and grid only if no cluster is selected */}
      {!selectedCluster && (
        <>
          <div className="terminal-line">
            Select a cluster (showing {currentPage * CLUSTERS_PER_PAGE + 1}-
            {Math.min((currentPage + 1) * CLUSTERS_PER_PAGE, clusters.length)} of {clusters.length}):
          </div>

          <div className="clusters-grid">
            {columns.map((column, colIndex) => (
              <div key={colIndex} className="cluster-column">
                {column.map((cluster, rowIndex) => {
                  const globalIndex = currentPage * CLUSTERS_PER_PAGE + colIndex * ROWS_PER_COLUMN + rowIndex;
                  return (
                    <div key={cluster.uuid} className="cluster-item">
                      <span className="cluster-number">{globalIndex + 1}.</span>{' '}
                      <span className="cluster-name">{cluster.clusterName}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Output history */}
      {outputLines.map((line, index) => (
        <div key={index} className="terminal-line terminal-output">
          {line}
        </div>
      ))}

      <div className="terminal-line terminal-hint">
        {hasNextPage && !selectedCluster && (
          <>Press <span className="terminal-key">Enter</span> for next page &middot; </>
        )}
        Press <span className="terminal-key">Ctrl+D</span> or type <span className="terminal-key">exit</span> to close
      </div>

      <div className="terminal-prompt">
        {selectedCluster ? (
          <span className="prompt-symbol">
            <span className="k8s-wheel">☸</span> {selectedCluster.clusterName} $
          </span>
        ) : (
          <span className="prompt-symbol">$</span>
        )}{' '}
        <div className="terminal-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="terminal-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder=""
            disabled={isExecuting}
          />
          <div className="terminal-display">
            <span className="terminal-display-text">{inputValue}</span>
            {!isExecuting && <span className="terminal-cursor-block">_</span>}
          </div>
        </div>
      </div>

      {/* Invisible element at the bottom for auto-scroll */}
      <div ref={bottomRef} style={{ height: '1px' }} />
    </div>
  );
}

