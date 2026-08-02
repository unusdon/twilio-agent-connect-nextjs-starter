import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StarterConfig, TacEvent } from "@tac-starter/shared";
import { defaultConfig } from "@tac-starter/shared";
import type { EventSink } from "./event-sink.js";
import {
  handleMessage,
  InMemoryHistoryStore,
  type HandleMessageDeps,
} from "./handle-message.js";
import type { LlmAdapter, LlmResult } from "./llm-types.js";
import type { RegisteredTool } from "./tools.js";

/**
 * End-to-end orchestration tests for the multi-tool loop. Everything downstream
 * of `handleMessage` is mocked so we can isolate the loop's behaviour:
 *
 *   - short-circuit on immediate text
 *   - single tool round-trip → text
 *   - parallel tool batch → both execute concurrently → text
 *   - failed tool → LLM sees {error} object → text
 *   - terminal tool in a mixed batch → only terminal runs, loop stops
 *   - cycle cap reached → configured fallback text
 *   - conversation history capped to `maxHistoryTurns` pairs
 *   - turn timeout → configured timeout fallback
 */

const agentConfig: StarterConfig["agent"] = {
  ...defaultConfig.agent,
  loop: {
    ...defaultConfig.agent.loop,
    maxCycles: 4,
    turnTimeoutMs: 500,
    maxHistoryTurns: 3,
  },
};

class RecordingSink implements EventSink {
  events: TacEvent[] = [];
  async emit(event: TacEvent): Promise<void> {
    this.events.push(event);
  }
  reset(): void {
    this.events = [];
  }
  ofType<T extends TacEvent["type"]>(t: T): Array<Extract<TacEvent, { type: T }>> {
    return this.events.filter((e): e is Extract<TacEvent, { type: T }> => e.type === t);
  }
}

class QueueLlm implements LlmAdapter {
  readonly id = "queue:test";
  private q: LlmResult[] = [];
  enqueue(...results: LlmResult[]): void {
    this.q.push(...results);
  }
  async respond(): Promise<LlmResult> {
    const next = this.q.shift();
    if (!next) throw new Error("QueueLlm ran out of enqueued results");
    return next;
  }
}

function textResult(text: string): LlmResult {
  return {
    type: "text",
    text,
    model: "queue:test",
    usage: { inputTokens: 10, outputTokens: 4 },
    latencyMs: 5,
  };
}

function toolResult(
  toolCalls: Array<{ toolCallId: string; toolName: string; input: Record<string, unknown> }>,
  text?: string,
): LlmResult {
  return {
    type: "tool_use",
    toolCalls,
    ...(text ? { text } : {}),
    model: "queue:test",
    usage: { inputTokens: 10, outputTokens: 4 },
    latencyMs: 5,
  };
}

function makeTool(
  name: string,
  behaviour: {
    outcome?: "succeeded" | "failed";
    result?: unknown;
    error?: string;
    terminal?: boolean;
    latencyMs?: number;
  } = {},
): RegisteredTool {
  return {
    schema: {
      name,
      description: `Test tool ${name}`,
      input_schema: { type: "object", properties: {}, required: [] },
    },
    execute: vi.fn(async () => ({
      outcome: behaviour.outcome ?? "succeeded",
      result: behaviour.result ?? { ok: true },
      ...(behaviour.error ? { error: behaviour.error } : {}),
      latencyMs: behaviour.latencyMs ?? 3,
    })),
    ...(behaviour.terminal ? { terminal: true } : {}),
  };
}

function buildDeps(
  llm: LlmAdapter,
  sink: EventSink,
  tools: Record<string, RegisteredTool>,
  overrides: Partial<HandleMessageDeps> = {},
): HandleMessageDeps {
  return {
    llm,
    sink,
    buildTools: async () => tools,
    agent: agentConfig,
    history: new InMemoryHistoryStore(),
    now: () => "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

const inputBase = {
  conversationId: "CHtest",
  message: "hi",
  memory: undefined,
  session: { authorInfo: { address: "+15555550100" } } as never,
  channel: "chat" as const,
  from: "+15555550100",
};

describe("handleMessage", () => {
  let sink: RecordingSink;
  let llm: QueueLlm;

  beforeEach(() => {
    sink = new RecordingSink();
    llm = new QueueLlm();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("short-circuits on immediate text response (0 tool cycles)", async () => {
    llm.enqueue(textResult("Hi there!"));
    const deps = buildDeps(llm, sink, {});
    const result = await handleMessage(deps, inputBase);
    expect(result).toBe("Hi there!");
    expect(sink.ofType("llm.completed")).toHaveLength(1);
    expect(sink.ofType("tool.called")).toHaveLength(0);
    expect(sink.ofType("message.sent")[0]!.message).toBe("Hi there!");
  });

  it("runs a single-tool cycle then text (2 LLM turns)", async () => {
    llm.enqueue(
      toolResult([{ toolCallId: "call_1", toolName: "lookup", input: { id: "A" } }]),
      textResult("Your order shipped."),
    );
    const tools = { lookup: makeTool("lookup", { result: { status: "shipped" } }) };
    const result = await handleMessage(buildDeps(llm, sink, tools), inputBase);
    expect(result).toBe("Your order shipped.");
    expect(sink.ofType("llm.completed")).toHaveLength(2);
    expect(sink.ofType("tool.called")).toHaveLength(1);
    expect(sink.ofType("tool.result")).toHaveLength(1);
    expect(sink.ofType("tool.result")[0]!.result).toContain("shipped");
    expect(tools.lookup.execute).toHaveBeenCalledOnce();
  });

  it("executes a parallel batch concurrently (2 tools in one turn)", async () => {
    llm.enqueue(
      toolResult([
        { toolCallId: "c1", toolName: "kb_search", input: { q: "policy" } },
        { toolCallId: "c2", toolName: "lookup_order", input: { id: "A-1" } },
      ]),
      textResult("Here's your answer."),
    );
    const tools = {
      kb_search: makeTool("kb_search", { result: { chunks: [] } }),
      lookup_order: makeTool("lookup_order", { result: { status: "ok" } }),
    };
    const result = await handleMessage(buildDeps(llm, sink, tools), inputBase);
    expect(result).toBe("Here's your answer.");
    expect(sink.ofType("tool.called")).toHaveLength(2);
    expect(sink.ofType("tool.result")).toHaveLength(2);
    expect(tools.kb_search.execute).toHaveBeenCalledOnce();
    expect(tools.lookup_order.execute).toHaveBeenCalledOnce();
  });

  it("feeds a structured {error} object back to the LLM on tool failure", async () => {
    llm.enqueue(
      toolResult([{ toolCallId: "c1", toolName: "flakey", input: {} }]),
      textResult("I hit an error, sorry."),
    );
    const tools = {
      flakey: makeTool("flakey", { outcome: "failed", error: "backend_5xx" }),
    };
    await handleMessage(buildDeps(llm, sink, tools), inputBase);
    const result = sink.ofType("tool.result")[0]!;
    expect(result.result).toContain('"error":"backend_5xx"');
    expect(result.result).toContain('"tool":"flakey"');
    const toolCalled = sink.ofType("tool.called")[0]!;
    expect(toolCalled.outcome).toBe("failed");
    expect(toolCalled.error).toBe("backend_5xx");
  });

  it("in a mixed batch, executes ONLY the terminal tool and stops the loop", async () => {
    llm.enqueue(
      toolResult([
        { toolCallId: "c_other", toolName: "lookup", input: {} },
        { toolCallId: "c_handoff", toolName: "handoff", input: { reason: "customer_request" } },
      ]),
    );
    const tools = {
      lookup: makeTool("lookup"),
      handoff: makeTool("handoff", { terminal: true }),
    };
    const result = await handleMessage(buildDeps(llm, sink, tools), inputBase);
    expect(result).toBe(agentConfig.loop.handoffFarewell);
    expect(tools.handoff.execute).toHaveBeenCalledOnce();
    expect(tools.lookup.execute).not.toHaveBeenCalled();
    expect(sink.ofType("llm.completed")).toHaveLength(1);
  });

  it("returns cycleCapFallback when the loop runs out of cycles without text", async () => {
    for (let i = 0; i < agentConfig.loop.maxCycles; i++) {
      llm.enqueue(toolResult([{ toolCallId: `c${i}`, toolName: "lookup", input: {} }]));
    }
    const tools = { lookup: makeTool("lookup") };
    const result = await handleMessage(buildDeps(llm, sink, tools), inputBase);
    expect(result).toBe(agentConfig.loop.cycleCapFallback);
    expect(tools.lookup.execute).toHaveBeenCalledTimes(agentConfig.loop.maxCycles);
    expect(sink.ofType("llm.completed")).toHaveLength(agentConfig.loop.maxCycles);
  });

  it("caps stored history to maxHistoryTurns pairs (rolling window)", async () => {
    const history = new InMemoryHistoryStore();
    const deps = buildDeps(llm, sink, {}, { history });

    for (let i = 0; i < agentConfig.loop.maxHistoryTurns + 2; i++) {
      llm.enqueue(textResult(`response ${i}`));
      await handleMessage(deps, { ...inputBase, message: `msg ${i}` });
    }

    const stored = history.get(inputBase.conversationId);
    // maxHistoryTurns=3 pairs = 6 entries max
    expect(stored.length).toBeLessThanOrEqual(agentConfig.loop.maxHistoryTurns * 2);
    expect(stored[stored.length - 1]!.content).toBe("response 4");
  });

  it("returns timeoutFallback and emits message.sent when the turn exceeds turnTimeoutMs", async () => {
    // LLM never resolves — will trigger the timeout race
    const hangingLlm: LlmAdapter = {
      id: "hang:test",
      respond: () => new Promise(() => {}),
    };
    const deps = buildDeps(hangingLlm, sink, {});
    const result = await handleMessage(deps, inputBase);
    expect(result).toBe(agentConfig.loop.timeoutFallback);
    expect(sink.ofType("message.sent").at(-1)!.message).toBe(agentConfig.loop.timeoutFallback);
  });

  it("handles unknown tool references gracefully (feeds {error} back, keeps loop alive)", async () => {
    llm.enqueue(
      toolResult([{ toolCallId: "c1", toolName: "made_up_tool", input: {} }]),
      textResult("I couldn't do that."),
    );
    const result = await handleMessage(buildDeps(llm, sink, {}), inputBase);
    expect(result).toBe("I couldn't do that.");
    const toolCalled = sink.ofType("tool.called")[0]!;
    expect(toolCalled.outcome).toBe("failed");
    expect(toolCalled.error).toContain("no handler");
  });
});
