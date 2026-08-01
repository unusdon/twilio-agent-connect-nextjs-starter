import Link from "next/link";
import { loadEvents } from "@/lib/event-source";
import {
  averageLlmLatency,
  channelLabel,
  deriveCustomerAddress,
  deriveCustomerName,
  deriveStatus,
  formatRelative,
  totalTokens,
  turnCount,
} from "@/lib/derive";
import { ArrowRightIcon, ChannelIcon } from "./icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const events = await loadEvents();
  const byConv = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byConv.get(e.conversationId) ?? [];
    arr.push(e);
    byConv.set(e.conversationId, arr);
  }
  const conversations = [...byConv.entries()]
    .map(([id, evs]) => ({
      id,
      events: evs.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }))
    .sort((a, b) =>
      (b.events[b.events.length - 1]?.timestamp ?? "").localeCompare(
        a.events[a.events.length - 1]?.timestamp ?? "",
      ),
    );

  if (conversations.length === 0) return <EmptyState />;

  const allTokens = events.reduce(
    (acc, e) =>
      e.type === "llm.completed"
        ? {
            in: acc.in + e.usage.inputTokens,
            out: acc.out + e.usage.outputTokens,
            cache: acc.cache + (e.usage.cacheReadTokens ?? 0),
          }
        : acc,
    { in: 0, out: 0, cache: 0 },
  );
  const avgLatency = averageLlmLatency(events);
  const handoffs = events.filter(
    (e) => e.type === "tool.called" && e.tool === "handoff",
  ).length;
  const cacheHitRatio =
    allTokens.in > 0 ? Math.round((allTokens.cache / allTokens.in) * 100) : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Events" value={events.length.toString()} />
        <MetricCard label="Conversations" value={conversations.length.toString()} />
        <MetricCard
          label="Avg LLM latency"
          value={avgLatency ? `${avgLatency}ms` : "—"}
        />
        <MetricCard
          label="Cache hit ratio"
          value={`${cacheHitRatio}%`}
          hint={handoffs > 0 ? `${handoffs} handoff${handoffs === 1 ? "" : "s"}` : undefined}
        />
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Conversations</h1>
          <span className="text-xs text-muted">most recent first</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {conversations.map((c) => (
            <ConversationCard key={c.id} id={c.id} events={c.events} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4 shadow-panel">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
    </div>
  );
}

function ConversationCard({
  id,
  events,
}: {
  id: string;
  events: Awaited<ReturnType<typeof loadEvents>>;
}) {
  const first = events[0];
  const last = events[events.length - 1];
  if (!first || !last) return null;

  const name = deriveCustomerName(events) ?? "Unknown";
  const address = deriveCustomerAddress(events) ?? "";
  const status = deriveStatus(events);
  const turns = turnCount(events);
  const tokens = totalTokens(events);
  const lastInbound = [...events]
    .reverse()
    .find((e): e is Extract<typeof last, { type: "message.received" }> => e.type === "message.received");
  const initial = name.charAt(0).toUpperCase();

  const statusPill =
    status.kind === "handoff" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> handoff
      </span>
    ) : status.kind === "active" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> idle
      </span>
    );

  return (
    <Link
      href={`/conversations/${id}`}
      className="group block rounded-xl border border-border bg-panel p-4 shadow-panel transition hover:border-border-strong hover:shadow-raised"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate font-semibold">{name}</div>
            <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
              <ChannelIcon channel={first.channel} className="h-3 w-3" />
              {channelLabel[first.channel]}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-xs text-muted">{address}</div>
          {lastInbound && (
            <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
              &ldquo;{lastInbound.message}&rdquo;
            </p>
          )}
        </div>
        <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
        <div className="flex items-center gap-3">
          <span>
            <span className="font-medium text-text">{turns}</span> turn{turns === 1 ? "" : "s"}
          </span>
          <span>
            <span className="font-medium text-text tabular-nums">
              {(tokens.input + tokens.output).toLocaleString()}
            </span>{" "}
            tokens
          </span>
          {tokens.cacheRead > 0 && (
            <span>
              cache{" "}
              <span className="font-medium text-text tabular-nums">
                {Math.round((tokens.cacheRead / tokens.input) * 100)}%
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {statusPill}
          <span>{formatRelative(last.timestamp)}</span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="animate-fade-in rounded-2xl border border-dashed border-border bg-panel p-12 text-center shadow-panel">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 text-accent"
        >
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold">No events yet.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        The dashboard is in live mode but no events have been written to the agent log yet.
        Start the agent (<code className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs">
          npm run dev:agent
        </code>
        ) and send it a test message, or switch to demo mode with{" "}
        <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs">
          DASHBOARD_MODE=demo
        </code>
        .
      </p>
    </div>
  );
}
