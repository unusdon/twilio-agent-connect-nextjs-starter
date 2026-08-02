# Agent architecture

**Goal:** understand the agent service, the multi-turn tool loop, and how any of the five LLM providers get wired into TAC's `onMessageReady` callback.

## Data flow

```
Twilio channel event  ──┐
                        │  webhook / WebSocket
                        ▼
                   TACServer (Fastify)
                        │
                        ▼
        TAC framework — validates + hydrates memory
                        │
                        ▼
      onMessageReady({ message, memory, session, channel })
                        │
                        ▼
                  handleMessage(deps, input)   ◄──── testable
                        │
    ┌───────────────────┼────────────────────┐
    ▼                   ▼                    ▼
 event sink       MemoryPromptBuilder    tool registry
 (JSONL)          .compose(...)          (per-turn)
                        │                    │
                        ▼                    │
              ┌──────────────────┐           │
              │  LlmAdapter      │◄──────────┘
              │  (one of 5)      │
              └────────┬─────────┘
                       │
             ┌─────────┴──────────┐
             ▼                    ▼
        LlmResult.text     LlmResult.tool_use
             │                    │
             ▼                    ▼
        return text        execute in parallel
                                  │
                                  ▼
                          feed tool_results back
                          into next loop cycle
```

## Files

Everything the agent needs is under `apps/agent/src/`:

| File | Role |
|---|---|
| `index.ts` | Thin wiring — TAC init, channel registration, callback registration. ~90 LOC. |
| `handle-message.ts` | The tool-loop orchestration. Where the agentic behaviour lives. DI-friendly for testing. |
| `llm-types.ts` | `LlmAdapter` interface, `LlmResult` union, `ConvItem[]` conversation format, `LlmTool` schema shape. |
| `anthropic-adapter.ts` | Anthropic-native adapter — prompt caching, `tool_use` / `tool_result` translation. |
| `openai-compatible-adapter.ts` | Shared adapter for OpenAI, Gemini (OpenAI-compat endpoint), Ollama, LM Studio. |
| `llm-factory.ts` | Picks + constructs the adapter based on `LLM_PROVIDER` env var. |
| `tools.ts` | Tool registry — built-ins (`handoff`, `search_knowledge_base`, `retrieve_profile_memory`) + your custom tools go here. |
| `tools.example.ts` | Worked example for adding a custom `lookup_order` tool. |
| `event-sink.ts` | File / memory / null sinks the observability events flow into. |
| `config.ts` | Local overrides over `packages/shared/src/config.ts`. |

## Channels

All four channels are enabled by default in [`packages/shared/src/config.ts`](../packages/shared/src/config.ts):

- **SMS** — `SMSChannel` — inbound message webhook, outbound via Twilio's send API
- **WhatsApp** — `WhatsAppChannel` — same shape as SMS, uses your WhatsApp sender
- **Chat** — `ChatChannel` — the web-widget channel
- **Voice** — `VoiceChannel` — WebSocket streaming via ConversationRelay; also wires `tac.onInterrupt` + `tac.onConversationEnded` for `interrupt.detected` + `call.ended` events

Toggle any channel by flipping its boolean in `defaultConfig.agent.channels` (or override in `apps/agent/src/config.ts` for a per-deployment change).

## The tool loop

Every customer message goes through `handleMessage()` — the loop is at most `config.agent.loop.maxCycles` LLM turns (default 8). Each cycle:

1. Call `llm.respond(...)` with the running `ConvItem[]` conversation and the available tool schemas
2. Emit `llm.completed` with `cycleDepth: N`
3. If `result.type === "text"` → break, that's the response
4. Otherwise (`type === "tool_use"`):
   - If the batch contains a **terminal** tool (`handoff`), execute only that one and stop the loop
   - Otherwise, execute every tool in the batch **concurrently** via `Promise.all`
   - Emit `tool.called` + `tool.result` for each execution
   - Push the assistant turn + all tool results into the conversation
   - Loop

Exit conditions and their responses:

- **Text turn** → return the text
- **Terminal tool** → return the `handoffFarewell` (voice returns null; Studio takes over)
- **Cycle cap reached** → return the `cycleCapFallback`
- **Turn timeout exceeded** → return the `timeoutFallback` (wrapping `Promise.race`)

All three fallback strings are configurable in `config.agent.loop`.

<a id="custom-tools"></a>

## Adding custom tools

Two-step:

1. Author the tool. `tools.example.ts` shows the shape end-to-end. A `RegisteredTool` has:
   - `schema` — `{name, description, input_schema}` (JSON-schema-shaped input)
   - `execute(input)` — async handler returning `{outcome, result, error?, latencyMs}`
   - `terminal?` — set to `true` if executing this tool should end the loop (like `handoff`)

2. Register it. Add an entry to `buildToolRegistry()` in `tools.ts`:

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

The LLM sees the tool on the next customer turn — no dashboard code, no config touch. Tool failures (`outcome: "failed"`) get serialised as `{error, tool}` JSON in the fed-back `tool_result` so the LLM can react instead of assuming success.

## Human handoff

The starter registers Twilio Studio-Flow handoff automatically when `TWILIO_STUDIO_HANDOFF_FLOW_SID` is set. The tool is exposed to the LLM as `handoff` (the SDK's default name from `createStudioHandoffTool`). It's marked **terminal** — when it fires, the loop stops after emitting `tool.called`, and the customer gets the `handoffFarewell` text (or nothing on voice, where Studio takes over the audio path).

- No flow SID set → handoff tool is not registered; LLM won't see it in its tool list
- Flow set → conversation transferred to the Studio flow, which typically routes to Flex or a queue

## Swapping the LLM

The provider is picked by `LLM_PROVIDER` in `.env` (falls back to `config.llm.provider`). All five providers implement the same `LlmAdapter` interface — nothing else in the codebase branches on provider. Swap adapters (or add a new one) by:

1. Author a class implementing `LlmAdapter` in `apps/agent/src/`
2. Add a case to `createLlmAdapter()` in `llm-factory.ts`
3. Add the env-var block to `.env.example`
4. Add a row to `defaultModelPerProvider` in `packages/shared/src/config.ts`

For providers with OpenAI-compatible APIs (most local model runtimes), you don't even need a new adapter — just add a case in `llm-factory.ts` that constructs an `OpenAICompatibleAdapter` with the right `baseURL`.

## Multi-instance deployment

TAC keeps per-conversation state in-process (via the `HistoryStore` interface — defaults to `InMemoryHistoryStore`). When you scale beyond one instance you must either:

1. Route requests to the same instance for the same `conversationId` (hash-based load balancing at the LB layer), or
2. Implement a Redis-backed `HistoryStore` and pass it into `handleMessage`'s `deps`. The interface is exactly three methods — `get`, `set`, `delete` — so it's a small swap.

Option 2 is the production path. A reference Redis implementation is planned for v1.2.
