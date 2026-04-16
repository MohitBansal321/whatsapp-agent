import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { google } from 'googleapis';

// Mock the googleapis module
vi.mock('googleapis', () => {
  return {
    google: {
      auth: {
        GoogleAuth: vi.fn(),
      },
      sheets: vi.fn(),
    },
  };
});

describe('POST /api/sync-sheets', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  it('should return 400 if sheetId is missing', async () => {
    const response = await request(app).post('/api/sync-sheets').send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Sheet ID is required' });
  });

  it('should return 500 if GOOGLE_SERVICE_ACCOUNT_KEY is not configured', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    const response = await request(app)
      .post('/api/sync-sheets')
      .send({ sheetId: 'some-sheet-id' });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
  });

  it('should successfully sync and return leads', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      client_email: 'test@example.com',
      private_key: 'test-key',
    });

    const mockGet = vi.fn().mockResolvedValue({
      data: {
        values: [
          ['John Doe', '+1234567890', 'Home Loan'],
          ['Jane Smith', '+0987654321', undefined],
        ],
      },
    });

    // Setup the mock for google.sheets
    (google.sheets as any).mockReturnValue({
      spreadsheets: {
        values: {
          get: mockGet,
        },
      },
    });

    const response = await request(app)
      .post('/api/sync-sheets')
      .send({ sheetId: 'some-sheet-id' });

    expect(mockGet).toHaveBeenCalledWith({
      spreadsheetId: 'some-sheet-id',
      range: 'A2:C100',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      leads: [
        { name: 'John Doe', phone: '+1234567890', loanType: 'Home Loan' },
        { name: 'Jane Smith', phone: '+0987654321', loanType: 'Personal Loan' }, // Default loan type
      ],
    });
  });

  it('should successfully sync and return empty array if no rows are found', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      client_email: 'test@example.com',
      private_key: 'test-key',
    });

    const mockGet = vi.fn().mockResolvedValue({
      data: {
        values: null, // Simulate empty response
      },
    });

    (google.sheets as any).mockReturnValue({
      spreadsheets: {
        values: {
          get: mockGet,
        },
      },
    });

    const response = await request(app)
      .post('/api/sync-sheets')
      .send({ sheetId: 'some-sheet-id' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ leads: [] });
  });

  it('should return 500 if the Google Sheets API throws an error', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      client_email: 'test@example.com',
      private_key: 'test-key',
    });

    const mockGet = vi.fn().mockRejectedValue(new Error('Google API Error'));

    (google.sheets as any).mockReturnValue({
      spreadsheets: {
        values: {
          get: mockGet,
        },
      },
    });

    const response = await request(app)
      .post('/api/sync-sheets')
      .send({ sheetId: 'some-sheet-id' });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Google API Error');
  });
});
