# BlueWings Conversational Booking & Servicing

A WhatsApp-styled Progressive Web App chat assistant that lets BlueWings Airlines passengers check flight status, check in and pick a seat, add baggage, and cancel a booking (with a simulated refund) — without calling the contact centre. Built for the **22North Product Engineering Challenge 2026 — Challenge 2**.

## Team

- **Team Name:** `TeamAlpha`
- **Team Members:** `Sharma Anandkumar`
- **College Name:** `Sardar Patel College of Engineering & Technology`

## Demo credentials (quick reference)

No login/password — authenticate in chat with **PNR + last name**. Try `BW7X9K` / `Sharma`. Full table with all three demo bookings and notes on what each is good for demoing is in §"Try it — demo data" below, and in `docs/BlueWings-API-Documentation.docx` §5.

## What's in this repo
    
```
bluewings/
├── server/          Express API — conversational engine + mock booking backend
│   ├── data/         In-memory mock PSS data (flights, bookings, sessions)
│   ├── services/      bookingService, intentEngine, dialogueManager
│   └── index.js       API routes + serves the built client
├── client/          React (Vite) chat PWA
│   └── src/
│       ├── components/  Ticket-stub widgets (flight status, boarding pass, seat map)
│       ├── App.jsx        Chat UI
│       └── App.css        Design system / styles
└── docs/            Architecture diagram, customer journey diagram,
                     solution document, presentation deck
```

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, plain CSS (custom design system), Lucide icons |
| Backend | Node.js, Express |
| Conversational engine | Custom rule-based intent classifier + dialogue state machine (no external NLU dependency, by design — see Solution Document §8) |
| Data | In-memory mock "PSS" data store (swappable for real airline APIs) |
| PWA | Web app manifest + service worker (installable, app-shell caching) |

No database, no external API keys, and no paid services are required to run this project.

## Build & run instructions

Requires **Node.js 18+** and **npm**.

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Build the client

```bash
cd client
npm run build
```

This produces `client/dist`, which the server serves as static files.

### 3. Start the server

```bash
cd ../server
npm start
```

The app is now running at **http://localhost:4000** — this single URL serves both the chat PWA and the API.

### Running the client in dev mode (optional, for frontend development)

```bash
cd client
npm run dev
```

This starts Vite's dev server (typically http://localhost:5173) with hot reload. Set `VITE_API_BASE=http://localhost:4000` in a `.env` file in `client/` if you run the client and server on different ports, since the dev server does not proxy `/api` by default.

## Try it — demo data

The mock backend ships with three demo bookings:

| PNR | Last name | Route | Notes |
|---|---|---|---|
| `BW7X9K` | `Sharma` | Mumbai → Dubai | 2 passengers, not checked in — good for the check-in/seat-selection demo |
| `BW4M2P` | `Khan` | Delhi → London | 1 passenger, flight is delayed — good for the flight-status demo |
| `BW9Q1Z` | `Iyer` | Bengaluru → Singapore | 2 passengers (1 adult, 1 child) |

Send a message like `BW7X9K Sharma` to authenticate, then use the quick-reply buttons (or type "status", "check in", "baggage", "cancel", "agent") to explore each journey.

**Note:** booking data resets whenever the server restarts, since it's held in memory (see Solution Document §8, Key Assumptions).

## Deliverables in this submission

- **Working MVP** — this repository
- **Customer Journey** — `docs/customer-journey.svg` / `.png`, and Section 6 of the Solution Document
- **Architecture Diagram** — `docs/architecture-diagram.svg` / `.png`, and Section 5 of the Solution Document
- **Database Design** — `docs/BlueWings-Database-Design.docx` (ER diagram + entity reference + production schema mapping)
- **API Documentation** — `docs/BlueWings-API-Documentation.docx` (every endpoint, request/response examples, demo credentials)
- **Key Assumptions** — Section 8 of the Solution Document
- **Solution Document** — `docs/BlueWings-Solution-Document.docx`
- **Presentation Deck** — `docs/BlueWings-Presentation.pptx` (10 slides)

## Known limitations (by design, for a 48-hour MVP)

- Payments and OTP delivery are simulated, not connected to a real gateway/CPaaS provider.
- WhatsApp is represented by a WhatsApp-styled PWA rather than a live WhatsApp Business API connection (which requires Meta business verification not obtainable in this timeframe). The conversational engine is channel-agnostic, so a real WhatsApp webhook can call the same `/api/chat` contract.
- Session and booking state are in-memory only; a restart resets demo data.

Full rationale for every assumption and trade-off is in `docs/BlueWings-Solution-Document.docx`.
