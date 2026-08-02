/**
 * Shared LLM adapter interface — provider-agnostic. Every adapter implements
 * `LlmAdapter` and returns the same `LlmResult` shape, so the wiring in
 * `apps/agent/src/handle-message.ts` never has to branch on provider.
 *
 * The tool-use case carries an ARRAY of tool calls — modern LLMs (Claude,
 * GPT-4o/5, Gemini) emit multiple tool_use blocks in a single response when
 * they need parallel information gathering. The agent executes them
 * concurrently.
 */

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  /** Only reported by providers that support prompt caching (currently Anthropic). */
  cacheReadTokens?: number;
}

/** One tool the LLM wants us to call. */
export interface LlmToolCall {
  /** Provider-generated correlation ID (opaque). Matches to the tool_result item. */
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

/**
 * Provider-neutral conversation item. Assistant turns with tool calls carry
 * an array of `toolCalls` so parallel batches round-trip cleanly.
 */
export type ConvItem =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | {
      role: "assistant";
      toolCalls: LlmToolCall[];
      /** Accompanying text the LLM produced alongside the tool batch (Anthropic often does this). */
      text?: string;
    }
  | {
      role: "tool";
      toolCallId: string;
      /** Serialised tool result (string is the lowest common denominator across providers). */
      content: string;
    };

/**
 * Discriminated union — the LLM either produced plain text or requested one
 * or more tool calls. The agent's loop branches on `type`.
 */
export type LlmResult =
  | {
      type: "text";
      text: string;
      model: string;
      usage: LlmUsage;
      latencyMs: number;
    }
  | {
      type: "tool_use";
      /** Every tool the LLM invoked in this turn — execute in parallel. */
      toolCalls: LlmToolCall[];
      /** Any accompanying text the LLM produced alongside the tool calls. */
      text?: string;
      model: string;
      usage: LlmUsage;
      latencyMs: number;
    };

/**
 * Provider-neutral tool schema (JSON-schema-shaped). Each adapter converts
 * this to the format its provider expects.
 */
export interface LlmTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LlmAdapter {
  /** Provider identifier for diagnostics (e.g. "anthropic:claude-sonnet-4-6"). */
  readonly id: string;
  respond(params: {
    systemPrompt: string;
    conversation: ConvItem[];
    tools?: LlmTool[];
  }): Promise<LlmResult>;
}
