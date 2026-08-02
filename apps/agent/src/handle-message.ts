import type { ConversationSession, TACMemoryResponse } from "twilio-agent-connect";
import { MemoryPromptBuilder } from "twilio-agent-connect";
import type { Channel, StarterConfig, TacEvent } from "@tac-starter/shared";
import type { EventSink } from "./event-sink.js";
import type { ConvItem, LlmAdapter, LlmTool } from "./llm-types.js";
import type { RegisteredTool } from "./tools.js";

/**
 * Per-conversation transcript store. In-memory Map is the production default;
 * tests inject a mock; multi-instance deployments swap for a Redis-backed
 * implementation (same interface).
 */
export interface HistoryStore {
  get(conversationId: string): HistoryEntry[];
  set(conversationId: string, history: HistoryEntry[]): void;
  delete(conversationId: string): void;
}

export type HistoryEntry = { role: "user" | "assistant"; content: string };

export class InMemoryHistoryStore implements HistoryStore {
  private readonly store = new Map<string, HistoryEntry[]>();
  get(id: string): HistoryEntry[] {
    return this.store.get(id) ?? [];
  }
  set(id: string, history: HistoryEntry[]): void {
    this.store.set(id, history);
  }
  delete(id: string): void {
    this.store.delete(id);
  }
}

export interface HandleMessageDeps {
  llm: LlmAdapter;
  sink: EventSink;
  buildTools: (session: ConversationSession) => Promise<Record<string, RegisteredTool>>;
  agent: StarterConfig["agent"];
  history: HistoryStore;
  /** Test seam — override to freeze timestamps. */
  now?: () => string;
}

export interface HandleMessageInput {
  conversationId: string;
  message: string;
  memory: TACMemoryResponse | undefined;
  session: ConversationSession;
  channel: Channel;
  from: string;
}

/**
 * Orchestrates one customer message end-to-end: memory recall observability,
 * tool-loop until final text or terminal tool, timeout enforcement, history
 * cap, and event emission. Returns the text to send back (or null for voice
 * handoff, where Studio takes over the audio path).
 */
export async function handleMessage(
  deps: HandleMessageDeps,
  input: HandleMessageInput,
): Promise<string | null> {
  const timeoutMs = deps.agent.loop.turnTimeoutMs;
  const timeoutFallback = deps.agent.loop.timeoutFallback;

  // Wrap the whole run in a timeout so a hung LLM / tool doesn't stall a
  // channel indefinitely. The fallback text keeps the customer informed.
  const TIMEOUT_SENTINEL = Symbol("timeout");
  const timeoutHandle = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
    setTimeout(() => resolve(TIMEOUT_SENTINEL), timeoutMs).unref?.();
  });

  const winner = await Promise.race([runLoop(deps, input), timeoutHandle]);

  if (winner === TIMEOUT_SENTINEL) {
    const now = deps.now?.() ?? new Date().toISOString();
    await deps.sink.emit({
      type: "message.sent",
      timestamp: now,
      conversationId: input.conversationId,
      channel: input.channel,
      message: timeoutFallback,
    });
    return timeoutFallback;
  }

  return winner;
}

async function runLoop(
  deps: HandleMessageDeps,
  input: HandleMessageInput,
): Promise<string | null> {
  const now = () => deps.now?.() ?? new Date().toISOString();
  const { agent } = deps;
  const { conversationId, message, memory, session, channel, from } = input;

  await deps.sink.emit({
    type: "message.received",
    timestamp: now(),
    conversationId,
    channel,
    message,
    from,
  });

  const systemPrompt = MemoryPromptBuilder.compose(
    agent.systemInstructions,
    memory,
    session,
  );

  if (memory) {
    const observations = memory.observations;
    await deps.sink.emit({
      type: "memory.recalled",
      timestamp: now(),
      conversationId,
      channel,
      query: message,
      observationCount: observations.length,
      observations: observations.slice(0, 10).map((o) => ({
        content: o.content,
        occurredAt: o.occurredAt,
      })),
      latencyMs: null,
    });
  }

  const tools = await deps.buildTools(session);
  const toolSchemas: LlmTool[] = Object.values(tools).map((t) => t.schema);

  const history = deps.history.get(conversationId);
  const conv: ConvItem[] = [
    ...history.map((h) => ({ role: h.role, content: h.content }) as ConvItem),
    { role: "user", content: message },
  ];

  let final: string | null = null;

  for (let cycle = 0; cycle < agent.loop.maxCycles; cycle++) {
    const result = await deps.llm.respond({
      systemPrompt,
      conversation: conv,
      ...(toolSchemas.length > 0 ? { tools: toolSchemas } : {}),
    });

    await deps.sink.emit({
      type: "llm.completed",
      timestamp: now(),
      conversationId,
      channel,
      cycleDepth: cycle,
      model: result.model,
      response: result.type === "text" ? result.text : (result.text ?? ""),
      invokedTool: result.type === "tool_use",
      usage: result.usage,
      latencyMs: result.latencyMs,
    });

    if (result.type === "text") {
      final = result.text;
      break;
    }

    // ── Tool batch execution ────────────────────────────────────────────
    // If a terminal tool is in the batch, execute only that one and stop.
    // Otherwise execute all in parallel.
    const terminalIdx = result.toolCalls.findIndex(
      (tc) => tools[tc.toolName]?.terminal === true,
    );
    const batch =
      terminalIdx >= 0 ? [result.toolCalls[terminalIdx]!] : result.toolCalls;

    const executions = await Promise.all(
      batch.map(async (tc) => {
        const tool = tools[tc.toolName];
        if (!tool) {
          return {
            tc,
            execution: {
              outcome: "failed" as const,
              result: null,
              error: `no handler registered for tool "${tc.toolName}"`,
              latencyMs: 0,
            },
          };
        }
        const execution = await tool.execute(tc.input);
        return { tc, execution };
      }),
    );

    // Emit tool.called + tool.result per execution, in order.
    for (const { tc, execution } of executions) {
      await deps.sink.emit({
        type: "tool.called",
        timestamp: now(),
        conversationId,
        channel,
        cycleDepth: cycle,
        toolCallId: tc.toolCallId,
        tool: tc.toolName,
        input: tc.input,
        outcome: execution.outcome,
        latencyMs: execution.latencyMs,
        ...(execution.error ? { error: execution.error } : {}),
      });
    }

    // Terminal short-circuit — no result feedback, farewell handled by caller.
    if (terminalIdx >= 0) {
      const terminalCall = batch[0]!;
      const farewell = channel === "voice" ? null : agent.loop.handoffFarewell;
      if (farewell) {
        history.push({ role: "user", content: message });
        history.push({ role: "assistant", content: farewell });
        capAndStore(deps, conversationId, history);
        await deps.sink.emit({
          type: "message.sent",
          timestamp: now(),
          conversationId,
          channel,
          message: farewell,
        });
      }
      // Silence the unused-var warning; we may want to log the terminal tool
      // name in a future release.
      void terminalCall;
      return farewell;
    }

    // Non-terminal: emit tool.result, push to conv, iterate.
    for (const { tc, execution } of executions) {
      const serialised = serialiseToolResult(execution, tc.toolName);
      await deps.sink.emit({
        type: "tool.result",
        timestamp: now(),
        conversationId,
        channel,
        cycleDepth: cycle,
        toolCallId: tc.toolCallId,
        tool: tc.toolName,
        result: truncate(serialised, 4000),
      });
    }

    conv.push({
      role: "assistant",
      toolCalls: batch.map((tc) => ({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        input: tc.input,
      })),
      ...(result.text ? { text: result.text } : {}),
    });
    for (const { tc, execution } of executions) {
      conv.push({
        role: "tool",
        toolCallId: tc.toolCallId,
        content: truncate(serialiseToolResult(execution, tc.toolName), 4000),
      });
    }
  }

  const responseText = final ?? agent.loop.cycleCapFallback;

  history.push({ role: "user", content: message });
  history.push({ role: "assistant", content: responseText });
  capAndStore(deps, conversationId, history);

  await deps.sink.emit({
    type: "message.sent",
    timestamp: now(),
    conversationId,
    channel,
    message: responseText,
  });

  return responseText;
}

function capAndStore(
  deps: HandleMessageDeps,
  conversationId: string,
  history: HistoryEntry[],
): void {
  const maxEntries = deps.agent.loop.maxHistoryTurns * 2; // pairs → entries
  if (history.length > maxEntries) {
    deps.history.set(conversationId, history.slice(-maxEntries));
  } else {
    deps.history.set(conversationId, history);
  }
}

function serialiseToolResult(
  execution: {
    outcome: "succeeded" | "failed";
    result: unknown;
    error?: string;
  },
  toolName: string,
): string {
  if (execution.outcome === "failed") {
    // Feed a structured error back to the LLM so it can reason about the
    // failure and try a different approach.
    return JSON.stringify({
      error: execution.error ?? "unknown_error",
      tool: toolName,
    });
  }
  if (typeof execution.result === "string") return execution.result;
  try {
    return JSON.stringify(execution.result);
  } catch {
    return String(execution.result);
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…[truncated]` : s;
}

/** Convenience narrowing helper for callers using the event union. */
export function isMessageSentEvent(
  e: TacEvent,
): e is Extract<TacEvent, { type: "message.sent" }> {
  return e.type === "message.sent";
}
