import Link from "next/link";
import { notFound } from "next/navigation";
import type { TacEvent } from "@tac-starter/shared";
import { loadEvents } from "@/lib/event-source";
import {
  channelLabel,
  deriveCustomerAddress,
  deriveCustomerName,
  deriveStatus,
} from "@/lib/derive";
import { ArrowRightIcon, ChannelIcon, EventIcon } from "@/app/icons";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function ConversationDetail({ params }: Params) {
  const { id } = await params;
  const events = (await loadEvents())
    .filter((e) => e.conversationId === id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (events.length === 0) notFound();

  const first = events[0]!;
  const name = deriveCustomerName(events) ?? "Unknown";
  const address = deriveCustomerAddress(events) ?? "";
  const status = deriveStatus(events);
  const initial = name.charAt(0).toUpperCase();

  // Compute latency scale for the timeline waterfall bars — longest LLM turn
  // sets the max width so bars are comparable within the conversation.
  const maxLatency = Math.max(
    1,
    ...events
      .filter((e): e is Extract<TacEvent, { type: "llm.completed" }> => e.type === "llm.completed")
      .map((e) => e.latencyMs),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent"
      >
        <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
        All conversations
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border border-border bg-panel p-6 shadow-panel">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
              <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent">
                <ChannelIcon channel={first.channel} className="h-3.5 w-3.5" />
                {channelLabel[first.channel]}
              </span>
              {status.kind === "handoff" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  handoff
                </span>
              )}
            </div>
            <div className="mt-1 font-mono text-xs text-muted">{address}</div>
            <div className="mt-1 font-mono text-xs text-muted">{id}</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <ol className="relative space-y-3 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-px before:bg-border">
        {events.map((e, i) => (
          <EventCard key={i} event={e} maxLatency={maxLatency} />
        ))}
      </ol>
    </div>
  );
}

function EventCard({ event, maxLatency }: { event: TacEvent; maxLatency: number }) {
  const time = new Date(event.timestamp).toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  const palette = eventPalette(event.type);

  return (
    <li className="relative flex gap-4 pl-1">
      {/* Timeline dot */}
      <div
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-panel"
        style={{
          background: `rgb(var(${palette.bg}))`,
          color: `rgb(var(${palette.fg}))`,
        }}
      >
        <EventIcon type={event.type} className="h-4 w-4" />
      </div>

      <div className="flex-1 rounded-xl border border-border bg-panel shadow-panel">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-xs font-medium"
              style={{
                background: `rgb(var(${palette.bg}))`,
                color: `rgb(var(${palette.fg}))`,
              }}
            >
              {event.type}
            </span>
          </div>
          <span className="font-mono text-[11px] text-muted tabular-nums">{time}</span>
        </div>
        <div className="px-4 py-3">
          <EventBody event={event} maxLatency={maxLatency} />
        </div>
      </div>
    </li>
  );
}

function eventPalette(type: TacEvent["type"]): { bg: string; fg: string } {
  switch (type) {
    case "message.received":
      return { bg: "--evt-message-bg", fg: "--evt-message-fg" };
    case "memory.recalled":
      return { bg: "--evt-memory-bg", fg: "--evt-memory-fg" };
    case "llm.completed":
      return { bg: "--evt-llm-bg", fg: "--evt-llm-fg" };
    case "tool.called":
      return { bg: "--evt-tool-bg", fg: "--evt-tool-fg" };
    case "message.sent":
      return { bg: "--evt-sent-bg", fg: "--evt-sent-fg" };
    case "rule.fired":
      return { bg: "--evt-rule-bg", fg: "--evt-rule-fg" };
  }
}

function EventBody({ event, maxLatency }: { event: TacEvent; maxLatency: number }) {
  switch (event.type) {
    case "message.received":
      return (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted">
            from <span className="font-mono normal-case text-text-secondary">{event.from}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">
            {event.message}
          </p>
        </div>
      );

    case "memory.recalled":
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
            <span>
              query:{" "}
              <span className="font-mono text-text-secondary">&ldquo;{event.query}&rdquo;</span>
            </span>
            <span className="tabular-nums">{event.observationCount ?? 0} observations</span>
            <span className="tabular-nums">
              {event.latencyMs === null ? "n/a" : `${event.latencyMs}ms`}
            </span>
          </div>
          {event.observations.length > 0 ? (
            <ul className="space-y-1.5">
              {event.observations.map((o, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                >
                  <span className="mt-0.5 shrink-0 rounded bg-panel px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div>{o.content}</div>
                    {o.occurredAt && (
                      <div className="mt-0.5 text-[11px] text-muted">
                        {new Date(o.occurredAt).toISOString().slice(0, 10)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted">(no observations returned)</div>
          )}
        </div>
      );

    case "llm.completed": {
      const barPct = Math.min(100, Math.round((event.latencyMs / maxLatency) * 100));
      const cacheHit =
        event.usage.cacheReadTokens !== undefined && event.usage.inputTokens > 0
          ? Math.round((event.usage.cacheReadTokens / event.usage.inputTokens) * 100)
          : null;
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            <span className="rounded bg-bg px-1.5 py-0.5 font-mono text-text-secondary">
              {event.model}
            </span>
            <span>
              in <span className="font-medium text-text tabular-nums">{event.usage.inputTokens}</span>
            </span>
            <span>
              out{" "}
              <span className="font-medium text-text tabular-nums">{event.usage.outputTokens}</span>
            </span>
            {cacheHit !== null && (
              <span>
                cache{" "}
                <span className="font-medium text-text tabular-nums">{cacheHit}%</span>
              </span>
            )}
            <span className="ml-auto tabular-nums">{event.latencyMs}ms</span>
          </div>
          {/* Latency waterfall bar */}
          <div className="relative h-1.5 overflow-hidden rounded-full bg-bg">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${barPct}%`,
                background: "rgb(var(--evt-llm-fg))",
                opacity: 0.7,
              }}
            />
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{event.response}</p>
        </div>
      );
    }

    case "tool.called":
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded bg-bg px-1.5 py-0.5 font-mono text-text-secondary">
              {event.tool}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${
                event.outcome === "succeeded"
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200"
              }`}
            >
              {event.outcome}
            </span>
            {event.error && <span className="text-muted">{event.error}</span>}
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-3 text-xs leading-relaxed">
            {JSON.stringify(event.input, null, 2)}
          </pre>
        </div>
      );

    case "message.sent":
      return <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{event.message}</p>;

    case "rule.fired":
      return (
        <div className="space-y-2">
          <div className="text-[11px] text-muted">
            rule:{" "}
            <span className="rounded bg-bg px-1.5 py-0.5 font-mono text-text-secondary">
              {event.ruleName}
            </span>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-3 text-xs leading-relaxed">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>
      );
  }
}
