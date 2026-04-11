# Bharat Loans AI Agent (Multi-Tenant SaaS)

A multi-tenant AI loan agent platform built with React, Vite, Express, and Firebase. It features a conversational AI powered by Google's Gemini API, capable of handling loan inquiries, converting leads, and performing Retrieval-Augmented Generation (RAG) based on company-specific knowledge bases.

## Features
- **Multi-Tenancy:** Support for multiple companies, each with their own isolated leads, configuration, and AI personality.
- **AI Chat Agent:** Conversational AI using Gemini, capable of text and audio interactions.
- **RAG (Retrieval-Augmented Generation):** AI answers are grounded in company-specific knowledge bases (PDF uploads).
- **Voice Capabilities:** Users can record and send voice notes, which are transcribed and processed by the AI.
- **Multi-lingual Support:** Auto-detects and responds in the user's language (including Hinglish).
- **Analytics Dashboard:** Tracks conversion rates, cost per lead, and time saved.
- **Lead Management:** Import leads via CSV, PDF, or Google Sheets.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js)

You will also need:
- A [Firebase](https://firebase.google.com/) project with Firestore and Authentication (Google Sign-in) enabled.
- A [Google AI Studio](https://aistudio.google.com/) API key for Gemini.

## Local Development Setup

Follow these steps to run the frontend and backend code locally on your machine.

### 1. Clone or Extract the Project
If you exported this project as a ZIP or to GitHub, extract it or clone it to your local machine:
```bash
git clone <your-repo-url>
cd <your-repo-directory>
```

### 2. Install Dependencies
Install all required npm packages. This project uses a unified package.json for both frontend and backend dependencies:
```bash
npm install
```

### 3. Set up Environment Variables
Create a `.env` file in the root directory of the project and add your Gemini API key:
```env
GEMINI_API_KEY=your_google_ai_studio_api_key_here
```

Ensure your `firebase-applet-config.json` is present in the root directory with your Firebase project credentials. If it's missing, create it with your Firebase config:
```json
{
  "apiKey": "your-api-key",
  "authDomain": "your-auth-domain",
  "projectId": "your-project-id",
  "storageBucket": "your-storage-bucket",
  "messagingSenderId": "your-messaging-sender-id",
  "appId": "your-app-id",
  "firestoreDatabaseId": "(default)"
}
```

### 4. Run the Application
This project uses a unified full-stack setup. The Express backend (`server.ts`) serves the API routes (like `/api/chat` and `/api/chat-audio`) and uses Vite as middleware to serve the React frontend simultaneously.

To start the development server, run:
```bash
npm run dev
```

The server will start, and you can access the application in your browser at:
**http://localhost:3000**

## Project Structure
- `/src`: Contains the React frontend code (`App.tsx`, Firebase initialization, etc.).
- `server.ts`: The Express backend server that handles API requests (Gemini integration, PDF parsing, audio processing) and serves the Vite frontend.
- `firebase-blueprint.json`: Defines the Firestore database schema and multi-tenancy structure.
- `firestore.rules`: Security rules for Firestore to ensure data isolation between tenants.
