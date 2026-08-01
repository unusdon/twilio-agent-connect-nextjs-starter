# Changelog

All notable changes to **twilio-agent-connect-nextjs-starter** are documented here.
Follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-08-01

Initial release.

### Added

- **Two-service monorepo** — `apps/agent` (Node service on Fastify via `TACServer`) and `apps/dashboard` (Next.js 15 + Tailwind), sharing types via npm workspaces.
- **Claude LLM adapter** — a single-file Anthropic SDK adapter with prompt caching on the system prompt. Swap the file to swap providers.
- **Three channels wired** — SMS, WhatsApp, Chat via TAC 2.0's channel classes. Voice deferred to v1.1.
- **Memory-recall observability** — every turn's `MemoryPromptBuilder.compose()` result is captured; retrieved observations and scores are logged verbatim to a JSONL event sink.
- **Event schema** — six event types (`message.received`, `memory.recalled`, `llm.completed`, `tool.called`, `message.sent`, `rule.fired`) shared between agent and dashboard as first-class TypeScript types.
- **Dashboard** — conversation list + per-conversation timeline detail. Colour-coded event badges and full inspection of Recall observations, LLM usage/latency, and tool inputs.
- **Demo mode** — dashboard renders canned fixture traces when `DASHBOARD_MODE=demo`, so evaluators see the observability UI immediately with no Twilio setup.
- **Human handoff** — built-in escalation tool via Twilio Studio Flows using the SDK-native `createStudioHandoffTool`.
- **`setup:check`** — a validation script that confirms `.env` values authenticate against Twilio + Anthropic before you try to run the agent.
- **README structured as Ep 1 → Ep 2 → Ep 3** to mirror Twilio's own developer walkthrough.
- **MIT license** to match the underlying TAC SDK and remove licence-compatibility friction for downstream projects.
