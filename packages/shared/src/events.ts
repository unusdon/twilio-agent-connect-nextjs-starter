/**
 * Observability event schema.
 *
 * Every meaningful step in an agent turn emits one of these events. The dashboard
 * renders them as a per-conversation timeline so operators can trace exactly what
 * happened, in what order, and why. Ep 3 of the pedagogy is built on top of this.
 */

export type Channel = "voice" | "sms" | "whatsapp" | "chat";

interface BaseEvent {
  /** ISO-8601. Stamped at emit time by the agent. */
  timestamp: string;
  /** Groups events by TAC conversation ID. Dashboard timelines are keyed on this. */
  conversationId: string;
  /** Which channel the current turn came in on. */
  channel: Channel;
}

/** Inbound customer message received on a channel. */
export interface MessageReceived extends BaseEvent {
  type: "message.received";
  message: string;
  /** Twilio's participant identity — phone number, WhatsApp ID, etc. */
  from: string;
}

/**
 * Recall API called to fetch context for this turn. The retrieved observations
 * are logged verbatim so operators can inspect what the model actually saw.
 * Observations are returned by TAC in relevance-descending order — no explicit
 * score field is exposed by the SDK.
 */
export interface MemoryRecalled extends BaseEvent {
  type: "memory.recalled";
  query: string;
  /** Number of observations returned; null when Recall was skipped. */
  observationCount: number | null;
  /**
   * Retrieved observations, truncated for the log. Ordered by relevance
   * (most relevant first) — no explicit similarity score is exposed.
   */
  observations: Array<{ content: string; occurredAt?: string }>;
  /**
   * Total Recall round-trip latency in milliseconds — null when the SDK
   * doesn't expose it (current TAC 2.x does not surface retrieval latency
   * from MemoryPromptBuilder.compose()). Kept as an explicit null instead
   * of `0` so the UI can show "n/a" rather than a misleading zero.
   */
  latencyMs: number | null;
}

/** LLM invocation — prompt + response summary. */
export interface LlmCompleted extends BaseEvent {
  type: "llm.completed";
  model: string;
  /** Just the assistant's text response; tool calls surface as separate events. */
  response: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    /** Anthropic prompt-cache hit ratio, if reported. */
    cacheReadTokens?: number;
  };
  latencyMs: number;
}

/**
 * LLM called a tool. The starter's built-in tool is `handoff` (from the TAC
 * SDK's `createStudioHandoffTool`, which defaults to that name). Extend this
 * union or leave it as a string literal to add your own tools.
 */
export interface ToolCalled extends BaseEvent {
  type: "tool.called";
  tool: "handoff" | string;
  /** JSON-serialisable input the LLM chose. */
  input: unknown;
  outcome: "succeeded" | "failed";
  /** Error message if outcome === "failed". */
  error?: string;
}

/** Outbound response actually sent back on the channel. */
export interface MessageSent extends BaseEvent {
  type: "message.sent";
  message: string;
}

/**
 * An intelligence-rule webhook fired. The starter emits a passthrough entry so
 * operators can see the rule-eval → action link in the trace.
 */
export interface RuleFired extends BaseEvent {
  type: "rule.fired";
  ruleName: string;
  payload: unknown;
}

export type TacEvent =
  | MessageReceived
  | MemoryRecalled
  | LlmCompleted
  | ToolCalled
  | MessageSent
  | RuleFired;

export const eventTypes = [
  "message.received",
  "memory.recalled",
  "llm.completed",
  "tool.called",
  "message.sent",
  "rule.fired",
] as const;
