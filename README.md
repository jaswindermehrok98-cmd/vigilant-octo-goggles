# JARVIS v4

Private autonomous mission-control assistant built on Next.js and the Vercel AI SDK.

The repository now contains a normal source tree at the root. The previous v3 ZIP remains as an archive.

Capabilities:
- Gemini ToolLoopAgent orchestration
- Tavily live research
- Browserless rendered-page inspection with HTTPS, domain and DNS guards
- exact arithmetic and Asia/Kolkata time
- hosted runtime diagnostics
- current environmental data via fixed Open-Meteo endpoints
- declarative Protocols for repeatable multi-step routines
- meeting and document drafting
- email and calendar draft-only modules
- vision and identity-verification placeholders
- local-system bridge capability status
- bounded local memory
- optional ElevenLabs voice

Security:
- signed HttpOnly session cookie
- same-origin checks
- request-size limits
- in-process rate limits
- abort propagation
- no direct OS command execution
- web content treated as hostile data
- side-effecting integrations intentionally draft-only until explicit connectors and approval exist

Environment variables are documented in .env.example.

Development:
npm install
npm test
npm run dev
