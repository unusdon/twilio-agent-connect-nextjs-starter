import Anthropic from "@anthropic-ai/sdk";
import type { StarterConfig } from "@tac-starter/shared";

interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
}

/**
 * Adapter result — Claude either produced text OR requested a tool call.
 * The agent branches on `type` to handle each case.
 */
export type ClaudeResult =
  | {
      type: "text";
      text: string;
      model: string;
      usage: Usage;
      latencyMs: number;
    }
  | {
      type: "tool_use";
      toolName: string;
      input: Record<string, unknown>;
      model: string;
      usage: Usage;
      latencyMs: number;
    };

/**
 * Thin Claude adapter. Swap this file to swap providers — the rest of the
 * agent depends only on `ClaudeResult` shape.
 *
 * Uses prompt caching on the system prompt so repeated turns in the same
 * conversation are cheap. The system prompt is the natural cache anchor
 * because MemoryPromptBuilder.compose() prepends stable persona instructions
 * before the per-turn memory context.
 */
export class ClaudeAdapter {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(llm: StarterConfig["llm"]) {
    this.client = new Anthropic();
    this.model = process.env["ANTHROPIC_MODEL"] ?? llm.defaultModel;
    this.maxTokens = llm.maxTokens;
    this.temperature = llm.temperature;
  }

  async respond(params: {
    systemPrompt: string;
    conversation: Array<{ role: "user" | "assistant"; content: string }>;
    userMessage: string;
    /** Optional Anthropic-format tool schemas the LLM may call. */
    tools?: Anthropic.Tool[];
  }): Promise<ClaudeResult> {
    const started = Date.now();
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: [
        {
          type: "text",
          text: params.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        ...params.conversation.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: params.userMessage },
      ],
      ...(params.tools && params.tools.length > 0 ? { tools: params.tools } : {}),
    });

    const usage: Usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
    };
    const meta = { model: response.model, usage, latencyMs: Date.now() - started };

    // Prefer tool_use if present — Claude may emit a text block alongside a
    // tool_use, but the intent-signal is the tool call.
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (toolUse) {
      return {
        type: "tool_use",
        toolName: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
        ...meta,
      };
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return { type: "text", text, ...meta };
  }
}
