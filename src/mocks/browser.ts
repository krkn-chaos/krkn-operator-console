import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { websocketHandlers } from './websocketHandlers';

export const worker = setupWorker(...handlers, ...websocketHandlers);
