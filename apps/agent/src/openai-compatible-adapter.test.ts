import { afterEach, describe, expect, it, vi } from "vitest";
import type { StarterConfig } from "@tac-starter/shared";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter.js";
import type { ConvItem } from "./llm-types.js";

const createMock = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } };
  },
}));

const llmConfig: StarterConfig["llm"] = {
  provider: "openai",
  defaultModel: "gpt-4o",
  maxTokens: 512,
  temperature: 0.6,
};

const options = {
  label: "openai",
  apiKey: "sk-test",
  model: "gpt-4o",
};

afterEach(() => createMock.mockReset());

describe("OpenAICompatibleAdapter.respond", () => {
  it("maps a text response to type: 'text'", async () => {
    createMock.mockResolvedValue({
      model: "gpt-4o",
      choices: [{ message: { content: "Hello there." } }],
      usage: { prompt_tokens: 42, completion_tokens: 6 },
    });
    const adapter = new OpenAICompatibleAdapter(llmConfig, options);
    const result = await adapter.respond({
      systemPrompt: "system",
      conversation: [{ role: "user", content: "hi" }],
    });
    expect(result.type).toBe("text");
    if (result.type !== "text") throw new Error("unreachable");
    expect(result.text).toBe("Hello there.");
    expect(result.usage.inputTokens).toBe(42);
    expect(result.model).toBe("gpt-4o");
  });

  it("returns all tool_calls (parallel batch) from a function-call response", async () => {
    createMock.mockResolvedValue({
      model: "gpt-4o",
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call_kb",
                type: "function",
                function: {
                  name: "search_knowledge_base",
                  arguments: '{"query":"shipping"}',
                },
              },
              {
                id: "call_ord",
                type: "function",
                function: {
                  name: "lookup_order",
                  arguments: '{"order_id":"A-1"}',
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    });
    const adapter = new OpenAICompatibleAdapter(llmConfig, options);
    const result = await adapter.respond({
      systemPrompt: "system",
      conversation: [{ role: "user", content: "where's my order and how does shipping work?" }],
      tools: [
        {
          name: "search_knowledge_base",
          description: "KB",
          input_schema: { type: "object", properties: {}, required: [] },
        },
        {
          name: "lookup_order",
          description: "Order",
          input_schema: { type: "object", properties: {}, required: [] },
        },
      ],
    });
    expect(result.type).toBe("tool_use");
    if (result.type !== "tool_use") throw new Error("unreachable");
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0]!.toolCallId).toBe("call_kb");
    expect(result.toolCalls[0]!.input).toEqual({ query: "shipping" });
    expect(result.toolCalls[1]!.toolName).toBe("lookup_order");
  });

  it("translates a full tool-loop conversation (parallel batch) to OpenAI role sequence", async () => {
    createMock.mockResolvedValue({
      model: "gpt-4o",
      choices: [{ message: { content: "All checks done." } }],
      usage: { prompt_tokens: 200, completion_tokens: 8 },
    });
    const adapter = new OpenAICompatibleAdapter(llmConfig, options);
    const conv: ConvItem[] = [
      { role: "user", content: "check both" },
      {
        role: "assistant",
        toolCalls: [
          { toolCallId: "call_a", toolName: "search_kb", input: { q: "policy" } },
          { toolCallId: "call_b", toolName: "lookup", input: { id: "A-1" } },
        ],
      },
      { role: "tool", toolCallId: "call_a", content: '{"chunks":[]}' },
      { role: "tool", toolCallId: "call_b", content: '{"status":"ok"}' },
    ];
    await adapter.respond({ systemPrompt: "s", conversation: conv });

    const payload = createMock.mock.calls[0]![0];
    // system + user + assistant(2 tool_calls) + tool + tool = 5 messages
    expect(payload.messages).toHaveLength(5);
    expect(payload.messages[2].role).toBe("assistant");
    expect(payload.messages[2].tool_calls).toHaveLength(2);
    expect(payload.messages[3]).toEqual({
      role: "tool",
      tool_call_id: "call_a",
      content: '{"chunks":[]}',
    });
    expect(payload.messages[4]).toEqual({
      role: "tool",
      tool_call_id: "call_b",
      content: '{"status":"ok"}',
    });
  });

  it("gracefully surfaces malformed tool-call JSON as _raw", async () => {
    createMock.mockResolvedValue({
      model: "gpt-4o",
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: { name: "handoff", arguments: "not json {" },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 50, completion_tokens: 5 },
    });
    const adapter = new OpenAICompatibleAdapter(llmConfig, options);
    const result = await adapter.respond({
      systemPrompt: "s",
      conversation: [{ role: "user", content: "u" }],
    });
    if (result.type !== "tool_use") throw new Error("expected tool_use");
    expect(result.toolCalls[0]!.input).toEqual({ _raw: "not json {" });
  });

  it("omits the tools param when the array is empty or unset", async () => {
    createMock.mockResolvedValue({
      model: "gpt-4o",
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 5, completion_tokens: 1 },
    });
    const adapter = new OpenAICompatibleAdapter(llmConfig, options);

    await adapter.respond({ systemPrompt: "s", conversation: [{ role: "user", content: "u" }] });
    expect(createMock.mock.calls[0]![0]).not.toHaveProperty("tools");

    createMock.mockClear();
    await adapter.respond({
      systemPrompt: "s",
      conversation: [{ role: "user", content: "u" }],
      tools: [],
    });
    expect(createMock.mock.calls[0]![0]).not.toHaveProperty("tools");
  });

  it("id label reflects provider + model", () => {
    const adapter = new OpenAICompatibleAdapter(llmConfig, {
      label: "ollama",
      apiKey: "ollama",
      model: "llama3.2",
      baseURL: "http://localhost:11434/v1",
    });
    expect(adapter.id).toBe("ollama:llama3.2");
  });
});
