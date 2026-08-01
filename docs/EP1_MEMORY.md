# Episode 1 — Contextual Omnichannel Conversations

**Goal:** wire up Conversation Memory + Conversation Orchestrator so a single customer profile survives across channels, and each LLM turn is grounded in relevant recalled observations.

## Concepts

- **Conversation Orchestrator** — turns a stream of channel-specific events (SMS thread, WhatsApp thread, voice call) into one continuous conversation object with a stable `conversationId`. Handles identity resolution across channels — the same phone number on SMS and WhatsApp becomes one profile.
- **Conversation Memory** — a managed vector + lexical store that Twilio maintains per profile. Every conversation flowing through Orchestrator writes observations, summaries, and communication history to Memory automatically. You never write to Memory directly in this starter — you *read* from it via the Recall API.
- **Recall API** — the mid-conversation read path. Given a query (usually the incoming user message), returns a ranked set of observations, recent communications, and profile fields for the current customer.

## What this starter does

Every inbound turn triggers this sequence inside `apps/agent/src/index.ts`:

1. TAC hands your callback the `memory: TACMemoryResponse` object — the SDK has already called Recall for you before invoking `onMessageReady`.
2. `MemoryPromptBuilder.compose(instructions, memory, session)` produces the system prompt that will be sent to Claude — persona instructions on top, recalled observations underneath.
3. We introspect the memory response and emit a `memory.recalled` observability event with the raw observations + scores. The dashboard renders these so you can see what the model actually saw.

## Provisioning

You need two Twilio-side resources before the starter can run against a real account:

- **Memory Store** — the container for customer profiles (`TAC_MEMORY_STORE_SID` in `.env`).
- **Conversation Configuration** — binds channels to your Memory Store and configures how Orchestrator groups conversations (`TAC_CONVERSATION_CONFIGURATION_SID` in `.env`).

**Recommended:** clone Twilio's Python setup wizard and let it provision both for you:

```bash
git clone https://github.com/twilio/twilio-agent-connect-python
cd twilio-agent-connect-python
make setup
# open http://localhost:8080 and follow the wizard
```

It writes a `.env` in the Python repo — copy `TAC_MEMORY_STORE_SID` and `TAC_CONVERSATION_CONFIGURATION_SID` from there into this repo's `.env`.

**Manual alternative:** provision through the Twilio Console (**Conversations → Agent Connect → Memory Stores** and **Conversation Configurations**). Full walkthrough in the [TAC Quickstart](https://www.twilio.com/docs/conversations/agent-connect/quickstart).

## Verifying

Once provisioned:

```bash
npm run setup:check
```

The script confirms your credentials authenticate against the Twilio API. It does not send messages or incur cost.

## Where to look next

- Ep 2 — [`EP2_AGENT.md`](EP2_AGENT.md) covers the agent build itself
- Ep 3 — [`EP3_OBSERVABILITY.md`](EP3_OBSERVABILITY.md) covers the dashboard and the event schema
