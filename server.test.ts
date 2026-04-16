import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from './server';

describe('POST /api/upload-kb', () => {
  it('should return 400 if no file is uploaded', async () => {
    const response = await request(app).post('/api/upload-kb');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'No file uploaded' });
  });

  it('should return 500 if pdf-parse fails', async () => {
    const response = await request(app)
      .post('/api/upload-kb')
      .attach('file', Buffer.from('error'), 'test.pdf');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to parse Knowledge Base PDF' });
  });

  it('should return extracted text if successful', async () => {
    const response = await request(app)
      .post('/api/upload-kb')
      .attach('file', Buffer.from('dummy pdf content'), 'test.pdf');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'mocked pdf text content' });
  });
});
