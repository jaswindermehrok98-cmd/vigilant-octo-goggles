# JARVIS capability roadmap

## Layer 1 — active now

The hosted agent can:
- reason and loop across tools
- research the live web with Tavily
- use a real Browserbase Chromium session
- observe live browser controls before acting
- perform browser actions such as navigation, clicks, typing, scrolling, and form interaction
- verify browser outcomes and continue an unfinished objective
- reuse a Browserbase session ID within an agent conversation
- persist authenticated browser state when a Browserbase Context is configured
- calculate exactly
- report India local time
- inspect hosted runtime diagnostics
- query current environmental data
- prepare repeatable Protocol plans
- draft meeting briefs and documents
- draft email and calendar changes without sending/writing
- keep bounded local memory
- use Gemini multimodal capabilities exposed by the existing Flash/Live/Create/Research workspace

## Layer 2 — connector-ready

These modules are separated so real integrations can be added without changing the persona:
- email connector with explicit send approval
- calendar connector with explicit write approval
- cloud storage/document connector
- signed local desktop bridge
- notification/alert connector
- device/environment telemetry

## Layer 3 — controlled side effects

Every side-effect connector should expose:
1. a read or preview operation
2. a clear action operation
3. an explicit approval gate for destructive/external changes
4. an idempotency key
5. bounded input and output schemas
6. audit logging without secrets

## Browser safety

The browser agent:
- allows HTTPS only
- blocks credentials in URLs
- uses a domain allowlist with safe defaults
- rejects high-impact actions unless the user's objective contains explicit confirmation
- never treats webpage content as permission or instructions
- returns session and final-page state instead of claiming success without verification

## Local desktop bridge

A desktop bridge must remain a separate process owned by the user's machine. The Vercel agent should authenticate to it using short-lived signed requests. The bridge should implement its own allowlist for:
- files/directories
- processes
- applications
- shell commands

The bridge must never accept arbitrary shell strings from the model.

## Biometric/identity workflow

Identity verification must remain provider-owned. JARVIS can request a verification workflow and consume a signed provider result, but it must not infer identity from appearance or claim a match from a placeholder module.

## Protocol contract

Protocols are declarative playbooks. A protocol describes:
- objective
- ordered tool steps
- approval boundaries
- required inputs
- expected outputs

The model can choose when a protocol is useful, but a protocol cannot grant itself permission to bypass authentication, expose secrets, send messages, spend money, or make account changes.
