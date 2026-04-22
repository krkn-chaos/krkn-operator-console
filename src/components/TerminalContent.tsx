import { useState, useEffect, useRef } from 'react';
import { useClusterDiscovery } from '../hooks/useClusterDiscovery';
import { operatorApi } from '../services/operatorApi';
import type { TargetResponse } from '../types/api';
import './TerminalContent.css';

interface TerminalContentProps {
  isOpen: boolean;
}

export function TerminalContent({ isOpen }: TerminalContentProps) {
  const { clusters, discoveryUuid, isLoading, error, startDiscovery, retry, reset } = useClusterDiscovery();
  const [currentPage, setCurrentPage] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const previousIsOpenRef = useRef(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);

  const CLUSTERS_PER_PAGE = 50;
  const COLUMNS = 5;
  const ROWS_PER_COLUMN = 10;

  // Start discovery when terminal opens
  useEffect(() => {
    if (isOpen && !isInitialized && !clusters && !isLoading && !error) {
      startDiscovery();
      setIsInitialized(true);
    }
  }, [isOpen, isInitialized, clusters, isLoading, error, startDiscovery]);

  // Auto-focus input when terminal opens and clusters are loaded
  useEffect(() => {
    if (isOpen && clusters && clusters.length > 0 && inputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, clusters]);

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
      setIsInitialized(false);
    }
  }, [isOpen, discoveryUuid, reset]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!inputValue.trim()) {
        // Empty input - go to next page if available
        if (clusters && (currentPage + 1) * CLUSTERS_PER_PAGE < clusters.length) {
          setCurrentPage(currentPage + 1);
        }
      } else {
        // TODO: Handle cluster selection
        console.log('Selected cluster number:', inputValue);
      }
      setInputValue('');
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

  // Loading state with animated dots
  if (isLoading) {
    return (
      <div className="terminal-content">
        <div className="terminal-line">
          Loading clusters<span className="loading-dots">...</span>
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

  // Clusters loaded
  if (clusters && clusters.length > 0) {
    const columns = formatClustersGrid(clusters);
    const totalPages = Math.ceil(clusters.length / CLUSTERS_PER_PAGE);
    const hasNextPage = currentPage < totalPages - 1;

    return (
      <div className="terminal-content">
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

        {hasNextPage && (
          <div className="terminal-line terminal-hint">
            Press <span className="terminal-key">Enter</span> for next page
          </div>
        )}

        <div className="terminal-prompt">
          <span className="prompt-symbol">$</span>{' '}
          <div className="terminal-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              className="terminal-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder=""
            />
            <div className="terminal-display">
              <span className="terminal-display-text">{inputValue}</span>
              <span className="terminal-cursor-block">_</span>
            </div>
          </div>
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
  return (
    <div className="terminal-content">
      <div className="terminal-line">Ready...</div>
    </div>
  );
}
