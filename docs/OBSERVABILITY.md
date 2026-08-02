# Observability

**Goal:** understand the event schema, how the dashboard reads it, and how to wire your own intelligence-rule webhooks.

## Event schema

Every meaningful step in a customer turn emits one of **ten event types**. Types live in [`packages/shared/src/events.ts`](../packages/shared/src/events.ts) and are shared between the agent (writer) and the dashboard (reader):

| Type | When it fires | Notable fields |
|---|---|---|
| `message.received` | Inbound turn arrives on a channel | `from`, `message` |
| `memory.recalled` | After `MemoryPromptBuilder.compose()` runs | `query`, `observations[]`, `observationCount`, `latencyMs` |
| `llm.completed` | Each LLM turn returns | `model`, `response`, `invokedTool`, `usage.{input,output,cache_read}Tokens`, `latencyMs`, `cycleDepth` |
| `tool.called` | LLM invoked a tool | `toolCallId`, `tool`, `input`, `outcome`, `latencyMs`, `cycleDepth` |
| `tool.result` | Tool executed, result fed back into next LLM turn | `toolCallId`, `tool`, `result`, `cycleDepth` |
| `message.sent` | Outbound response posted to the channel | `message` |
| `rule.fired` | Intelligence-rule webhook triggered | `ruleName`, `payload` |
| `call.started` | Voice: first turn of a call | `callSid`, `from`, `to` |
| `call.ended` | Voice: call closed | `durationMs`, `reason` |
| `interrupt.detected` | Voice: customer talked over the assistant | `utteranceUntilInterrupt`, `durationUntilInterruptMs` |

Every event carries `timestamp`, `conversationId`, `channel`. Chain events (`llm.completed`, `tool.called`, `tool.result`) additionally carry `cycleDepth`, so the dashboard indents each cycle to visualise the LLM → tool → tool_result → LLM cascade.

## Event sinks

Configured in `packages/shared/src/config.ts` under `observability.sink`:

- **`file`** — JSONL appended to `AGENT_EVENT_LOG` (default `./data/events.jsonl`, resolved from the monorepo root via `npm_config_local_prefix`). The dashboard tails this in live mode. Simplest option, works for single-instance deployments.
- **`memory`** — bounded ring in-process only. Fine for local dev and testing; state dies with the process.
- **`none`** — disables observability writes entirely. Use in production if you're forwarding to Datadog / Grafana / Sentry via a different path.

## Dashboard modes

- **`DASHBOARD_MODE=demo`** — reads from [`apps/dashboard/lib/fixtures.ts`](../apps/dashboard/lib/fixtures.ts). Four realistic conversations covering every event type. This is the default when there's no `.env`, so evaluators see the UI immediately without a Twilio account.
- **`DASHBOARD_MODE=live`** — reads the JSONL file at `AGENT_EVENT_LOG`. The dashboard uses Next.js's `force-dynamic` rendering so each page load re-reads the file; refresh to see new events.

Neither mode auto-polls. Live-tail behaviour (SSE stream from the agent) is planned for v1.2.

## Wiring intelligence rules

Twilio Conversation Intelligence can post to arbitrary webhooks when a rule fires (sentiment, keyword, custom operator). The starter includes a **`POST /rule-webhook`** endpoint on the agent's `TACServer.fastify` instance that captures the payload as a `rule.fired` event on the timeline — no additional wiring needed.

To use it:

1. In the Twilio Console, configure an Intelligence rule with a webhook target pointing at `https://<your-agent-host>/rule-webhook`.
2. The starter automatically inserts the event into the observability stream. Body fields `conversationId`, `channel`, and `rule` are extracted into the event's structured fields; the entire payload is preserved in `payload` for anything else.

Extend the built-in handler (in [`apps/agent/src/index.ts`](../apps/agent/src/index.ts)) if you need to trigger side effects like a Slack notification, priority escalation, or a custom tag on the conversation.

A rule-config UI in the dashboard is planned for v1.2.

## What the dashboard renders

- **`/`** — grouped conversation list. Each card shows: circular avatar with initial, derived customer name (extracted from Memory observations via `deriveCustomerName`), channel icon + pill, phone/address in mono, latest inbound message preview, turn count, total tokens, cache-hit ratio, status pill (active / handoff / idle), relative time.
- **`/conversations/[id]`** — full chronological timeline. Every event has:
  - **Timeline dot** in a colour matching its type (blue message, purple memory, green LLM, amber tool, green-2 tool.result, slate sent, pink rule, green phone-up, slate phone-down, red alert)
  - **Type badge** matching the dot colour
  - **`cycle N` badge** when the event belongs to a tool cycle
  - **Fractional-second timestamp** in monospace
- **`/config`** — read-only:
  - **Agent section** — persona, system instructions, channels (green pills for enabled)
  - **LLM section** — active provider callout + **5-row provider matrix** (each row: `active` / `ready` / `not set up` pill, model, base URL, API-key status)
  - **Agent tools section** — 3-row **tools matrix** for the built-ins (each row: `enabled` / `off` pill, description, gate env var)
  - **Observability section** — sink type + file path
  - **Environment variables** — every recognised env var with `set` / `missing` status

## Debugging with the trace

The dashboard is designed to answer *"what went wrong with turn X?"* in three clicks:

1. Filter to the customer's `conversationId` from the home page
2. Find the `llm.completed` that produced the bad answer
3. Look at the preceding events in the same `cycleDepth` — `memory.recalled` shows what the model saw; `tool.result` shows what the tool returned; `message.received` shows what the customer actually said

Chain indent makes the tool-loop cause-and-effect visible at a glance — no jumping through JSON to reconstruct what happened in which order.
