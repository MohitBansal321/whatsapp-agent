import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server';

// Mock module.createRequire specifically to intercept pdf-parse
vi.mock('module', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    createRequire: (url: string) => {
      // Return a function that mimics the require function
      return (moduleName: string) => {
        if (moduleName === 'pdf-parse') {
          // Instead of actually requiring pdf-parse, we return our mock
          return async (buffer: any) => {
             // Look for a magic string or test case marker
             if (buffer.toString() === 'error pdf content') {
               throw new Error('PDF parsing error');
             }
             return {
                text: `
                  John Doe
                  +919876543210
                  Jane Smith
                  9876543211
                `
             };
          };
        }
        // Fallback for other requires, if any
        // NOTE: If server.ts requires other things this way we might need to handle them
        return (actual as any).createRequire(url)(moduleName);
      };
    }
  };
});


describe('POST /api/parse-pdf', () => {
  it('should return 400 if no file is uploaded', async () => {
    const response = await request(app).post('/api/parse-pdf');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'No file uploaded' });
  });

  it('should successfully parse a PDF and extract leads', async () => {
    const dummyFileBuffer = Buffer.from('dummy pdf content');

    const response = await request(app)
      .post('/api/parse-pdf')
      .attach('file', dummyFileBuffer, 'dummy.pdf');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('leads');
    expect(response.body.leads).toHaveLength(2);
    expect(response.body.leads[0]).toEqual({
      name: 'John Doe',
      phone: '+919876543210',
      loanType: 'Personal Loan',
    });
    expect(response.body.leads[1]).toEqual({
      name: 'Jane Smith',
      phone: '9876543211',
      loanType: 'Personal Loan',
    });
  });

  it('should return 500 if PDF parsing fails', async () => {
    const dummyFileBuffer = Buffer.from('error pdf content');

    const response = await request(app)
      .post('/api/parse-pdf')
      .attach('file', dummyFileBuffer, 'dummy.pdf');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to parse PDF' });
  });
});
