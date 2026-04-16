import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from './server';

import { GoogleGenAI } from '@google/genai';

vi.mock('@google/genai', () => {
  const mockGoogleGenAI = vi.fn();
  mockGoogleGenAI.prototype.chats = {
    create: vi.fn().mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue({ text: 'mocked response' })
    })
  };
  return {
    GoogleGenAI: mockGoogleGenAI
  };
});

describe('server.ts /api/chat fallback API key handling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset vi mocks
    vi.clearAllMocks();

    // Clear relevant environment variables before each test
    process.env = { ...originalEnv };
    delete process.env.API_KEY_G;
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;
  });

  afterEach(() => {
    // Restore process.env
    process.env = originalEnv;
  });

  it('should use API_KEY_G when provided, ignoring GEMINI_API_KEY and API_KEY', async () => {
    process.env.API_KEY_G = 'valid-api-key-g-1234567890';
    process.env.GEMINI_API_KEY = 'valid-gemini-key-1234567890';
    process.env.API_KEY = 'valid-fallback-key-1234567890';

    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'Hello' });

    expect(response.status).toBe(200);
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'valid-api-key-g-1234567890' });
  });

  it('should fallback to GEMINI_API_KEY when API_KEY_G is not provided', async () => {
    process.env.GEMINI_API_KEY = 'valid-gemini-key-1234567890';
    process.env.API_KEY = 'valid-fallback-key-1234567890';

    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'Hello' });

    expect(response.status).toBe(200);
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'valid-gemini-key-1234567890' });
  });

  it('should fallback to API_KEY when API_KEY_G and GEMINI_API_KEY are not provided', async () => {
    process.env.API_KEY = 'valid-fallback-key-1234567890';

    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'Hello' });

    expect(response.status).toBe(200);
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'valid-fallback-key-1234567890' });
  });

  it('should return 500 when no API key is provided', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'Hello' });

    expect(response.status).toBe(500);
    expect(response.body.error).toContain("Gemini API key is not configured");
    expect(GoogleGenAI).not.toHaveBeenCalled();
  });

  it('should return 500 when API key is too short', async () => {
    process.env.API_KEY_G = 'short';

    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'Hello' });

    expect(response.status).toBe(500);
    expect(response.body.error).toContain("Gemini API key is not configured");
    expect(GoogleGenAI).not.toHaveBeenCalled();
  });
});
