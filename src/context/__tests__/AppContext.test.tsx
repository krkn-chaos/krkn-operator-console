import { render, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppProvider, useAppContext } from '../AppContext';
import type { GraphRunState, AppAction } from '../../types/api';

let capturedDispatch: React.Dispatch<AppAction>;
let capturedState: ReturnType<typeof useAppContext>['state'];

function StateReader() {
  const { state, dispatch } = useAppContext();
  capturedDispatch = dispatch;
  capturedState = state;
  return <div data-testid="loading-details">{JSON.stringify([...state.loadingRunDetails])}</div>;
}

function renderWithProvider() {
  return render(
    <AppProvider>
      <StateReader />
    </AppProvider>,
  );
}

const makeGraphRun = (overrides: Partial<GraphRunState> = {}): GraphRunState => ({
  name: 'graph-run-1',
  namespace: 'krkn-operator-system',
  creationTimestamp: '2026-01-01T00:00:00Z',
  phase: 'Running',
  ownerUserId: 'admin@test.com',
  targetRequestId: 'target-001',
  summary: { totalNodes: 2, completedNodes: 0, runningNodes: 2, failedNodes: 0, pendingNodes: 0 },
  ...overrides,
});

describe('AppContext reducer', () => {
  describe('SET_RUN_DETAILS_LOADING', () => {
    it('adds a run name when loading is true', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({ type: 'SET_RUN_DETAILS_LOADING', payload: { scenarioRunName: 'run-1', loading: true } });
      });

      expect(capturedState.loadingRunDetails.has('run-1')).toBe(true);
    });

    it('removes a run name when loading is false', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({ type: 'SET_RUN_DETAILS_LOADING', payload: { scenarioRunName: 'run-1', loading: true } });
      });
      act(() => {
        capturedDispatch({ type: 'SET_RUN_DETAILS_LOADING', payload: { scenarioRunName: 'run-1', loading: false } });
      });

      expect(capturedState.loadingRunDetails.has('run-1')).toBe(false);
    });

    it('tracks multiple runs independently', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({ type: 'SET_RUN_DETAILS_LOADING', payload: { scenarioRunName: 'run-1', loading: true } });
        capturedDispatch({ type: 'SET_RUN_DETAILS_LOADING', payload: { scenarioRunName: 'run-2', loading: true } });
      });
      act(() => {
        capturedDispatch({ type: 'SET_RUN_DETAILS_LOADING', payload: { scenarioRunName: 'run-1', loading: false } });
      });

      expect(capturedState.loadingRunDetails.has('run-1')).toBe(false);
      expect(capturedState.loadingRunDetails.has('run-2')).toBe(true);
    });
  });

  describe('ADD_GRAPH_RUN', () => {
    it('adds a new graph run to state', () => {
      renderWithProvider();
      const run = makeGraphRun();

      act(() => {
        capturedDispatch({ type: 'ADD_GRAPH_RUN', payload: { run } });
      });

      expect(capturedState.graphRuns).toHaveLength(1);
      expect(capturedState.graphRuns[0].name).toBe('graph-run-1');
    });

    it('merges with existing run using ?? for resiliency fields', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({
          type: 'ADD_GRAPH_RUN',
          payload: {
            run: makeGraphRun({
              resiliencyScoreEnabled: true,
              resiliencyScoreBaseline: 80,
              resiliencyScore: { calculated: 90, baseline: 80, status: 'pass', message: 'ok' },
            }),
          },
        });
      });

      act(() => {
        capturedDispatch({
          type: 'ADD_GRAPH_RUN',
          payload: {
            run: makeGraphRun({
              phase: 'Completed',
              resiliencyScoreEnabled: undefined,
              resiliencyScoreBaseline: undefined,
              resiliencyScore: undefined,
            }),
          },
        });
      });

      const run = capturedState.graphRuns.find(r => r.name === 'graph-run-1')!;
      expect(run.phase).toBe('Completed');
      expect(run.resiliencyScoreEnabled).toBe(true);
      expect(run.resiliencyScoreBaseline).toBe(80);
      expect(run.resiliencyScore?.calculated).toBe(90);
    });
  });

  describe('UPDATE_GRAPH_RUN', () => {
    it('preserves existing resiliency fields when incoming is undefined', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({
          type: 'LOAD_GRAPH_RUNS_SUCCESS',
          payload: {
            runs: [makeGraphRun({
              resiliencyScoreEnabled: true,
              resiliencyScoreBaseline: 80,
              resiliencyScore: { calculated: 85, baseline: 80, status: 'pass', message: 'ok' },
            })],
          },
        });
      });

      act(() => {
        capturedDispatch({
          type: 'UPDATE_GRAPH_RUN',
          payload: {
            run: makeGraphRun({
              phase: 'Completed',
              resiliencyScoreEnabled: undefined,
              resiliencyScoreBaseline: undefined,
              resiliencyScore: undefined,
            }),
          },
        });
      });

      const run = capturedState.graphRuns[0];
      expect(run.phase).toBe('Completed');
      expect(run.resiliencyScoreEnabled).toBe(true);
      expect(run.resiliencyScoreBaseline).toBe(80);
      expect(run.resiliencyScore?.calculated).toBe(85);
    });

    it('overwrites resiliency fields when incoming has values', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({
          type: 'LOAD_GRAPH_RUNS_SUCCESS',
          payload: {
            runs: [makeGraphRun({
              resiliencyScore: { calculated: 70, baseline: 80, status: 'fail', message: 'old' },
            })],
          },
        });
      });

      act(() => {
        capturedDispatch({
          type: 'UPDATE_GRAPH_RUN',
          payload: {
            run: makeGraphRun({
              resiliencyScore: { calculated: 90, baseline: 80, status: 'pass', message: 'new' },
            }),
          },
        });
      });

      expect(capturedState.graphRuns[0].resiliencyScore?.calculated).toBe(90);
      expect(capturedState.graphRuns[0].resiliencyScore?.status).toBe('pass');
    });
  });

  describe('NAVIGATE_TO_TERMINAL', () => {
    it('transitions to terminal phase', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({ type: 'NAVIGATE_TO_TERMINAL' });
      });

      expect(capturedState.phase).toBe('terminal');
    });
  });

  describe('GO_BACK from terminal', () => {
    it('navigates from terminal back to jobs_list', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({ type: 'NAVIGATE_TO_TERMINAL' });
      });

      act(() => {
        capturedDispatch({ type: 'GO_BACK' });
      });

      expect(capturedState.phase).toBe('jobs_list');
    });
  });

  describe('NAVIGATE_TO_FILES', () => {
    it('transitions to files phase', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({ type: 'NAVIGATE_TO_FILES' });
      });

      expect(capturedState.phase).toBe('files');
    });
  });

  describe('GO_BACK from files', () => {
    it('navigates from files back to jobs_list', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({ type: 'NAVIGATE_TO_FILES' });
      });

      act(() => {
        capturedDispatch({ type: 'GO_BACK' });
      });

      expect(capturedState.phase).toBe('jobs_list');
    });
  });

  describe('NAVIGATE_TO_ELASTICSEARCH_DATA', () => {
    it('transitions to elasticsearch_data phase', () => {
      renderWithProvider();

      act(() => {
        capturedDispatch({ type: 'NAVIGATE_TO_ELASTICSEARCH_DATA' });
      });

      expect(capturedState.phase).toBe('elasticsearch_data');
    });
  });
});
