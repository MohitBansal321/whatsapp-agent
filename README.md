# 🤖 Bharat Loans AI Agent — Multi-Tenant SaaS Platform

> An intelligent, multi-tenant AI loan agent that handles real customer conversations, converts leads, and adapts to each company's brand and knowledge base — powered by Google Gemini.

![TypeScript](https://img.shields.io/badge/TypeScript-99.7%25-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-v18%2B-6DA55F?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?style=flat-square&logo=react&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Gemini](https://img.shields.io/badge/Google-Gemini%20AI-4285F4?style=flat-square&logo=google&logoColor=white)

---

## 🚀 What This Does

Businesses in the lending space deal with hundreds of customer queries every day. This platform deploys a **conversational AI agent per company** that:

- Answers loan-related questions in real time (text + voice)
- Speaks the customer's language — including **Hinglish** auto-detection
- Grounds its answers in company-specific PDFs using **RAG (Retrieval-Augmented Generation)**
- Tracks leads, conversion rates, and cost-per-lead in an analytics dashboard
- Keeps each company's data completely isolated via **multi-tenancy**

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🏢 **Multi-Tenancy** | Each company gets isolated leads, config, and AI personality |
| 🧠 **RAG Engine** | AI answers grounded in uploaded PDF knowledge bases |
| 🎙️ **Voice Support** | Users send voice notes → transcribed → AI responds |
| 🌐 **Multi-lingual** | Auto-detects language, responds in Hindi, English, or Hinglish |
| 📊 **Analytics** | Conversion rates, cost per lead, time saved |
| 📥 **Lead Import** | Import leads via CSV, PDF, or Google Sheets |

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript
- **Backend**: Express.js, TypeScript
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication (Google Sign-in)
- **AI**: Google Gemini API (text + audio)
- **Storage**: Firebase Storage (PDFs, audio)
- **Testing**: Vitest

---

## ⚡ Quick Start

### Prerequisites

- Node.js v18+
- A [Firebase](https://firebase.google.com/) project (Firestore + Google Auth enabled)
- A [Google AI Studio](https://aistudio.google.com/) API key

### 1. Clone & Install

```bash
git clone https://github.com/MohitBansal321/whatsapp-agent.git
cd whatsapp-agent
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Add your Gemini API key to `.env`:

```
GEMINI_API_KEY=your_google_ai_studio_api_key
```

Create `firebase-applet-config.json` in the root:

```json
{
  "apiKey": "your-api-key",
  "authDomain": "your-auth-domain",
  "projectId": "your-project-id",
  "storageBucket": "your-storage-bucket",
  "messagingSenderId": "your-messaging-sender-id",
  "appId": "your-app-id"
}
```

### 3. Run

```bash
npm run dev
```

Open **http://localhost:3000** — the Express backend and React frontend run together via Vite middleware.

---

## 🏗️ Project Structure

```
whatsapp-agent/
├── src/                    # React frontend (App.tsx, Firebase init)
├── tests/                  # Test suites
├── server.ts               # Express backend (Gemini API, audio, PDF parsing)
├── firebase-blueprint.json # Firestore schema & multi-tenancy design
├── firestore.rules         # Security rules (data isolation per tenant)
├── .env.example            # Environment variable template
└── vitest.config.ts        # Test configuration
```

---

## 🧩 Architecture Highlights

- **Full-stack monorepo**: Single `npm run dev` starts both Express API and React app
- **RAG pipeline**: PDFs uploaded → chunked → stored in Firestore → retrieved on query → injected into Gemini prompt
- **Audio flow**: Voice note recorded → sent as binary → transcribed server-side → response generated → returned as text
- **Tenant isolation**: Firestore rules enforce that Company A cannot access Company B's data

---

## 📄 License

MIT — feel free to use, fork, and build on this.

---

> Built by [Mohit Bansal](https://github.com/MohitBansal321) · [LinkedIn](https://linkedin.com/in/mohitbansalhmh) · [askaide.in](https://askaide.in)
