<div align="center">

# Twilio Agent Connect — Multi-LLM Agentic Starter

**A production-ready TypeScript starter that turns Twilio Agent Connect into a real agentic runtime — multi-turn tool loops, five interchangeable LLM providers, and a Next.js observability dashboard that traces every cycle.**

[![Stars](https://img.shields.io/github/stars/unusdon/twilio-agent-connect-nextjs-starter?style=social)](https://github.com/unusdon/twilio-agent-connect-nextjs-starter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-22.13%2B-339933)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Tests](https://img.shields.io/badge/tests-23%20passing-brightgreen)](#testing)

**Anthropic Claude · OpenAI GPT · Google Gemini · Ollama · LM Studio** &nbsp;·&nbsp; Voice + SMS + WhatsApp + Chat

### ⭐ If this saves you time, **star the repo** — it genuinely helps.

</div>

---

## Why this exists

Twilio ships an official Agent Connect SDK. It's excellent but **low-level**: you get a `TACServer`, callbacks, and adapter classes — you assemble the rest. Every serious agent app then re-solves the same problems: multi-turn tool loops with result feedback, provider swapping, timeout enforcement, per-conversation history, and observability into what actually happened inside every turn.

This starter solves those problems once, opinionatedly, and hands you a working monorepo:

- A **truly agentic runtime** — LLM → tool → tool_result → LLM cascade with cycle cap, parallel tool execution, structured error feedback, and terminal-tool handling
- A **pluggable tool registry** — `handoff` / `search_knowledge_base` / `retrieve_profile_memory` built in, plus a documented extension point for your custom tools
- A **provider-neutral LLM interface** — swap between Anthropic, OpenAI, Gemini, and two local options (Ollama, LM Studio) with a single env var
- A **live Next.js observability dashboard** — timeline traces with per-cycle chain indent, dedicated event styles for calls, interrupts, tool cycles, and rule fires
- A **demo mode** — dashboard renders four canned fixture conversations (chat, handoff, voice arc, agentic multi-tool) so evaluators see the UI immediately with **zero Twilio setup**

## Architecture at a glance

```
       Twilio channels
   (voice · sms · whatsapp · chat)
              │
              ▼
     ┌──────────────────────┐
     │  TACServer (Fastify) │  ← +/rule-webhook for Intelligence rules
     └──────────┬───────────┘
                │  onMessageReady({ message, memory, session, channel })
                ▼
     ┌──────────────────────┐
     │   handleMessage()    │  ← testable orchestration, DI-friendly
     └──────────┬───────────┘
                │
     ┌──────────┴────────────────────────────────────┐
     │                                                │
     ▼                                                ▼
 Memory Recall                        Multi-tool loop (≤ maxCycles)
 (via TAC SDK)                         │
                                       │  ┌──────────────┐
                                       ├─→│ LlmAdapter   │  (one of 5)
                                       │  └──────────────┘
                                       │  ┌──────────────┐
                                       └─→│ RegisteredTool│  (parallel batch OK)
                                          └──────────────┘
                │
                ▼
     ┌──────────────────────┐
     │   Event Sink (JSONL) │  ← 10 event types with cycleDepth chaining
     └──────────┬───────────┘
                │
                ▼
     ┌──────────────────────┐
     │   Next.js Dashboard  │  ← http://localhost:3000
     │   /  /config  /conversations/[id]
     └──────────────────────┘
```

## Quick start (60 seconds, no Twilio account needed)

```bash
git clone https://github.com/unusdon/twilio-agent-connect-nextjs-starter
cd twilio-agent-connect-nextjs-starter
npm install
npm --workspace @tac-starter/dashboard run dev
```

Open **http://localhost:3000** — you'll see four fixture conversations covering every event type. This is `demo` mode (`DASHBOARD_MODE=demo` is the default when there's no `.env`).

To run the actual agent, add credentials and use `npm run dev` — details in [Requirements](#requirements) + [Configuration](#configuration).

## Features

- **Config-first** — one typed `packages/shared/src/config.ts` re-skins the whole starter (persona, channels, loop knobs, sink)
- **Two-service monorepo** — `apps/agent` (Node service on Fastify via `TACServer`) + `apps/dashboard` (Next.js 15 + Tailwind), sharing types via npm workspaces
- **True agentic runtime** — multi-turn tool loop with configurable cycle cap (default 8), parallel tool execution, structured `{error}` feedback on tool failure, terminal-tool short-circuit
- **Five LLM providers, one interface** — Anthropic Claude (with prompt caching), OpenAI GPT, Google Gemini, plus **two local options** (Ollama, LM Studio). Swap via `LLM_PROVIDER` in `.env`, no code change.
- **Four channels** — SMS, WhatsApp, Chat, and Voice (via ConversationRelay WebSocket)
- **Voice call-lifecycle events** — `call.started` / `call.ended` / `interrupt.detected` wired via `tac.onInterrupt` + `tac.onConversationEnded`
- **Built-in tools** — `handoff` (Studio Flows), `search_knowledge_base` (TAC RAG), `retrieve_profile_memory` (on-demand memory). All opt-in via env vars. Extension point in `apps/agent/src/tools.ts` with a worked `lookup_order` example.
- **Intelligence-rule webhook** — `/rule-webhook` on the agent captures Conversation Intelligence rule fires as first-class timeline events
- **Production hygiene** — per-turn timeout with configurable fallback text, conversation-history rolling cap, DI-friendly `HistoryStore` interface for Redis-backing later
- **Rich observability dashboard** — conversation list with derived customer names + turn counts + token totals, per-conversation timeline with 10 event types, per-cycle chain indent, active-provider badge on every page, agent-tools + provider matrices on `/config`
- **Demo mode** — dashboard runs on canned fixtures showing a simple chat, a terminal handoff, a full voice call arc with interrupt, and a 3-cycle agentic multi-tool loop
- **`setup:check`** — provider-aware validation script that pings Twilio + your chosen LLM before you try to run the agent

## LLM providers

| Provider | Adapter file | Notes |
|---|---|---|
| **Anthropic** (Claude) | `anthropic-adapter.ts` | Prompt caching on the system prompt — repeat turns cost a fraction |
| **OpenAI** (GPT) | `openai-compatible-adapter.ts` | Standard `chat.completions` shape, function-call tool schema |
| **Google Gemini** | `openai-compatible-adapter.ts` | Uses Gemini's OpenAI-compatible endpoint — no extra SDK |
| **Ollama** (local) | `openai-compatible-adapter.ts` | Point at `http://localhost:11434/v1`. Zero LLM spend, offline capable. |
| **LM Studio** (local) | `openai-compatible-adapter.ts` | Enable "OpenAI-compatible server" in LM Studio settings |

Set `LLM_PROVIDER=anthropic|openai|gemini|ollama|lmstudio` in `.env` and fill in that provider's key (or leave defaults for the local ones). Only the block for your chosen provider needs values. All five expose the same `LlmAdapter` interface, so `apps/agent/src/handle-message.ts` never branches on provider.

## Agentic runtime

Every incoming customer message runs through a **multi-turn tool loop** in [`apps/agent/src/handle-message.ts`](apps/agent/src/handle-message.ts):

1. Emit `message.received` + `memory.recalled` observability events
2. Build system prompt via `MemoryPromptBuilder.compose(...)`
3. Assemble the tool registry (`buildToolRegistry` in `tools.ts`)
4. Enter the loop, up to `config.agent.loop.maxCycles` iterations:
   - Call the LLM adapter with the running `ConvItem[]` conversation
   - If the LLM returns plain text → break, that's the response
   - If the LLM returns tool calls → execute them (in parallel if multiple) → emit `tool.called` + `tool.result` events → feed results back → next cycle
5. If the loop exits without text → send the configured `cycleCapFallback`
6. If the whole turn exceeds `turnTimeoutMs` → send the configured `timeoutFallback`

**Built-in tools** (all opt-in via env vars):

| Tool | Gate | What it does |
|---|---|---|
| `handoff` | `TWILIO_STUDIO_HANDOFF_FLOW_SID` | Escalates the conversation to a human via a Twilio Studio Flow. **Terminal** — loop ends after it fires. |
| `search_knowledge_base` | `TAC_KNOWLEDGE_BASE_ID` | RAG search over a TAC Knowledge Base. Auto-populated `name`/`description` from the KB metadata. |
| `retrieve_profile_memory` | `TAC_ENABLE_MEMORY_RETRIEVAL_TOOL=1` | On-demand memory lookup — for deeper queries beyond the initial per-turn Recall. |

### Parallel tool calls

Modern LLMs (Claude, GPT-4o/5, Gemini) will happily emit **multiple `tool_use` blocks in a single response** when they need to gather information in parallel. Both adapters return every tool call; the loop executes them concurrently via `Promise.all` and batches all `tool_result`s back into the next LLM turn.

Example: for a customer asking *"what's my order status and what's your return policy?"*, Claude will emit both `lookup_order` and `search_knowledge_base` in one turn — both execute concurrently, both results feed back, then Claude produces the final answer.

### Terminal tools

When the LLM emits a batch containing a terminal tool (like `handoff`), the loop executes **only** that tool and stops — co-occurring non-terminal calls are skipped. Prevents surprises like handing off and executing a side-effect in the same turn.

### Error feedback

Tools that return `{outcome: "failed", error: "..."}` (or throw) don't crash the loop — the failure is serialised as `{error, tool}` JSON and fed back as the `tool_result`. The LLM sees the error, can apologise to the customer, try a different tool, or retry with different inputs. This is what makes it *truly agentic* — the LLM adapts to reality instead of assuming success.

<a id="custom-tools"></a>

### Adding a custom tool

Full worked example in [`apps/agent/src/tools.example.ts`](apps/agent/src/tools.example.ts). To wire it up, add one line to `buildToolRegistry()` in [`apps/agent/src/tools.ts`](apps/agent/src/tools.ts):

```ts
import { lookupOrderTool } from "./tools.example.js";

export async function buildToolRegistry(tac, session, config) {
  const registry: Record<string, RegisteredTool> = {};
  // ... existing built-ins ...
  const tool = lookupOrderTool(myOrderRepo);
  registry[tool.schema.name] = tool;
  return registry;
}
```

That's it. The LLM sees `lookup_order` in its tool list on the next turn, `execute` runs when it calls the tool, and the dashboard renders `tool.called` + `tool.result` events with the correct cycle depth — no other code touched.

## Voice — first-class channel

`VoiceChannel` is registered end-to-end. The agent additionally wires:

- **`tac.onInterrupt(...)`** → emits `interrupt.detected` events with `utteranceUntilInterrupt` + `durationUntilInterruptMs` — invaluable for spotting bad response length, poor TTS pacing, or intent misreads
- **`tac.onConversationEnded(...)`** → emits `call.ended` with total duration + reason
- **Synthesised `call.started`** — the first `message.received` on a voice conversation triggers this so the timeline reads as a proper call arc

Terminal `handoff` on voice doesn't send a text farewell — Studio takes over the audio path.

*Roadmap: full transcript metadata (ASR confidence, spoken duration) and TTS metadata (voice profile, synthesis latency) via `VoiceChannelEvents` listener — planned for v1.2.*

## Observability

Ten event types stream to a JSONL sink (or an in-memory ring, or none):

| Type | When | Notable fields |
|---|---|---|
| `message.received` | Inbound customer turn | `from`, `message` |
| `memory.recalled` | After `MemoryPromptBuilder.compose()` runs | `query`, `observations[]`, `observationCount` |
| `llm.completed` | Each LLM turn in the loop | `model`, `response`, `invokedTool`, `usage.{input,output,cache_read}Tokens`, `latencyMs`, `cycleDepth` |
| `tool.called` | LLM invoked a tool | `toolCallId`, `tool`, `input`, `outcome`, `latencyMs`, `cycleDepth` |
| `tool.result` | Tool executed, result fed to next LLM turn | `toolCallId`, `tool`, `result`, `cycleDepth` |
| `message.sent` | Outbound response posted to the channel | `message` |
| `rule.fired` | Intelligence-rule webhook triggered | `ruleName`, `payload` |
| `call.started` | Voice: first turn of a call | `callSid`, `from`, `to` |
| `call.ended` | Voice: call closed | `durationMs`, `reason` |
| `interrupt.detected` | Voice: customer talked over assistant | `utteranceUntilInterrupt`, `durationUntilInterruptMs` |

Every event carries `conversationId`, `channel`, and `timestamp`. Chain events additionally carry `cycleDepth` so the dashboard can indent them under the parent customer message.

The **dashboard** (Next.js 15 + Tailwind) reads the same sink and renders:

- **`/`** — conversation cards with derived customer name (extracted from Memory observations), channel icon, latest message, turn count, total tokens, cache-hit ratio, status pill
- **`/conversations/[id]`** — full timeline with 10 colour-coded event types, per-cycle chain indent, latency waterfall bars on LLM turns
- **`/config`** — active provider callout, **provider matrix** (all 5 with active/ready/not-set-up status), **agent tools matrix** (enabled/off per built-in), env-var status table
- **Provider badge in header** on every page — click to jump to `/config`
- **Light + dark theme** with `data-theme` toggle, no flash-of-wrong-theme on first paint

## Requirements

- **Node.js 22.13+** (TAC SDK requirement) and npm 9+
- A **Twilio account with Agent Connect enabled** to run against live channels (Memory Store SID + Conversation Configuration SID — provisioned via Twilio Console or the [Python setup wizard](https://github.com/twilio/twilio-agent-connect-python/tree/main/getting_started/twilio_setup))
- An API key for your chosen LLM provider (Anthropic / OpenAI / Google), **or** a local model running under Ollama / LM Studio (no key needed)
- A public HTTPS tunnel (e.g. `ngrok`) so Twilio's webhooks can reach your local agent

## Run it

```bash
npm install
cp .env.example .env               # fill in real values
npm run setup:check                # validates credentials
npm run dev                        # agent on :3001, dashboard on :3000
```

`npm run setup:check` is provider-aware — it pings Twilio + your chosen LLM endpoint with a minimum-token probe (no meaningful cost) and refuses to green-light until both authenticate.

**No Twilio account yet?** The dashboard still works on its own — leave `DASHBOARD_MODE=demo` (the default) and run `npm --workspace @tac-starter/dashboard run dev` alone.

<a id="configuration"></a>

## Configuration

All runtime knobs live in [`packages/shared/src/config.ts`](packages/shared/src/config.ts) — one typed file. Override values per deployment in [`apps/agent/src/config.ts`](apps/agent/src/config.ts) or via `.env` (see [`.env.example`](.env.example)).

Notable sections:

- **`agent.name`** / **`agent.systemInstructions`** — persona
- **`agent.channels`** — which channels to register (voice/sms/whatsapp/chat)
- **`agent.handoff`** — human-handoff enable + Studio Flow SID env var name
- **`agent.loop.maxCycles`** — tool-loop cap per customer message (default 8)
- **`agent.loop.turnTimeoutMs`** — total ms budget per customer message (default 45000)
- **`agent.loop.maxHistoryTurns`** — history pairs kept in memory per conversation (default 20)
- **`agent.loop.{handoffFarewell,cycleCapFallback,timeoutFallback}`** — text sent on each of the exit conditions
- **`llm.provider`** — default provider (overridden by `LLM_PROVIDER` env)
- **`llm.{maxTokens,temperature}`** — sampling settings
- **`observability.sink`** — `"file"` | `"memory"` | `"none"`

## Deploying

- **Agent service** → a long-running Node host: Fly.io, Railway, Render, or a VM. **Not serverless-friendly** — TAC needs a persistent process with in-memory conversation state (or Redis-backed if you scale to multiple instances)
- **Dashboard** → Vercel or the same host as the agent, depending on whether it should tail the agent's local event log or read from a shared store

Full deployment recipes in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

<a id="testing"></a>

## Testing

**23 tests across 4 files, all passing:**

- `handle-message.test.ts` — 9 end-to-end loop tests: short-circuit text, single-tool round-trip, parallel-batch execution, failed-tool `{error}` feedback, terminal-in-batch short-circuit, cycle-cap fallback, history-cap rolling window, turn timeout, unknown-tool graceful failure
- `anthropic-adapter.test.ts` — 4 tests: text mapping, parallel `toolCalls[]` extraction, full-conversation translation to Anthropic message shape, tools-array omission
- `openai-compatible-adapter.test.ts` — 6 tests: text mapping, parallel `tool_calls[]` extraction, conversation translation to OpenAI role sequence, malformed-JSON tool arguments, tools-array omission, `id` labelling
- `event-sink.test.ts` — 4 tests: JSONL append, `AGENT_EVENT_LOG` env override, memory sink, null sink

Run with `npm test`. CI runs `typecheck + build + test` on every push (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Documentation

- [`docs/MEMORY.md`](docs/MEMORY.md) — Conversation Memory + Orchestrator setup, provisioning walkthrough, optional retrieval tool
- [`docs/AGENT.md`](docs/AGENT.md) — Agent architecture, tool loop, channels, LLM adapter swap, custom tools, multi-instance
- [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md) — Event schema (10 types), dashboard modes, rule-webhook wiring, debugging with the trace
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Production deployment recipes
- [`CHANGELOG.md`](CHANGELOG.md) — Version history

## Roadmap

**Shipped in v1.0** — SMS/WhatsApp/Chat channels, Claude adapter with prompt caching, Memory Recall + observability, Studio-Flows handoff, dashboard (conversation list + timeline), demo mode.

**Shipped in v1.1 (this release)** — Voice channel with interrupt + call-lifecycle events, multi-LLM support (OpenAI / Gemini / Ollama / LM Studio), tool registry with 3 built-ins + custom extension point, multi-turn agentic loop with parallel tool calls, structured error feedback, turn timeout + history cap, testable `handleMessage()` extraction with 9 orchestration tests, `/config` provider + tool matrices, provider badge on every page.

**Planned for v1.2**:
- Voice transcript/TTS metadata via `VoiceChannelEvents` listener
- Streaming LLM responses (for voice TTFA)
- Per-conversation mutex for multi-instance safety
- Rule-config UI in the dashboard
- Outbound conversation initiation
- Redis-backed `HistoryStore` reference implementation
- Native TypeScript setup wizard (kill the Python detour)
- First-class Dockerfile

## Contributing

Issues + PRs welcome. Please run `npm run typecheck && npm run build && npm test` before opening a PR — CI enforces all three. Keep tests in the workspace that owns the code; adapter tests live under `apps/agent/src/`.

## License

MIT — see [`LICENSE`](LICENSE). Chosen to match the underlying TAC SDK (`twilio-agent-connect`) so combining the two is unambiguous for downstream projects.

## Related

- **[nova-store-telegram-mini-app](https://github.com/unusdon/nova-store-telegram-mini-app)** — Telegram Mini App eCommerce UI kit (vanilla HTML/CSS/JS)
- **[nova-store-telegram-mini-app-nextjs](https://github.com/unusdon/nova-store-telegram-mini-app-nextjs)** — the Next.js edition of the above
- **[ai-chatbot-saas](https://github.com/unusdon/ai-chatbot-saas)** — self-hosted RAG chatbot SaaS

---

<div align="center">
<sub>Built by <b><a href="https://github.com/unusdon">unusdon</a></b> — senior software engineer, 21+ years shipping web, mobile, AI &amp; cloud.<br>If it helped, leave a ⭐ · Filing issues + PRs is the best thank-you.</sub>
</div>
