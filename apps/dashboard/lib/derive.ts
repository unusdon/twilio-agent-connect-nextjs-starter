import type { Channel, TacEvent } from "@tac-starter/shared";

/**
 * Best-effort customer display name from the observations Memory returned.
 * Recall observations are natural-language snippets; a name commonly appears
 * as "Customer name is X" or "X's account". If nothing matches, fall back to
 * the raw address (phone number, WhatsApp ID).
 */
export function deriveCustomerName(events: TacEvent[]): string | null {
  for (const e of events) {
    if (e.type !== "memory.recalled") continue;
    for (const o of e.observations) {
      const nameMatch = o.content.match(
        /(?:customer(?:\s+name)?\s+is|name:)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/i,
      );
      if (nameMatch?.[1]) return nameMatch[1];
    }
  }
  return null;
}

export function deriveCustomerAddress(events: TacEvent[]): string | null {
  const inbound = events.find(
    (e): e is Extract<TacEvent, { type: "message.received" }> =>
      e.type === "message.received",
  );
  return inbound?.from ?? null;
}

export type ConversationStatus =
  | { kind: "handoff"; at: string }
  | { kind: "active"; lastAt: string }
  | { kind: "idle"; lastAt: string };

export function deriveStatus(events: TacEvent[]): ConversationStatus {
  const handoff = events.find(
    (e): e is Extract<TacEvent, { type: "tool.called" }> =>
      e.type === "tool.called" && e.tool === "handoff" && e.outcome === "succeeded",
  );
  if (handoff) return { kind: "handoff", at: handoff.timestamp };

  const last = events[events.length - 1];
  const lastAt = last?.timestamp ?? "";
  const ageMs = last ? Date.now() - new Date(lastAt).getTime() : 0;
  return ageMs < 5 * 60_000
    ? { kind: "active", lastAt }
    : { kind: "idle", lastAt };
}

/** Average LLM latency across the conversation, milliseconds. */
export function averageLlmLatency(events: TacEvent[]): number | null {
  const latencies = events
    .filter((e): e is Extract<TacEvent, { type: "llm.completed" }> => e.type === "llm.completed")
    .map((e) => e.latencyMs);
  if (latencies.length === 0) return null;
  return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
}

export function turnCount(events: TacEvent[]): number {
  return events.filter((e) => e.type === "message.sent").length;
}

/** Total tokens across all LLM calls in this conversation. */
export function totalTokens(events: TacEvent[]): { input: number; output: number; cacheRead: number } {
  return events
    .filter((e): e is Extract<TacEvent, { type: "llm.completed" }> => e.type === "llm.completed")
    .reduce(
      (acc, e) => ({
        input: acc.input + e.usage.inputTokens,
        output: acc.output + e.usage.outputTokens,
        cacheRead: acc.cacheRead + (e.usage.cacheReadTokens ?? 0),
      }),
      { input: 0, output: 0, cacheRead: 0 },
    );
}

export const channelLabel: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  chat: "Chat",
  voice: "Voice",
};

/** Relative-time formatter with "just now", "3m", "2h", or ISO date. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  if (diff < 30_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
