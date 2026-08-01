# Episode 2 — Build a Multichannel AI Agent

**Goal:** understand the agent service architecture and how Claude gets wired into TAC's `onMessageReady` callback.

## Architecture

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
      onMessageReady({ message, memory, session, ... })
                        │
                        ▼
        MemoryPromptBuilder.compose(...)  ──►  system prompt
                        │
                        ▼
              ClaudeAdapter.respond(...)   ──►  event sink
                        │
                        ▼
           return string → TAC routes to channel
```

The agent lives in `apps/agent/src/`:

- `index.ts` — the wiring above. TAC init, channel registration, `onMessageReady` implementation.
- `anthropic-adapter.ts` — Claude adapter, isolated so you can swap providers without touching the wiring. Uses Anthropic's prompt cache on the system prompt for cheap follow-up turns.
- `config.ts` — local overrides over `packages/shared/src/config.ts`.
- `event-sink.ts` — file / memory / null sinks the observability events flow into.

## Channels

Three channels are enabled by default in `packages/shared/src/config.ts`:

- **SMS** — `SMSChannel` — inbound message webhook, outbound via Twilio's send API
- **WhatsApp** — `WhatsAppChannel` — same shape as SMS, uses your WhatsApp sender
- **Chat** — `ChatChannel` — the web-widget channel

**Voice** is deferred to v1.1. It uses `VoiceChannel` + ConversationRelay (WebSocket streaming), which needs some extra WebSocket handling in the agent process. When we ship it, the wiring will be additive — no changes to the existing channels.

To toggle a channel, flip its boolean in `defaultConfig.agent.channels` (or override in `apps/agent/src/config.ts` if you want a per-deployment change).

## Human handoff

The starter enables Twilio Studio-Flow handoff by default. When the LLM calls the `escalate_to_human` tool, the SDK's `createStudioHandoffTool` posts the current conversation context to the Studio Flow you configure in `TWILIO_STUDIO_HANDOFF_FLOW_SID`.

- No flow SID set → handoff tool is registered but calls will fail with a clear error in the log.
- Flow set → the conversation is transferred to that flow (which typically routes to Flex or a queue).

## Swapping the LLM

The Anthropic SDK is imported in exactly one place: `anthropic-adapter.ts`. To swap to OpenAI, Bedrock, Gemini, or Vercel AI SDK, replace that file with an equivalent adapter that exposes the same `AnthropicResult` shape. The `index.ts` wiring imports only the type, so switching providers is a one-file change.

Recommended providers with drop-in effort estimates:

- **OpenAI** — ~30 min, use `openai` SDK's `chat.completions.create`
- **AWS Bedrock (Anthropic model)** — ~1 hr, use `@aws-sdk/client-bedrock-runtime`
- **Vercel AI SDK** — ~30 min, use `generateText` from `ai`

Existing TAC examples for OpenAI live in [twilio/twilio-agent-connect-typescript/getting_started/examples/openai](https://github.com/twilio/twilio-agent-connect-typescript/tree/main/getting_started/examples/openai).

## Multi-instance deployment

TAC keeps per-conversation state in-process. When you scale beyond one agent instance you must either:

1. Route requests to the same instance for the same `conversationId` (hash-based load balancing), or
2. Replace the in-memory `conversationHistory` map in `index.ts` with a Redis-backed store keyed on `conversationId`.

Option 2 is the production path. The starter ships with option 1's shape (in-memory Map) — swap it out for Redis when you go multi-instance.
