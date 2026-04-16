import { vi } from 'vitest';

vi.mock('module', async (importOriginal) => {
  const actual = await importOriginal<typeof import('module')>();
  return {
    ...actual,
    createRequire: vi.fn(() => {
      const mockRequire = vi.fn((moduleName) => {
        if (moduleName === 'pdf-parse') {
          return vi.fn().mockImplementation(async (buffer) => {
             if (buffer.toString() === 'error') {
               throw new Error('PDF parsing error');
             }
             return { text: 'mocked pdf text content' };
          });
        }
        return actual.createRequire(import.meta.url)(moduleName);
      });
      return mockRequire;
    })
  }
});
