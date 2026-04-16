import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "./server";

// Mock the @google/genai library
vi.mock("@google/genai", () => {
  const sendMessageMock = vi.fn();
  const createChatMock = vi.fn().mockReturnValue({
    sendMessage: sendMessageMock,
  });

  // The SDK export is a class, so we need to mock it as a constructor
  class MockGoogleGenAI {
    chats = {
      create: createChatMock,
    };
    constructor() {}
  }

  return {
    GoogleGenAI: MockGoogleGenAI,
    __sendMessageMock: sendMessageMock,
    __createChatMock: createChatMock,
  };
});

// Import the mocked sendMessage to assert on it
import { __sendMessageMock, __createChatMock } from "@google/genai";

describe("POST /api/chat-audio", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks and environment variables before each test
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "test" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return 400 if no audio file is uploaded", async () => {
    const response = await request(app)
      .post("/api/chat-audio")
      .send({ history: "[]", config: "{}" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "No audio file uploaded" });
  });

  it("should return 500 if API key is not configured", async () => {
    // Clear any API keys
    delete process.env.API_KEY_G;
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;

    const response = await request(app)
      .post("/api/chat-audio")
      .attach("audio", Buffer.from("mock audio buffer"), "audio.webm")
      .field("history", "[]")
      .field("config", "{}");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Gemini API key is not configured." });
  });

  it("should process audio successfully and return AI response", async () => {
    process.env.GEMINI_API_KEY = "test_api_key_1234567890";

    // Set up the mock response
    __sendMessageMock.mockResolvedValueOnce({ text: "Mock AI Response" });

    const response = await request(app)
      .post("/api/chat-audio")
      .attach("audio", Buffer.from("mock audio content"), {
        filename: "test.webm",
        contentType: "audio/webm",
      })
      .field("history", "[]")
      .field("config", JSON.stringify({ companyName: "Test Company" }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: "Mock AI Response" });

    // Assert that the GenAI library was called correctly
    expect(__createChatMock).toHaveBeenCalled();
    expect(__sendMessageMock).toHaveBeenCalledWith({
      message: [
        {
          inlineData: {
            mimeType: "audio/webm",
            data: Buffer.from("mock audio content").toString("base64"),
          },
        },
        { text: "Please listen to this audio message and respond accordingly." },
      ],
    });
  });

  it("should handle AI processing errors", async () => {
    process.env.GEMINI_API_KEY = "test_api_key_1234567890";

    // Make the mock throw an error
    __sendMessageMock.mockRejectedValueOnce(new Error("AI processing failed"));

    const response = await request(app)
      .post("/api/chat-audio")
      .attach("audio", Buffer.from("mock audio content"), "test.webm");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "AI processing failed" });
  });
});
