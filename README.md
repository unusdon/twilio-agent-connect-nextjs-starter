<div align="center">

# Twilio Agent Connect — Claude · Next.js Starter

**A TypeScript-first Twilio Agent Connect starter with a Claude LLM backbone, memory-recall observability, and a live Next.js dashboard for tracing every turn.**

[![Stars](https://img.shields.io/github/stars/unusdon/twilio-agent-connect-nextjs-starter?style=social)](https://github.com/unusdon/twilio-agent-connect-nextjs-starter)
&nbsp;·&nbsp; TAC 2.0 &nbsp;·&nbsp; Anthropic Claude &nbsp;·&nbsp; Next.js 15 &nbsp;·&nbsp; MIT

### ⭐ If this saves you time, **star the repo** — it genuinely helps.

</div>

---

## What this is

A production-shaped **starter** for building AI agents on Twilio's Agent Connect platform, wired specifically for **Anthropic Claude** as the LLM backbone and shipping with a **Next.js observability dashboard** that traces every conversation turn end-to-end.

The starter mirrors the shape of Twilio's own 3-episode developer walkthrough:

- **Ep 1 — Contextual Omnichannel Conversations.** Wire up Conversation Memory and Conversation Orchestrator so a single customer profile survives across SMS, WhatsApp, and Chat. Each LLM turn calls the Recall API and the retrieved observations are logged verbatim so operators can see what the model actually saw.
- **Ep 2 — Multichannel AI Agents with TAC.** A minimal, opinionated agent service built on `twilio-agent-connect@2` with Claude as the reasoning model. Human handoff via Twilio Studio Flows built in. Adapter is a single file — swap it to swap providers.
- **Ep 3 — Real-time Intelligence and Observability.** A Next.js dashboard renders every event: inbound message, memory recall (with scores + observations), LLM turn (with token usage + cache reads + latency), tool calls, intelligence rule fires, and outbound response. Runs in **demo mode with canned fixtures** out of the box — no Twilio account needed to evaluate.

## Features

- **Config-first** — one typed `packages/shared/src/config.ts` re-skins the whole starter
- **Two-service monorepo** — `apps/agent` (long-running Node service on Fastify via `TACServer`) + `apps/dashboard` (Next.js 15 + Tailwind), sharing types via npm workspaces
- **Claude backbone** — Anthropic SDK direct, prompt caching on the system prompt so repeated turns are cheap
- **Three channels wired** — SMS, WhatsApp, Chat (Voice comes in v1.1 with ConversationRelay)
- **Memory recall observability** — the retrieved observations, scores, and query for every turn logged to a JSONL sink the dashboard tails
- **Human handoff** — built-in escalation tool via Twilio Studio Flows (SDK-native)
- **Demo mode** — dashboard runs on canned fixtures so evaluators see the observability UI immediately with zero Twilio setup
- **`setup:check`** — a validation script that confirms your `.env` credentials are live before you try to run the agent

## Requirements

- **Node.js 22.13+** (TAC SDK requirement) and npm 9+
- A **Twilio account with Agent Connect enabled** to run against live channels (Memory Store SID + Conversation Configuration SID — provisioned via Twilio Console or the [Python setup wizard](https://github.com/twilio/twilio-agent-connect-python/tree/main/getting_started/twilio_setup))
- An **Anthropic API key** for the LLM
- A public HTTPS tunnel (e.g. `ngrok`) so Twilio's webhooks can reach your local agent

## Run it

```bash
npm install
cp .env.example .env               # fill in real values
npm run setup:check                # validates credentials
npm run dev                        # agent on :3001, dashboard on :3000
```

**No Twilio account yet?** The dashboard still works — set `DASHBOARD_MODE=demo` in `.env` (that's the default) and it renders canned fixture traces. Start the dashboard alone with `npm run dev:dashboard`.

## Deploying

- **Agent service** → a long-running Node host: Fly.io, Railway, Render, or a VM. **Not serverless-friendly** — TAC needs a persistent process with in-memory conversation state (or Redis-backed if you scale to multiple instances).
- **Dashboard** → Vercel or the same host as the agent, depending on whether it should tail the agent's local event log or read from a shared store.

Full deployment recipes in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Documentation

- [`docs/EP1_MEMORY.md`](docs/EP1_MEMORY.md) — Conversation Memory + Orchestrator setup, provisioning walkthrough
- [`docs/EP2_AGENT.md`](docs/EP2_AGENT.md) — TAC agent build, channel wiring, human handoff, LLM adapter architecture
- [`docs/EP3_OBSERVABILITY.md`](docs/EP3_OBSERVABILITY.md) — Event schema, dashboard modes, rule/webhook wiring
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Production deployment recipes
- [`CHANGELOG.md`](CHANGELOG.md) — Version history

## Roadmap

Shipped in **v1.0**:
- SMS, WhatsApp, Chat channels
- Claude adapter with prompt caching
- Memory Recall integration + observability
- Human handoff via Studio Flows
- Dashboard: conversation list + timeline detail
- Demo mode + fixtures

Planned for **v1.1**:
- Voice channel via ConversationRelay
- Knowledge base / RAG integration using TAC's built-in `KnowledgeClient`
- Intelligence rules configuration UI in the dashboard
- Outbound conversation initiation
- Native TypeScript setup wizard (kill the Python detour)

## License

MIT — see [`LICENSE`](LICENSE). Chosen to match the underlying TAC SDK so combining the two is unambiguous.

## Related

- **[nova-store-telegram-mini-app](https://github.com/unusdon/nova-store-telegram-mini-app)** — Telegram Mini App eCommerce UI kit (vanilla)
- **[nova-store-telegram-mini-app-nextjs](https://github.com/unusdon/nova-store-telegram-mini-app-nextjs)** — the Next.js edition
- **[ai-chatbot-saas](https://github.com/unusdon/ai-chatbot-saas)** — self-hosted RAG chatbot SaaS

---

<div align="center">
<sub>Built by <b><a href="https://github.com/unusdon">unusdon</a></b> — senior software engineer, 21+ years shipping web, mobile, AI &amp; cloud. &nbsp;·&nbsp; If it helped, leave a ⭐.</sub>
</div>
