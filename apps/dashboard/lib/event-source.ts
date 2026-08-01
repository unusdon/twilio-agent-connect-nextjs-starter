import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { TacEvent } from "@tac-starter/shared";
import { demoEvents } from "./fixtures";

/**
 * Anchor relative paths at the monorepo root so the dashboard reads the same
 * file the agent writes — regardless of which workspace cwd Next.js is running
 * under. `npm_config_local_prefix` is exported by npm for every workspace script.
 */
function repoRootAnchor(): string {
  return process.env["npm_config_local_prefix"] ?? resolve(process.cwd(), "../..");
}

/**
 * Load all observability events for the current dashboard session.
 *
 * `DASHBOARD_MODE=demo` returns fixtures so the dashboard is instantly usable
 * without any Twilio setup. `DASHBOARD_MODE=live` tails the JSONL file the
 * agent writes to (path from `AGENT_EVENT_LOG` env or the default in config).
 *
 * Kept as an unadorned server-only async function — every page/component that
 * needs events calls this. Small enough that a fancier event bus isn't warranted.
 */
export async function loadEvents(): Promise<TacEvent[]> {
  const mode = process.env["DASHBOARD_MODE"] ?? "demo";
  if (mode === "demo") return [...demoEvents];

  const configured = process.env["AGENT_EVENT_LOG"] ?? "./data/events.jsonl";
  const logPath = isAbsolute(configured) ? configured : resolve(repoRootAnchor(), configured);

  try {
    const raw = await readFile(logPath, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TacEvent);
  } catch (err) {
    // No log file yet is a normal early state — return empty rather than throw
    // so the UI can render its own empty-state message.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export interface ConversationSummary {
  conversationId: string;
  channel: TacEvent["channel"];
  eventCount: number;
  firstAt: string;
  lastAt: string;
  lastMessage?: string;
}

export function summariseByConversation(events: TacEvent[]): ConversationSummary[] {
  const groups = new Map<string, TacEvent[]>();
  for (const e of events) {
    const arr = groups.get(e.conversationId) ?? [];
    arr.push(e);
    groups.set(e.conversationId, arr);
  }
  return [...groups.entries()]
    .map(([conversationId, evs]): ConversationSummary => {
      const sorted = evs.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const lastInbound = [...sorted]
        .reverse()
        .find((e): e is Extract<TacEvent, { type: "message.received" }> => e.type === "message.received");
      return {
        conversationId,
        channel: first?.channel ?? "chat",
        eventCount: sorted.length,
        firstAt: first?.timestamp ?? "",
        lastAt: last?.timestamp ?? "",
        lastMessage: lastInbound?.message,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
