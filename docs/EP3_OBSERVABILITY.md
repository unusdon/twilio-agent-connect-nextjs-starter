# Episode 3 — Real-time Intelligence and Observability

**Goal:** understand the event schema, how the dashboard reads it, and how to add your own intelligence-rule webhooks.

## The event schema

Every meaningful step in an agent turn emits one of six event types. Types live in `packages/shared/src/events.ts` and are shared between the agent (writer) and the dashboard (reader):

| Type | When it fires | Key fields |
|---|---|---|
| `message.received` | Inbound turn arrives on a channel | `from`, `message` |
| `memory.recalled` | After `MemoryPromptBuilder.compose()` runs | `query`, `observations[]` with scores, `observationCount`, `latencyMs` |
| `llm.completed` | Anthropic Messages call returns | `model`, `response`, `usage.{input,output,cache_read}Tokens`, `latencyMs` |
| `tool.called` | LLM invoked a tool (handoff, etc.) | `tool`, `input`, `outcome`, `error?` |
| `message.sent` | Response actually posted back to the channel | `message` |
| `rule.fired` | An intelligence rule webhook triggered | `ruleName`, `payload` |

All events share `timestamp`, `conversationId`, `channel`. This means every event is timeline-plottable per conversation, which is what the dashboard's `[id]` route renders.

## Event sinks

`packages/shared/src/config.ts` picks one of three sinks:

- **`file`** — JSONL appended to `AGENT_EVENT_LOG` (default `./data/events.jsonl`). The dashboard tails this in live mode. Simplest option, works for single-instance deployments.
- **`memory`** — bounded ring in-process only. Fine for local dev and testing; state dies with the process.
- **`none`** — disables observability writes entirely. Use in production if you're forwarding to Datadog / Grafana via a different path.

## Dashboard modes

- **`DASHBOARD_MODE=demo`** — reads from `apps/dashboard/lib/fixtures.ts`. Two realistic conversations, all six event types represented. This is the default so evaluators see the UI immediately without a Twilio account.
- **`DASHBOARD_MODE=live`** — reads the JSONL file at `AGENT_EVENT_LOG`. The dashboard uses Next.js's `force-dynamic` rendering so each page load re-reads the file; refresh to see new events.

Neither mode auto-polls. If you want live-tail behaviour, add a client-side timer that reloads the route — or in v1.1, swap to an SSE stream from the agent.

## Wiring intelligence rules

Twilio Conversation Intelligence can post to arbitrary webhooks when a rule fires (sentiment, keyword, custom operator). The starter includes a placeholder `rule.fired` event type — to plug in a real webhook:

1. In the Twilio Console, configure an Intelligence rule with a webhook target pointing at your agent's URL, e.g. `POST /rule-webhook`.
2. Add a Fastify route on the agent's `TACServer.fastify` instance:

```ts
server.fastify.post("/rule-webhook", async (req, reply) => {
  const payload = req.body;
  await sink.emit({
    type: "rule.fired",
    timestamp: new Date().toISOString(),
    conversationId: payload.conversationId,
    channel: payload.channel,
    ruleName: payload.rule,
    payload,
  });
  return reply.code(204).send();
});
```

3. The event appears in the dashboard's per-conversation timeline in the correct chronological slot.

A rule-config UI in the dashboard is planned for v1.1.

## What the dashboard shows

- **`/`** — grouped list of recent conversations, most-recent first, with the last inbound message preview and event count.
- **`/conversations/[id]`** — full chronological timeline. Each event card shows:
  - `memory.recalled` — the query, latency, and each observation with its similarity score
  - `llm.completed` — model, token in/out, cache-read tokens, latency, and full assistant text
  - `tool.called` — tool name, outcome, and pretty-printed input JSON
  - `rule.fired` — rule name and full payload

This is the trace-to-debug surface. If a customer complains "the bot told me the wrong shipping date", you filter to their `conversationId`, find the `llm.completed` where the wrong date was generated, then look one event up at the `memory.recalled` that fed it — you'll see immediately whether the retrieval returned the wrong observation, the observation itself was stale, or the LLM ignored what was there.
