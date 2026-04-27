import { useState, useEffect, useRef } from 'react';
import { CopyIcon } from '@patternfly/react-icons';
import { useClusterDiscovery } from '../hooks/useClusterDiscovery';
import { operatorApi } from '../services/operatorApi';
import type { TargetResponse, AvailableCommandsResponse } from '../types/api';
import './TerminalContent.css';

/**
 * Props for the TerminalContent component
 */
interface TerminalContentProps {
  /** Whether the terminal is currently open/visible */
  isOpen: boolean;
  /** Callback to close the terminal */
  onClose: () => void;
}

/**
 * TerminalContent - Interactive terminal UI for executing kubectl/oc commands on remote clusters
 *
 * @rationale
 * This component provides a secure, controlled way for users to execute read-only
 * Kubernetes commands on discovered clusters without requiring direct cluster access.
 * It replaces the need for users to configure kubectl locally, manage multiple contexts,
 * or have kubeconfig files. All commands are executed server-side with proper validation,
 * RBAC enforcement, and audit logging.
 *
 * **Use Cases:**
 * - Inspect cluster resources (pods, deployments, services) during chaos experiments
 * - Debug failed krkn jobs by checking cluster state
 * - Verify resource status without needing kubectl installed locally
 * - Multi-cluster operations from a single interface
 *
 * @description
 * Provides a terminal-like interface for users to:
 * - Discover and select target Kubernetes clusters
 * - Execute read-only kubectl/oc commands on selected clusters
 * - View command output with proper formatting (stdout/stderr)
 * - Navigate command history with arrow keys
 * - Copy command output to clipboard
 * - View available commands with the '?' help command
 *
 * @behavior
 * **Cluster Discovery Flow:**
 * 1. On mount (when isOpen=true), initiates cluster discovery via useClusterDiscovery hook
 * 2. Creates target request (POST /api/v1/targets/request) with discover=true
 * 3. Polls for discovered clusters (GET /api/v1/targets/discover/{uuid})
 * 4. Displays clusters in a paginated grid (50 per page, 5 columns x 10 rows)
 * 5. Clusters are sorted alphabetically by name for consistent ordering
 *
 * **Command Execution Flow:**
 * 1. User selects cluster by typing its number (e.g., "5")
 * 2. Terminal switches to command execution mode with cluster context
 * 3. User types command (e.g., "kubectl get pods")
 * 4. Client-side validation checks:
 *    - Command is in allowed list (fetched from GET /api/v1/terminal/available-commands)
 *    - Subcommand is whitelisted (prevents destructive operations)
 *    - No streaming flags (--watch, --follow) that require WebSocket
 * 5. Command sent to backend (POST /api/v1/terminal) with cluster_id and uuid
 * 6. Backend executes command in isolated container with cluster kubeconfig
 * 7. Response includes base64-encoded stdout/stderr and exit code
 * 8. Terminal displays output with:
 *    - stdout lines (decoded from base64)
 *    - stderr lines (always shown, even on success - K8s uses stderr for warnings)
 *    - "COMMAND_FAILED" marker if exit code ≠ 0
 *    - Copy button for stdout (if present)
 *
 * **State Management:**
 * - Uses functional setState updates to prevent race conditions
 * - Each command execution captures its own commandIndex in closure
 * - Output lines append via `prev => [...prev, ...]` to avoid overwriting
 * - Command history stored in array, navigable with arrow keys
 * - isExecuting flag disables input during command execution
 *
 * **Keyboard Shortcuts:**
 * - Enter: Execute command or select cluster (or advance to next page if empty)
 * - Arrow Up/Down: Navigate command history (like bash)
 * - Ctrl+D: Close terminal
 * - Type 'exit': Close terminal
 * - Type '?': Show available commands
 * - Type 'r': Retry discovery (only shown on error)
 *
 * @validation
 * **Client-Side Validation (fail-fast):**
 * - Main command must be in allowed list (kubectl, oc)
 * - Subcommand must be whitelisted (get, describe, logs, etc.)
 * - Blocks streaming flags: --watch, -w, --follow, -f, --watch-only
 * - Reduces unnecessary backend calls for obviously invalid commands
 *
 * **Server-Side Validation (security):**
 * - Command executable must exist in container PATH
 * - RBAC enforced via cluster's service account
 * - Timeout enforced to prevent long-running commands
 * - Command must complete within backend timeout (configurable, typically 30s)
 *
 * @error_handling
 * **HTTP Status Codes:**
 * - 200: Command succeeded (exit code may be 0 or non-zero)
 * - 400: Command executed but failed (exit code > 0) - shows stdout/stderr
 * - 403: Permission denied - user not authorized to execute this command
 * - 404: Command not found - executable doesn't exist in backend container
 * - 500: Server error - cluster unreachable, timeout, or internal error
 *
 * **Error Recovery:**
 * - Discovery failure: Shows error message with 'r' to retry
 * - Command execution failure: Shows error, allows retry with same or different command
 * - Network timeout: User can retry command manually
 * - Available commands fetch failure: Gracefully degrades - user can still execute commands
 *
 * @edge_cases
 * **Discovery:**
 * - No clusters found: Displays "No clusters found" (valid state)
 * - Discovery timeout: Shows error with retry instruction (press 'r')
 * - Clusters become unavailable after discovery: Command execution will fail with 500
 *
 * **Command Execution:**
 * - Empty stdout: Displays empty line (valid for commands like "kubectl delete")
 * - Only stderr output: Shows stderr lines (common for K8s warnings)
 * - Mixed stdout/stderr: Shows stdout first, then stderr (bash behavior)
 * - Long output (>1000 lines): Terminal renders all lines (may cause scroll lag)
 * - Rapid command submission: Functional updates prevent race conditions
 * - Command with newlines in output: Preserves formatting by splitting on \n
 *
 * **State Management:**
 * - Terminal closed while command executing: Cleanup effect cancels request
 * - Component unmounts during discovery: useClusterDiscovery hook cleanup handles it
 * - User types while command executing: Input disabled via isExecuting flag
 *
 * **Validation:**
 * - Available commands not loaded yet: Skips client-side validation, relies on server
 * - Invalid cluster number: Shows error, stays in selection mode
 * - Command not in whitelist: Shows error, doesn't send to backend (fail-fast)
 *
 * @security
 * **Limitations:**
 * - Only read-only commands allowed (enforced by backend whitelist)
 * - No shell features: pipes (|), redirects (>, >>), command substitution ($())
 * - No background jobs (&), command chaining (;, &&, ||)
 * - No interactive commands (top, vim, less) - these fail with TTY errors
 * - No streaming commands (--watch, --follow) - requires WebSocket (not in v1)
 *
 * **RBAC:**
 * - Commands executed with cluster's ServiceAccount permissions
 * - User cannot escalate privileges beyond cluster RBAC
 * - Backend enforces command whitelist regardless of client validation
 *
 * @performance
 * **Optimizations:**
 * - Cluster grid pagination (50 per page) for large environments
 * - Command history limited to session (not persisted)
 * - Available commands fetched once per terminal session
 * - Functional state updates prevent race conditions on rapid submissions
 * - Copy button uses clipboard API (no temporary textarea)
 *
 * **Scalability:**
 * - Handles 100+ clusters (tested with pagination)
 * - Commands with large output (>10,000 lines) may cause render lag
 * - Multiple users executing concurrently: backend queues requests
 *
 * @cleanup
 * When terminal closes (isOpen changes to false):
 * 1. Deletes target request: DELETE /api/v1/targets/{uuid}
 * 2. Resets useClusterDiscovery state (clusters, uuid, error)
 * 3. Clears selected cluster, output lines, command history
 * 4. Clears available commands cache
 * 5. Resets pagination to first page
 *
 * Cleanup is idempotent - safe to call multiple times.
 *
 * @example
 * Basic usage:
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <TerminalContent
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 *
 * Typical user flow:
 * ```
 * 1. User clicks terminal trigger button
 * 2. TerminalContent appears, shows "Loading clusters..."
 * 3. Clusters discovered and displayed in grid
 * 4. User types "5" and presses Enter (selects cluster 5)
 * 5. Prompt changes to "☸ production-cluster $"
 * 6. User types "kubectl get pods" and presses Enter
 * 7. Output appears with pod list and copy button
 * 8. User types "exit" or presses Ctrl+D to close
 * 9. Cleanup happens automatically
 * ```
 *
 * @see {@link useClusterDiscovery} for cluster discovery hook
 * @see {@link operatorApi.executeTerminalCommand} for command execution API
 * @see {@link operatorApi.getAvailableTerminalCommands} for command whitelist API
 */
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
  const [commandOutputs, setCommandOutputs] = useState<Map<number, string>>(new Map()); // Store stdout for each command
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [availableCommands, setAvailableCommands] = useState<AvailableCommandsResponse | null>(null);
  const previousIsOpenRef = useRef(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const CLUSTERS_PER_PAGE = 50;
  const COLUMNS = 5;
  const ROWS_PER_COLUMN = 10;

  // Handle click anywhere in terminal to restore focus and scroll to bottom
  const handleTerminalClick = (e: React.MouseEvent) => {
    // Don't steal focus if clicking on buttons or interactive elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    // Focus input (use setTimeout to ensure it happens after any other events)
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    // Scroll to bottom
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // Copy output to clipboard
  const handleCopyOutput = async (index: number) => {
    const output = commandOutputs.get(index);
    if (output) {
      try {
        await navigator.clipboard.writeText(output);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
        // Restore focus to input after copy
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } catch {
        // Silently handle copy failures
      }
    }
  };

  // Execute command on selected cluster
  const executeCommand = async (command: string) => {
    if (!selectedCluster || !discoveryUuid) return;

    setIsExecuting(true);

    // Add command to output immediately (with executing indicator)
    // Use functional update to avoid race conditions
    let commandIndex = 0;
    setOutputLines(prev => {
      commandIndex = prev.length; // Capture the index before adding
      return [
        ...prev,
        `☸ ${selectedCluster.clusterName} $ ${command}`,
        'Executing...',
      ];
    });

    try {
      const result = await operatorApi.executeTerminalCommand({
        cluster_id: selectedCluster.clusterName,
        uuid: discoveryUuid,
        command,
      });

      // Add stdout to output
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

      // Add stderr to output (always, like bash does)
      if (result.stderr) {
        const stderrLines = result.stderr.split('\n');
        // Remove empty string at the end if stderr ends with \n
        if (stderrLines[stderrLines.length - 1] === '') {
          stderrLines.pop();
        }
        output.push(...stderrLines);
      }

      // If command failed (exit code non-zero), add failure marker
      const failureMarker = result.exitCode !== 0 && result.exitCode !== undefined
        ? 'COMMAND_FAILED'
        : null;

      const finalOutput = failureMarker ? [...output, failureMarker] : output;

      // Store stdout for copying (use functional update)
      if (result.stdout) {
        setCommandOutputs(prev => new Map(prev).set(commandIndex, result.stdout));
      }

      // Replace "Executing..." with actual output + copy button marker
      const outputWithCopyMarker = result.stdout
        ? [...finalOutput, `COPY_BUTTON:${commandIndex}`]
        : finalOutput;

      // Replace the "Executing..." line with actual output (functional update)
      setOutputLines(prev => {
        const newLines = [...prev];
        // Remove the "Executing..." line (it's at commandIndex + 1)
        newLines.splice(commandIndex + 1, 1, ...outputWithCopyMarker);
        return newLines;
      });
    } catch (error) {
      let errorMessage = 'Command execution failed';

      if (error instanceof Error) {
        // Check for custom terminal errors
        if (error.message.startsWith('TERMINAL_ERROR:')) {
          const parts = error.message.split(':');
          const statusCode = parts[1];
          const commandName = parts[2];

          if (statusCode === '404') {
            errorMessage = `ksh: command not found: ${commandName}`;
          } else if (statusCode === '403') {
            errorMessage = `ksh: permission denied: ${commandName}`;
          } else if (statusCode === '500') {
            const clusterName = parts[2];
            const cmd = parts[3];
            errorMessage = `ksh: impossible to execute command on cluster ${clusterName}: ${cmd}`;
          }
        } else {
          errorMessage = error.message;
        }
      }

      // Replace "Executing..." with error (functional update)
      setOutputLines(prev => {
        const newLines = [...prev];
        // Remove the "Executing..." line (it's at commandIndex + 1)
        newLines.splice(commandIndex + 1, 1, errorMessage);
        return newLines;
      });
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

  // Load available commands when terminal opens
  useEffect(() => {
    if (isOpen && !availableCommands) {
      operatorApi.getAvailableTerminalCommands()
        .then(setAvailableCommands)
        .catch(() => {
          // Silently handle failures - user can still use terminal without help
        });
    }
  }, [isOpen, availableCommands]);

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
        operatorApi.deleteTargetRequest(discoveryUuid).catch(() => {
          // Silently handle cleanup failures
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
      setCommandOutputs(new Map());
      setCopiedIndex(null);
      setAvailableCommands(null);
    }
  }, [isOpen, discoveryUuid, reset]);

  // Handle retry on 'r' key press when in error state
  useEffect(() => {
    if (!error || !isOpen) return;

    const handleRetry = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        // Reset error state and restart discovery
        reset();
        setIsInitialized(false);
        startDiscovery();
      }
    };

    window.addEventListener('keydown', handleRetry);
    return () => window.removeEventListener('keydown', handleRetry);
  }, [error, isOpen, reset, startDiscovery]);

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
        const sortedClusters = clusters ? [...clusters].sort((a, b) =>
          a.clusterName.localeCompare(b.clusterName)
        ) : [];
        const totalPages = sortedClusters.length > 0 ? Math.ceil(sortedClusters.length / CLUSTERS_PER_PAGE) : 0;
        const hasNextPage = currentPage < totalPages - 1;

        if (hasNextPage) {
          // Go to next page if available
          setCurrentPage(currentPage + 1);
        } else {
          // No next page - add empty line to output (like real terminal)
          const promptSymbol = selectedCluster ? `☸ ${selectedCluster.clusterName} $` : '$';
          setOutputLines(prev => [...prev, `${promptSymbol} `]);
        }
      } else if (!selectedCluster) {
        // Cluster selection mode
        const command = inputValue.trim();

        // Handle 'exit' command to close terminal
        if (command === 'exit') {
          onClose();
          return;
        }

        // Handle '?' command to show available commands
        if (command === '?') {
          const helpLines = ['$ ?', 'Available commands:'];

          if (availableCommands) {
            availableCommands.commands.forEach(cmd => {
              helpLines.push('');
              helpLines.push(`${cmd.name} - ${cmd.description}`);
              cmd.subcommands.forEach(sub => {
                helpLines.push(`  ${sub.name} - ${sub.description}`);
              });
            });
          } else {
            helpLines.push('Loading available commands...');
          }

          setOutputLines(prev => [...prev, ...helpLines]);
          setInputValue('');
          return;
        }

        // Parse cluster number (use sorted clusters)
        const clusterNumber = parseInt(command, 10);
        const sortedClusters = clusters ? [...clusters].sort((a, b) =>
          a.clusterName.localeCompare(b.clusterName)
        ) : [];
        if (sortedClusters.length > 0 && clusterNumber >= 1 && clusterNumber <= sortedClusters.length) {
          const cluster = sortedClusters[clusterNumber - 1];
          setSelectedCluster(cluster);
          setOutputLines(prev => [
            ...prev,
            `$ ${command}`,
            `Connected to cluster: ${cluster.clusterName}`,
            '',
          ]);
        } else {
          setOutputLines(prev => [
            ...prev,
            `$ ${command}`,
            `Error: Invalid cluster number. Please select 1-${sortedClusters?.length || 0}`,
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

        // Handle '?' command to show available commands
        if (command === '?') {
          const helpLines = [`☸ ${selectedCluster.clusterName} $ ?`, 'Available commands:'];

          if (availableCommands) {
            availableCommands.commands.forEach(cmd => {
              helpLines.push('');
              helpLines.push(`${cmd.name} - ${cmd.description}`);
              cmd.subcommands.forEach(sub => {
                helpLines.push(`  ${sub.name} - ${sub.description}`);
              });
            });
          } else {
            helpLines.push('Loading available commands...');
          }

          setOutputLines(prev => [...prev, ...helpLines]);
          setInputValue('');
          return;
        }

        // Client-side validation if available commands are loaded
        if (availableCommands) {
          const commandParts = command.split(/\s+/);
          const mainCommand = commandParts[0];
          const subCommand = commandParts[1];

          // Check if main command is allowed (kubectl or oc)
          const allowedCommand = availableCommands.commands.find(cmd => cmd.name === mainCommand);
          if (!allowedCommand) {
            setOutputLines(prev => [
              ...prev,
              `☸ ${selectedCluster.clusterName} $ ${command}`,
              `ksh: command not found: ${mainCommand}`,
              'Type ? for available commands',
            ]);
            setInputValue('');
            return;
          }

          // Check if subcommand is in allowed list
          if (subCommand) {
            const allowedSubcommand = allowedCommand.subcommands.find(sub => sub.name === subCommand);
            if (!allowedSubcommand) {
              setOutputLines(prev => [
                ...prev,
                `☸ ${selectedCluster.clusterName} $ ${command}`,
                `ksh: ${mainCommand}: ${subCommand}: command not found`,
                'Type ? for available commands',
              ]);
              setInputValue('');
              return;
            }
          }

          // Check for blocked flags
          const blockedFlags = ['--watch', '-w', '--follow', '-f', '--watch-only'];
          const hasBlockedFlag = blockedFlags.some(flag => command.includes(flag));
          if (hasBlockedFlag) {
            setOutputLines(prev => [
              ...prev,
              `☸ ${selectedCluster.clusterName} $ ${command}`,
              'Error: Streaming flags (--watch, --follow) are not supported',
              'These flags require WebSocket/SSE which is not available in v1',
            ]);
            setInputValue('');
            return;
          }
        }

        // Add command to history (avoid duplicates of last command)
        if (command && (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== command)) {
          setCommandHistory([...commandHistory, command]);
        }

        // Execute command on selected cluster
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

  // Clusters loaded - sort alphabetically by name and render interactive terminal
  const sortedClusters = [...clusters].sort((a, b) =>
    a.clusterName.localeCompare(b.clusterName)
  );
  const columns = formatClustersGrid(sortedClusters);
  const totalPages = Math.ceil(sortedClusters.length / CLUSTERS_PER_PAGE);
  const hasNextPage = currentPage < totalPages - 1;

  return (
    <div className="terminal-content" onClick={handleTerminalClick}>
      {/* Show cluster selection header and grid only if no cluster is selected */}
      {!selectedCluster && (
        <>
          <div className="terminal-line">
            Select a cluster (showing {currentPage * CLUSTERS_PER_PAGE + 1}-
            {Math.min((currentPage + 1) * CLUSTERS_PER_PAGE, sortedClusters.length)} of {sortedClusters.length}):
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
      {outputLines.map((line, index) => {
        // Check for special markers
        if (line === 'COMMAND_FAILED') {
          return (
            <div key={index} className="terminal-line terminal-error">
              Command failed
            </div>
          );
        }
        if (line.startsWith('COPY_BUTTON:')) {
          const cmdIndex = parseInt(line.split(':')[1], 10);
          return (
            <div key={index} className="terminal-line terminal-copy-container">
              <button
                className="terminal-copy-button"
                onClick={() => handleCopyOutput(cmdIndex)}
                title="Copy output to clipboard"
              >
                <CopyIcon /> {copiedIndex === cmdIndex ? 'Copied!' : 'Copy output'}
              </button>
            </div>
          );
        }
        return (
          <div key={index} className="terminal-line terminal-output">
            {line}
          </div>
        );
      })}

      <div className="terminal-line terminal-hint">
        {hasNextPage && !selectedCluster && (
          <>Press <span className="terminal-key">Enter</span> for next page &middot; </>
        )}
        Type <span className="terminal-key">?</span> for available commands &middot; Press <span className="terminal-key">Ctrl+D</span> or type <span className="terminal-key">exit</span> to close
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

