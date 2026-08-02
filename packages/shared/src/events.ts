/**
 * Observability event schema.
 *
 * Every meaningful step in an agent turn emits one of these events. The dashboard
 * renders them as a per-conversation timeline so operators can trace exactly what
 * happened, in what order, and why. Multi-tool loops chain together with
 * `cycleDepth` + `toolCallId` so operators can see the LLM → tool → LLM cascade
 * for a single customer message.
 */

export type Channel = "voice" | "sms" | "whatsapp" | "chat";

interface BaseEvent {
  /** ISO-8601. Stamped at emit time by the agent. */
  timestamp: string;
  /** Groups events by TAC conversation ID. Dashboard timelines are keyed on this. */
  conversationId: string;
  /** Which channel the current turn came in on. */
  channel: Channel;
  /**
   * Which iteration of the multi-tool loop this event belongs to. 0 = the
   * first LLM turn triggered by a customer message; every tool_use → tool_result
   * → next LLM pair increments this. `undefined` on events that don't belong to
   * a loop (message.received, message.sent, memory.recalled, voice lifecycle).
   */
  cycleDepth?: number;
}

// ─── Message events ───────────────────────────────────────────────────────

export interface MessageReceived extends BaseEvent {
  type: "message.received";
  message: string;
  /** Twilio's participant identity — phone number, WhatsApp ID, etc. */
  from: string;
  // NOTE: transcript metadata (ASR confidence, duration) intentionally omitted.
  // MessageReadyCallback doesn't surface it. Coming via VoiceChannelEvents
  // listener in a future release.
}

/**
 * Recall API called to fetch context for this turn. The retrieved observations
 * are logged verbatim so operators can inspect what the model actually saw.
 * Observations are returned by TAC in relevance-descending order — no explicit
 * similarity score is exposed by the SDK.
 */
export interface MemoryRecalled extends BaseEvent {
  type: "memory.recalled";
  query: string;
  /** Number of observations returned; null when Recall was skipped. */
  observationCount: number | null;
  observations: Array<{ content: string; occurredAt?: string }>;
  /**
   * Recall round-trip latency in milliseconds — null when the SDK doesn't
   * expose it. Kept as an explicit null instead of `0` so the UI can show
   * "n/a" rather than a misleading zero.
   */
  latencyMs: number | null;
}

// ─── LLM cycle events ─────────────────────────────────────────────────────

export interface LlmCompleted extends BaseEvent {
  type: "llm.completed";
  model: string;
  /**
   * Text portion of the assistant response. Empty on tool-only turns where
   * the LLM emitted only a tool_use with no accompanying text.
   */
  response: string;
  /** True if this LLM turn ended with a tool_use (chain continues after). */
  invokedTool: boolean;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
  };
  latencyMs: number;
}

/**
 * LLM invoked a tool. The starter's built-in tool is `handoff` (from the TAC
 * SDK's `createStudioHandoffTool`). Buyers register additional tools in
 * `apps/agent/src/tools.ts`.
 */
export interface ToolCalled extends BaseEvent {
  type: "tool.called";
  /** LLM-generated correlation ID linking this tool call to its result. */
  toolCallId: string;
  tool: "handoff" | "knowledge_search" | "create_observation" | string;
  /** JSON-serialisable input the LLM chose. */
  input: unknown;
  outcome: "succeeded" | "failed";
  /** Wall-clock time the tool implementation took. */
  latencyMs: number;
  error?: string;
}

/**
 * The tool executed — its output was fed back to the next LLM turn. Separate
 * from `tool.called` (which captures what the LLM asked for) so operators can
 * see the exact string the model got to reason over.
 */
export interface ToolResult extends BaseEvent {
  type: "tool.result";
  toolCallId: string;
  tool: string;
  /** Serialised tool output (truncated in the log for very large payloads). */
  result: string;
}

// ─── Outbound + lifecycle + rule events ───────────────────────────────────

export interface MessageSent extends BaseEvent {
  type: "message.sent";
  message: string;
  // NOTE: TTS metadata (voice profile, synthesis latency) intentionally
  // omitted. MessageReadyCallback doesn't surface it. Coming via
  // VoiceChannelEvents listener in a future release.
}

export interface RuleFired extends BaseEvent {
  type: "rule.fired";
  ruleName: string;
  payload: unknown;
}

// ─── Voice call lifecycle ─────────────────────────────────────────────────

export interface CallStarted extends BaseEvent {
  type: "call.started";
  /** Twilio Call SID for correlating with the Voice console. */
  callSid?: string;
  from: string;
  to?: string;
}

export interface CallEnded extends BaseEvent {
  type: "call.ended";
  /** Total call duration in milliseconds. */
  durationMs?: number;
  reason?: "customer_hangup" | "agent_hangup" | "handoff" | "error" | "unknown";
}

/**
 * Customer talked over the assistant. Signals bad response length, poor TTS
 * pacing, or a misread of intent — one of the most valuable voice-agent
 * quality signals. TAC's InterruptCallback provides the payload.
 */
export interface InterruptDetected extends BaseEvent {
  type: "interrupt.detected";
  /** The partial assistant utterance that had already played. */
  utteranceUntilInterrupt?: string;
  /** ms into the assistant response when the customer started speaking. */
  durationUntilInterruptMs?: number;
}

// ─── Union + type constants ───────────────────────────────────────────────

export type TacEvent =
  | MessageReceived
  | MemoryRecalled
  | LlmCompleted
  | ToolCalled
  | ToolResult
  | MessageSent
  | RuleFired
  | CallStarted
  | CallEnded
  | InterruptDetected;

export const eventTypes = [
  "message.received",
  "memory.recalled",
  "llm.completed",
  "tool.called",
  "tool.result",
  "message.sent",
  "rule.fired",
  "call.started",
  "call.ended",
  "interrupt.detected",
] as const;

export type EventType = (typeof eventTypes)[number];
