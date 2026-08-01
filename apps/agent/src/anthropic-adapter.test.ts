import { afterEach, describe, expect, it, vi } from "vitest";
import { ClaudeAdapter, type ClaudeResult } from "./anthropic-adapter.js";
import type { StarterConfig } from "@tac-starter/shared";

/**
 * Adapter smoke tests. We mock the Anthropic client at the module level to
 * verify the adapter's response-shape mapping without making live API calls.
 * The intent is to catch drift between the SDK's response shape and our
 * `ClaudeResult` union — full behaviour testing belongs against a live account.
 */

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: createMock };
    },
  };
});

const llmConfig: StarterConfig["llm"] = {
  provider: "anthropic",
  defaultModel: "claude-sonnet-4-6",
  maxTokens: 512,
  temperature: 0.6,
};

afterEach(() => {
  createMock.mockReset();
});

describe("ClaudeAdapter.respond", () => {
  it("maps a plain-text response to type: 'text'", async () => {
    createMock.mockResolvedValue({
      model: "claude-sonnet-4-6",
      content: [{ type: "text", text: "Hello there." }],
      usage: { input_tokens: 42, output_tokens: 6, cache_read_input_tokens: 30 },
    });
    const adapter = new ClaudeAdapter(llmConfig);
    const result: ClaudeResult = await adapter.respond({
      systemPrompt: "system",
      conversation: [],
      userMessage: "hi",
    });
    expect(result.type).toBe("text");
    if (result.type !== "text") throw new Error("unreachable");
    expect(result.text).toBe("Hello there.");
    expect(result.usage.inputTokens).toBe(42);
    expect(result.usage.outputTokens).toBe(6);
    expect(result.usage.cacheReadTokens).toBe(30);
  });

  it("prefers tool_use when Claude emits both a text and a tool_use block", async () => {
    createMock.mockResolvedValue({
      model: "claude-sonnet-4-6",
      content: [
        { type: "text", text: "Connecting you." },
        { type: "tool_use", name: "handoff", input: { reason: "customer request" } },
      ],
      usage: { input_tokens: 100, output_tokens: 20 },
    });
    const adapter = new ClaudeAdapter(llmConfig);
    const result = await adapter.respond({
      systemPrompt: "system",
      conversation: [],
      userMessage: "i want a human",
      tools: [
        {
          name: "handoff",
          description: "Handoff to a human",
          input_schema: { type: "object", properties: {}, required: [] },
        },
      ],
    });
    expect(result.type).toBe("tool_use");
    if (result.type !== "tool_use") throw new Error("unreachable");
    expect(result.toolName).toBe("handoff");
    expect(result.input).toEqual({ reason: "customer request" });
  });

  it("only sends the tools param to the SDK when a non-empty tools array is passed", async () => {
    createMock.mockResolvedValue({
      model: "claude-sonnet-4-6",
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 5, output_tokens: 1 },
    });
    const adapter = new ClaudeAdapter(llmConfig);

    await adapter.respond({ systemPrompt: "s", conversation: [], userMessage: "u" });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]![0]).not.toHaveProperty("tools");

    createMock.mockClear();
    await adapter.respond({ systemPrompt: "s", conversation: [], userMessage: "u", tools: [] });
    expect(createMock.mock.calls[0]![0]).not.toHaveProperty("tools");
  });
});
