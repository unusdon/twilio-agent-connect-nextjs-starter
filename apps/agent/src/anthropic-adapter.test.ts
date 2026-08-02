import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicAdapter } from "./anthropic-adapter.js";
import type { ConvItem, LlmResult } from "./llm-types.js";
import type { StarterConfig } from "@tac-starter/shared";

/**
 * Adapter smoke tests. We mock the Anthropic client at the module level to
 * verify the adapter's shape mapping without live API calls — catches drift
 * between the SDK's response shape and our `LlmResult` union.
 */

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

const llmConfig: StarterConfig["llm"] = {
  provider: "anthropic",
  defaultModel: "claude-sonnet-4-6",
  maxTokens: 512,
  temperature: 0.6,
};

afterEach(() => createMock.mockReset());

describe("AnthropicAdapter.respond", () => {
  it("maps a plain-text response to type: 'text'", async () => {
    createMock.mockResolvedValue({
      model: "claude-sonnet-4-6",
      content: [{ type: "text", text: "Hello there." }],
      usage: { input_tokens: 42, output_tokens: 6, cache_read_input_tokens: 30 },
    });
    const adapter = new AnthropicAdapter(llmConfig);
    const result: LlmResult = await adapter.respond({
      systemPrompt: "system",
      conversation: [{ role: "user", content: "hi" }],
    });
    expect(result.type).toBe("text");
    if (result.type !== "text") throw new Error("unreachable");
    expect(result.text).toBe("Hello there.");
    expect(result.usage.inputTokens).toBe(42);
    expect(result.usage.outputTokens).toBe(6);
    expect(result.usage.cacheReadTokens).toBe(30);
  });

  it("returns all tool_use blocks in a single response (parallel batch)", async () => {
    createMock.mockResolvedValue({
      model: "claude-sonnet-4-6",
      content: [
        { type: "text", text: "Let me check both." },
        {
          type: "tool_use",
          id: "toolu_kb",
          name: "search_knowledge_base",
          input: { query: "shipping policy" },
        },
        {
          type: "tool_use",
          id: "toolu_ord",
          name: "lookup_order",
          input: { order_id: "A-1" },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 20 },
    });
    const adapter = new AnthropicAdapter(llmConfig);
    const result = await adapter.respond({
      systemPrompt: "s",
      conversation: [{ role: "user", content: "where's my order and what's the policy?" }],
      tools: [
        {
          name: "search_knowledge_base",
          description: "KB search",
          input_schema: { type: "object", properties: {}, required: [] },
        },
        {
          name: "lookup_order",
          description: "Order lookup",
          input_schema: { type: "object", properties: {}, required: [] },
        },
      ],
    });
    expect(result.type).toBe("tool_use");
    if (result.type !== "tool_use") throw new Error("unreachable");
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls.map((t) => t.toolName)).toEqual([
      "search_knowledge_base",
      "lookup_order",
    ]);
    expect(result.toolCalls[0]!.toolCallId).toBe("toolu_kb");
    expect(result.toolCalls[1]!.input).toEqual({ order_id: "A-1" });
    expect(result.text).toBe("Let me check both.");
  });

  it("translates a full conversation (user → assistant toolCalls → tool results → user) to Anthropic shape", async () => {
    createMock.mockResolvedValue({
      model: "claude-sonnet-4-6",
      content: [{ type: "text", text: "Both checks done." }],
      usage: { input_tokens: 200, output_tokens: 8 },
    });
    const adapter = new AnthropicAdapter(llmConfig);
    const conv: ConvItem[] = [
      { role: "user", content: "check both please" },
      {
        role: "assistant",
        text: "Checking now.",
        toolCalls: [
          { toolCallId: "toolu_a", toolName: "search_kb", input: { q: "policy" } },
          { toolCallId: "toolu_b", toolName: "lookup", input: { id: "A-1" } },
        ],
      },
      { role: "tool", toolCallId: "toolu_a", content: '{"chunks":[]}' },
      { role: "tool", toolCallId: "toolu_b", content: '{"status":"ok"}' },
    ];
    await adapter.respond({ systemPrompt: "s", conversation: conv });

    const payload = createMock.mock.calls[0]![0];
    // user + assistant(text+2 tool_use) + user(2 tool_result) = 3 messages
    expect(payload.messages).toHaveLength(3);
    expect(payload.messages[1].role).toBe("assistant");
    expect(payload.messages[1].content).toHaveLength(3); // text + 2 tool_use
    expect(payload.messages[2].role).toBe("user");
    // Both tool_results batched into the SAME user message (Anthropic requirement)
    expect(payload.messages[2].content).toHaveLength(2);
    expect(payload.messages[2].content[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "toolu_a",
    });
    expect(payload.messages[2].content[1]).toMatchObject({
      type: "tool_result",
      tool_use_id: "toolu_b",
    });
  });

  it("only sends the tools param to the SDK when the array is non-empty", async () => {
    createMock.mockResolvedValue({
      model: "claude-sonnet-4-6",
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 5, output_tokens: 1 },
    });
    const adapter = new AnthropicAdapter(llmConfig);

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
});
