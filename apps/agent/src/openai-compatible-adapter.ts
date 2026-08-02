import OpenAI from "openai";
import type { StarterConfig } from "@tac-starter/shared";
import type { ConvItem, LlmAdapter, LlmResult, LlmTool } from "./llm-types.js";

/**
 * One adapter, four providers — every OpenAI-shape endpoint:
 *
 *   - **OpenAI** itself (default endpoint)
 *   - **Google Gemini** via its OpenAI-compatible endpoint
 *   - **Ollama** (local, `http://localhost:11434/v1`)
 *   - **LM Studio** (local, `http://localhost:1234/v1`)
 *
 * The `openai` SDK's `chat.completions.create` shape is the lowest common
 * denominator that all four support, including parallel function calling.
 */
export class OpenAICompatibleAdapter implements LlmAdapter {
  readonly id: string;
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(
    llm: StarterConfig["llm"],
    options: {
      label: string;
      baseURL?: string;
      apiKey: string;
      model: string;
    },
  ) {
    this.client = new OpenAI({
      baseURL: options.baseURL,
      apiKey: options.apiKey,
    });
    this.model = options.model;
    this.maxTokens = llm.maxTokens;
    this.temperature = llm.temperature;
    this.id = `${options.label}:${this.model}`;
  }

  async respond(params: {
    systemPrompt: string;
    conversation: ConvItem[];
    tools?: LlmTool[];
  }): Promise<LlmResult> {
    const started = Date.now();
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: params.systemPrompt },
      ...translateConversation(params.conversation),
    ];

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages,
      ...(params.tools && params.tools.length > 0
        ? {
            tools: params.tools.map((t) => ({
              type: "function" as const,
              function: {
                name: t.name,
                description: t.description,
                parameters: t.input_schema,
              },
            })),
          }
        : {}),
    });

    const usage = {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
    const meta = { model: response.model || this.model, usage, latencyMs: Date.now() - started };

    const choice = response.choices[0];
    const text = choice?.message.content ?? "";
    const toolCalls = choice?.message.tool_calls ?? [];

    // Collect EVERY function-type tool_call — parallel batches supported.
    const parsed = toolCalls
      .filter(
        (tc): tc is Extract<typeof tc, { type: "function" }> => tc.type === "function",
      )
      .map((tc) => ({
        toolCallId: tc.id,
        toolName: tc.function.name,
        input: parseJsonSafely(tc.function.arguments),
      }));

    if (parsed.length > 0) {
      return {
        type: "tool_use",
        toolCalls: parsed,
        ...(text ? { text } : {}),
        ...meta,
      };
    }

    return { type: "text", text, ...meta };
  }
}

function parseJsonSafely(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { _raw: raw };
  } catch {
    return { _raw: raw };
  }
}

function translateConversation(conv: ConvItem[]): OpenAI.ChatCompletionMessageParam[] {
  const messages: OpenAI.ChatCompletionMessageParam[] = [];

  for (const item of conv) {
    if (item.role === "user") {
      messages.push({ role: "user", content: item.content });
    } else if (item.role === "assistant" && "toolCalls" in item) {
      messages.push({
        role: "assistant",
        content: item.text ?? null,
        tool_calls: item.toolCalls.map((tc) => ({
          id: tc.toolCallId,
          type: "function" as const,
          function: {
            name: tc.toolName,
            arguments: JSON.stringify(tc.input),
          },
        })),
      });
    } else if (item.role === "assistant") {
      messages.push({ role: "assistant", content: item.content });
    } else if (item.role === "tool") {
      // OpenAI expects one `role: "tool"` message per tool result.
      messages.push({
        role: "tool",
        tool_call_id: item.toolCallId,
        content: item.content,
      });
    }
  }

  return messages;
}
