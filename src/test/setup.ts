import '@testing-library/jest-dom';

// Mock scrollIntoView which is not implemented in jsdom
Element.prototype.scrollIntoView = vi.fn();

// Mock window.matchMedia which is not implemented in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
