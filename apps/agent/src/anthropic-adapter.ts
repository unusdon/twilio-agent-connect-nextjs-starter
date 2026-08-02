import Anthropic from "@anthropic-ai/sdk";
import type { StarterConfig } from "@tac-starter/shared";
import type { ConvItem, LlmAdapter, LlmResult, LlmTool } from "./llm-types.js";

/**
 * Anthropic Claude adapter.
 *
 * Uses prompt caching on the system prompt so repeated turns in the same
 * conversation are cheap. Translates the provider-neutral ConvItem[] into
 * Anthropic's native message shape, including multiple tool_use / tool_result
 * blocks for parallel-tool agentic loops.
 */
export class AnthropicAdapter implements LlmAdapter {
  readonly id: string;
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(llm: StarterConfig["llm"]) {
    this.client = new Anthropic();
    this.model = process.env["ANTHROPIC_MODEL"] ?? llm.defaultModel;
    this.maxTokens = llm.maxTokens;
    this.temperature = llm.temperature;
    this.id = `anthropic:${this.model}`;
  }

  async respond(params: {
    systemPrompt: string;
    conversation: ConvItem[];
    tools?: LlmTool[];
  }): Promise<LlmResult> {
    const started = Date.now();
    const messages = translateConversation(params.conversation);

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
      messages,
      ...(params.tools && params.tools.length > 0
        ? {
            tools: params.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.input_schema as Anthropic.Tool.InputSchema,
            })),
          }
        : {}),
    });

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
    };
    const meta = { model: response.model, usage, latencyMs: Date.now() - started };

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Collect EVERY tool_use block — Claude often emits several in parallel.
    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUses.length > 0) {
      return {
        type: "tool_use",
        toolCalls: toolUses.map((t) => ({
          toolCallId: t.id,
          toolName: t.name,
          input: t.input as Record<string, unknown>,
        })),
        ...(text ? { text } : {}),
        ...meta,
      };
    }

    return { type: "text", text, ...meta };
  }
}

function translateConversation(conv: ConvItem[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  let pendingToolResults: Anthropic.ToolResultBlockParam[] = [];

  const flushToolResults = () => {
    if (pendingToolResults.length > 0) {
      messages.push({ role: "user", content: pendingToolResults });
      pendingToolResults = [];
    }
  };

  for (const item of conv) {
    if (item.role === "tool") {
      // Multiple tool results in a row batch into ONE user message per
      // Anthropic's schema (tool_result blocks live inside user messages).
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: item.toolCallId,
        content: item.content,
      });
      continue;
    }

    // Anything else — flush any pending batch of tool results first.
    flushToolResults();

    if (item.role === "user") {
      messages.push({ role: "user", content: item.content });
    } else if (item.role === "assistant" && "toolCalls" in item) {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (item.text) blocks.push({ type: "text", text: item.text });
      for (const tc of item.toolCalls) {
        blocks.push({
          type: "tool_use",
          id: tc.toolCallId,
          name: tc.toolName,
          input: tc.input,
        });
      }
      messages.push({ role: "assistant", content: blocks });
    } else {
      messages.push({ role: "assistant", content: item.content });
    }
  }

  flushToolResults();
  return messages;
}
