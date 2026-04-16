import { vi } from 'vitest';
vi.mock('pdf-parse', () => {
  return {
    default: vi.fn(),
  };
});
