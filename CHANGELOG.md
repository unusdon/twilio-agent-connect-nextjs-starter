# Changelog

All notable changes to **twilio-agent-connect-nextjs-starter** are documented here.
Follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [Unreleased] — v1.1 (agentic push)

### Added — production-hardening pass (P0 + P1)

- **Parallel tool-call execution.** `LlmResult.tool_use` now carries a `toolCalls[]` array — every tool the LLM invokes in a single response is executed concurrently via `Promise.all`, and their results batch back into the next LLM turn. Both adapters return every tool_use block (Anthropic) / tool_call (OpenAI-compat), not just the first. Previously the second and subsequent parallel calls were silently dropped.
- **Structured tool-error feedback.** When a tool returns `{outcome: "failed"}` (or throws), the loop feeds a JSON `{error, tool}` object back as the tool_result instead of literal `null` — the LLM can now reason about the failure and retry or apologise.
- **Per-turn timeout.** `config.agent.loop.turnTimeoutMs` (default 45s) caps the entire tool-loop wall-clock. On breach, the configured `timeoutFallback` text is sent back and a `message.sent` event emitted so the trace shows the timeout cleanly.
- **Conversation-history cap.** `config.agent.loop.maxHistoryTurns` (default 20 pairs) trims the in-memory history per conversation to prevent unbounded growth over long sessions.
- **Testable orchestration.** The multi-tool loop lives in `apps/agent/src/handle-message.ts` (extracted from `index.ts`) with a `HistoryStore` interface for Redis-backing later. Dependency-injected `LlmAdapter`, `EventSink`, tool registry, and a `now()` seam for freezing timestamps in tests.
- **9 new end-to-end loop tests** in `handle-message.test.ts` covering: short-circuit text, single-tool round-trip, parallel-batch execution, failed-tool `{error}` feedback, terminal-in-batch short-circuit, cycle-cap fallback, history cap rolling window, turn timeout, and unknown-tool graceful failure.
- **Custom-tool walkthrough.** `apps/agent/src/tools.example.ts` — full worked `lookup_order` example (schema + execute + validation + error handling). Referenced from a new README section.
- **Configurable loop text.** `handoffFarewell`, `cycleCapFallback`, `timeoutFallback` are now `config.agent.loop.*` fields, not hardcoded strings.

### Changed — production-hardening pass

- **`ConvItem` for assistant tool turns now uses `toolCalls: []`** (array), not a single `toolCall`. Reflects the parallel-tool reality. Anthropic translator batches multiple `tool_result` blocks into one `user` message per Anthropic's schema; OpenAI translator emits one `role:"tool"` message per result.
- **Removed voice `transcript` and `tts` metadata from the event schema.** SDK's `MessageReadyCallback` doesn't surface these — they were only ever populated in fixtures, which was deceptive. Roadmap: re-add via `VoiceChannelEvents` listener in v1.2.
- **`index.ts` is now thin wiring only** (~90 LOC, down from ~200). All orchestration is in `handle-message.ts`.

### Added — agentic runtime (earlier in v1.1)

**Agentic runtime**
- **Multi-turn tool loop** in `apps/agent/src/index.ts` — LLM emits tool_use → tool executes → result feeds back → LLM decides next step → repeat, up to 8 cycles per customer message. Handoff tools are terminal; all others chain.
- **Tool registry** at `apps/agent/src/tools.ts` — pluggable per-turn registry building. Built-ins: `handoff`, `search_knowledge_base`, `retrieve_profile_memory` (all opt-in via env vars). Documented extension point for custom tools with a commented `lookup_order` example.
- **Knowledge / RAG tool** wired via TAC's `createKnowledgeSearchToolAsync` — auto-populates name/description from KB metadata. Gate: `TAC_KNOWLEDGE_BASE_ID`.
- **On-demand memory retrieval tool** via `createMemoryRetrievalTool` — LLM can ask for extra memory context mid-turn. Gate: `TAC_ENABLE_MEMORY_RETRIEVAL_TOOL=1`.
- **Provider-neutral `ConvItem[]` conversation format** in `llm-types.ts` — user / assistant text / assistant tool_call / tool result. Each adapter translates to its SDK's shape (Anthropic `tool_use`/`tool_result` blocks; OpenAI `tool_calls`/`role: "tool"`).
- **`toolCallId` correlation** on `LlmResult.tool_use` — links to the tool_result item so the adapter can wire multi-turn chains cleanly.

**Voice as a first-class channel**
- **`VoiceChannel`** registered end-to-end (was deferred to v1.1 in v1.0 — now shipped).
- **`tac.onInterrupt`** callback registered — emits `interrupt.detected` events with `utteranceUntilInterrupt` + `durationUntilInterruptMs`.
- **`tac.onConversationEnded`** callback registered — emits `call.ended` events with duration + reason.
- **Synthesised `call.started` events** on first voice message per conversation.
- **Optional `voice.transcript`** metadata on `message.received` (ASR confidence, spoken duration).
- **Optional `voice.tts`** metadata on `message.sent` (voice profile, synthesis latency).

**Observability + dashboard**
- **New event types**: `tool.result`, `call.started`, `call.ended`, `interrupt.detected` — plus `cycleDepth` on chain events + `invokedTool` on `llm.completed`.
- **Dashboard renders the tool-loop chain** with cycle-depth indentation and a per-event `cycle N` badge, so operators can visually trace the LLM → tool → tool_result → LLM cascade.
- **Voice-arc fixture** — call.started → transcript → memory → LLM → TTS → interrupt → new transcript → LLM → TTS → call.ended (11 events for one call).
- **Agentic multi-tool fixture** — LLM → search_knowledge_base → tool_result → LLM → lookup_order → tool_result → LLM (final text). 3 cycles, all rendered with chain indentation.
- **Tools matrix on `/config`** — 3 built-in tools with live enabled/off status based on env-var gates.

**Multi-provider LLMs** (also added this pass)
- **Four additional LLM providers** — OpenAI (GPT), Google Gemini, Ollama (local), LM Studio (local). Three OpenAI-shape providers route through a single `openai-compatible-adapter.ts` — one class, four providers via `baseURL` / `apiKey` / `model` configuration.
- **Provider-neutral `LlmAdapter` interface** + `createLlmAdapter()` factory dispatching on `LLM_PROVIDER` env var (fallback to config default).
- **Per-provider env-var defaults** in `defaultModelPerProvider`.
- **Provider-aware `setup:check`** — validates whichever provider is configured with a minimum-token probe.
- **Provider badge in the dashboard header** on every page — click to jump to `/config`. Provider matrix on `/config` shows all 5 with active/ready/not-set-up status.

**Tests**
- +6 openai-compatible adapter tests (text response, tool_call with toolCallId, mixed conv translation, malformed JSON, tools-array omission, id labelling).
- +1 anthropic adapter test for tool-loop conversation translation.
- **14 tests total** (up from 7 in v1.0).

### Changed
- **`ClaudeAdapter` → `AnthropicAdapter`**; `ClaudeResult` → `LlmResult` (moved to `llm-types.ts`).
- **Voice channel default flipped from `false` to `true`** in shared config — the v1.0 deferred-to-v1.1 flag is now shipped.
- **`onMessageReady` signature updated** to accept `ConvItem[]` conversation (not `string[]` + `userMessage`). Existing text-only usage still works — text messages become `{role: "user", content: string}` items.
- `dependencies` in `apps/agent/package.json` now includes `openai@^7.3.0`.

### Removed
- **Header text** "TAC + Claude Starter" → "TAC Agent Starter · Multi-LLM · Observability" (Claude is one of five providers now).
- **Footer** Anthropic-Claude-specific link — now lists all 5 providers.

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
- **Topic-first docs structure** — `docs/MEMORY.md`, `docs/AGENT.md`, `docs/OBSERVABILITY.md`, `docs/DEPLOYMENT.md`.
- **MIT license** to match the underlying TAC SDK and remove licence-compatibility friction for downstream projects.
