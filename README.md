# Student Loan Knight

> Your AI-powered quest to defeat student debt.
> Built with Gemini 3 as Game Master — not a chatbot, an orchestrator.

**Live Demo:** https://slknight-832393492445.us-central1.run.app

---

## How It Works

SLKnight is a **multi-agent orchestrator** that takes a single user action (like uploading a loan statement) and triggers a chain of specialized AI agents that react to each other in real time. No clicking through menus — agents pass the baton autonomously.

```
 Upload loan screenshot
         │
         ▼
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │    Vision     │───▶│   Watchdog   │───▶│   Freedom    │
 │ Extract data  │    │ Match grants │    │ Build path   │
 │ Gemini Pro    │    │ Gemini Pro   │    │ Gemini Pro   │
 └──────────────┘    └──────┬───────┘    └──────┬───────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐    ┌──────────────┐
                     │    Letter    │    │  Call Script  │
                     │ Draft letter │    │ Talking pts   │
                     │ Gemini Pro   │    │ Gemini Pro   │
                     └──────────────┘    └──────────────┘

 5 agents fired · 1 user action · fully automated
```

The frontend displays a **live Agent Activity Feed** showing each agent triggering the next, with expandable cards for every output.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER                                    │
│  Next.js 16 (App Router) · Framer Motion · Mapbox GL              │
│                                                                     │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────────┐    │
│  │  Game Card   │  │ Agent Activity   │  │  Orchestrator      │    │
│  │  (left col)  │  │ Feed (right col) │  │  Panel (modal)     │    │
│  └─────────────┘  └──────────────────┘  └────────────────────┘    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ fetch + SSE streams
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     REVERSE PROXY (:8080)                           │
│  /api/*  ──▶  Express Backend (:3001)                              │
│  /*      ──▶  Next.js Standalone (:3000)                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                     EXPRESS BACKEND                                  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  ORCHESTRATOR                                 │  │
│  │  Wraps every agent call with:                                │  │
│  │  · Performance tracking (latency, success rate)              │  │
│  │  · Quality evaluation via Gemini Flash                       │  │
│  │  · Auto-retry on critical failures                           │  │
│  │  · Self-correction logging                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  AGENT EVENT BUS                              │  │
│  │                                                              │  │
│  │  vision:extracted ──▶ watchdog, freedom                      │  │
│  │  watchdog:matched ──▶ freedom, letter                        │  │
│  │  debate:verdict   ──▶ freedom, coach                         │  │
│  │  freedom:updated  ──▶ call-script, coach                     │  │
│  │  letter:generated ──▶ call-script                            │  │
│  │  coach:insight    ──▶ freedom (if strategy change)           │  │
│  │                                                              │  │
│  │  Max chain depth: 3 hops · SSE broadcast to frontend         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      GEMINI 3 MODELS                                │
│  gemini-3-pro-preview    Reasoning, path generation, letters       │
│  gemini-3-flash-preview  Low-latency chat, quality evaluation      │
│  gemini-3-pro-preview    Vision/OCR (document extraction)          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agent System

| Agent | Model | Purpose | Triggers | Triggered By |
|-------|-------|---------|----------|--------------|
| **Vision** | Gemini Pro | Extract loan data from screenshots | `vision:extracted` | User upload |
| **Watchdog** | Gemini Pro | Match grants/opportunities to profile | `watchdog:matched` | `vision:extracted` |
| **Freedom** | Gemini Pro | Generate personalized debt-free path | `freedom:updated` | `vision:extracted`, `watchdog:matched`, `debate:verdict`, `coach:insight` |
| **Letter** | Gemini Pro | Auto-draft servicer letters | `letter:generated` | `watchdog:matched` |
| **Call Script** | Gemini Pro | Generate call talking points | `call-script:generated` | `freedom:updated`, `letter:generated` |
| **Debate** | Gemini Pro | Hawk vs Dove 3-round debate + AI verdict | `debate:verdict` | User trigger |
| **Coach** | Gemini Flash | Financial coaching chat | `coach:insight` | `debate:verdict`, `freedom:updated` |
| **Future Self** | Gemini Flash | Chat with your debt-free future self | — | User trigger |
| **Orchestrator** | Gemini Flash | Quality evaluation + retry logic | — | Wraps all agents |
| **Agent Tester** | Gemini Flash | Autonomous test suite | — | Manual / API |

---

## Tech Stack

```
┌─────────────────────────────────────────────────┐
│  FRONTEND                                       │
│  Next.js 16 · App Router · Turbopack            │
│  Tailwind CSS · Framer Motion                   │
│  Mapbox GL (opportunity map)                    │
│  Three.js (isometric maze visualization)        │
├─────────────────────────────────────────────────┤
│  BACKEND                                        │
│  Express · TypeScript                           │
│  EventEmitter agent bus                         │
│  SSE streaming (7 endpoints)                    │
├─────────────────────────────────────────────────┤
│  AI                                             │
│  Gemini 3 Pro (reasoning, generation, vision)   │
│  Gemini 3 Flash (chat, quality evaluation)      │
│  Self-correcting orchestrator with retry        │
├─────────────────────────────────────────────────┤
│  DEPLOYMENT                                     │
│  Google Cloud Run · Cloud Build                 │
│  Multi-stage Docker (Alpine)                    │
│  PM2 process manager (3 services)               │
│  Node reverse proxy (SSE-compatible)            │
└─────────────────────────────────────────────────┘
```

---

## Folder Structure

```
slknight/
├── backend/
│   └── src/
│       ├── agents/
│       │   ├── agentBus.ts           # Event-driven agent communication bus
│       │   ├── agentTester.ts        # Autonomous test suite (Gemini-evaluated)
│       │   ├── orchestrator.ts       # Quality eval, retry, performance tracking
│       │   ├── freedomAgent.ts       # Debt-free path generation
│       │   ├── watchdogAgent.ts      # Grant/opportunity matching (35 entries)
│       │   ├── coachAgent.ts         # Financial coaching chat
│       │   ├── simulatorAgent.ts     # Scenario generation
│       │   └── auditorAgent.ts       # Vision document extraction
│       ├── controllers/
│       │   ├── simulatorController.ts    # SSE endpoints: freedom-path, letter, debate, vision
│       │   └── orchestratorController.ts # Health, feed, checklist, test APIs
│       ├── config/
│       │   └── gemini.ts             # Gemini 3 model configuration
│       ├── middleware/
│       │   └── demoMode.ts           # Demo user injection
│       ├── seed/
│       │   └── demoUser.json         # Pre-seeded Jane Doe profile
│       └── server.ts                 # Express entry point
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # Main page: GameCard + AgentActivityFeed
│       │   ├── freedom/page.tsx      # Freedom path detail view
│       │   └── mobile-upload/        # QR-based mobile document upload
│       └── components/
│           ├── feed/
│           │   ├── AgentActivityFeed.tsx  # Live agent chain visualization
│           │   └── AgentEventCard.tsx     # Individual agent event card
│           ├── freedom/
│           │   ├── FutureSelfChat.tsx     # Future self chat + opportunity map
│           │   ├── HawkDoveDebate.tsx     # 3-round debate with AI verdict
│           │   ├── LetterWriter.tsx       # Auto-generated servicer letters
│           │   └── CallSimulator.tsx      # Call talking points
│           ├── maze/
│           │   ├── GameCard.tsx           # Main interaction card (4 states)
│           │   ├── IsometricMaze.tsx      # 3D maze visualization
│           │   └── Tile.tsx              # Individual maze tile
│           └── orchestrator/
│               └── OrchestratorPanel.tsx  # Agent health + checklist dashboard
├── proxy.js                  # Reverse proxy for Cloud Run SSE streaming
├── ecosystem.config.js       # PM2 config (proxy + backend + frontend)
├── Dockerfile                # Multi-stage build (frontend + backend + proxy)
├── cloudbuild.yaml           # Google Cloud Build pipeline
└── deploy.sh                 # One-command Cloud Run deployment
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Google AI Studio API key (with Gemini 3 access)
- Mapbox token (optional, for opportunity map)

### Environment Variables

```bash
# backend/.env
GOOGLE_AI_API_KEY=your-gemini-api-key
DEMO_MODE_ENABLED=true

# frontend/.env.local
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
```

### Run Locally

```bash
# Terminal 1: Backend
cd backend && npm install && npm run dev

# Terminal 2: Frontend
cd frontend && npm install && npm run dev
```

Open http://localhost:3000 — the Next.js rewrite proxies `/api/*` to the backend.

### Deploy to Cloud Run

```bash
export GEMINI_API_KEY=your-key
export MAPBOX_TOKEN=your-token   # optional
chmod +x deploy.sh && ./deploy.sh
```

Builds via Cloud Build, deploys to Cloud Run. One command.

---

## The Demo Story

```
1. Page loads ──▶ Demo user "Jane Doe" auto-loaded
                  $34,200 student debt @ 6.8%, Nelnet servicer

2. Generate Path ──▶ Gemini streams a narrative hook
                     Freedom path calculated: debt-free by 2034

3. Agent chain fires:
   Vision ──▶ Watchdog finds 4 grants worth $41,500
          ──▶ Freedom recalculates: 2034 → 2029 (5 years sooner!)
          ──▶ Letter auto-drafted for Nelnet IDR enrollment
          ──▶ Call script ready with talking points

4. Debate ──▶ "Should you refinance?"
              Hawk argues yes, Dove argues no
              AI VERDICT auto-decides the path

5. Orchestrator ──▶ All 10 agents healthy
                    Quality scores, latency, retry logs visible
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/simulator/freedom-path` | SSE: narrative stream + freedom path |
| `POST` | `/api/simulator/future-self` | SSE: future self chat |
| `POST` | `/api/simulator/generate-letter` | SSE: auto-draft servicer letter |
| `POST` | `/api/simulator/vision-extract` | SSE: vision + watchdog + freedom chain |
| `POST` | `/api/simulator/debate` | SSE: hawk vs dove debate |
| `GET` | `/api/orchestrator/health` | Agent health + system stats |
| `GET` | `/api/orchestrator/feed` | SSE: live agent event stream |
| `POST` | `/api/orchestrator/checklist` | Create borrower action checklist |
| `POST` | `/api/orchestrator/test` | SSE: run autonomous agent tests |

---

## License

MIT License — Built for Gemini 3 Global Hackathon 2026
