import { defaultConfig } from "@tac-starter/shared";

export const dynamic = "force-dynamic";

/**
 * Effective config, read-only. The dashboard displays the shared
 * `defaultConfig` from `packages/shared/src/config.ts` — buyers change
 * behaviour by editing that file (or the local override in
 * `apps/agent/src/config.ts`) and rebooting, not through this UI.
 * Kept read-only on purpose: config changes should live in source
 * control, not in the running app.
 */

const REQUIRED_ENV: Array<{ key: string; role: string; required: boolean }> = [
  { key: "TWILIO_ACCOUNT_SID", role: "Twilio account credentials", required: true },
  { key: "TWILIO_AUTH_TOKEN", role: "Twilio account credentials", required: true },
  {
    key: "TAC_MEMORY_STORE_SID",
    role: "TAC Memory Store (provisioned via Twilio Console)",
    required: true,
  },
  {
    key: "TAC_CONVERSATION_CONFIGURATION_SID",
    role: "TAC Conversation Configuration",
    required: true,
  },
  { key: "TAC_PUBLIC_URL", role: "Public webhook target (ngrok in dev)", required: true },
  { key: "ANTHROPIC_API_KEY", role: "Claude LLM backbone", required: true },
  { key: "ANTHROPIC_MODEL", role: "Claude model override (defaults to config)", required: false },
  { key: "AGENT_PORT", role: "Agent HTTP port (default 3001)", required: false },
  {
    key: "AGENT_EVENT_LOG",
    role: "Where the agent writes the JSONL event log",
    required: false,
  },
  { key: "DASHBOARD_MODE", role: "\"demo\" for fixtures, \"live\" to tail agent log", required: false },
  {
    key: "TWILIO_STUDIO_HANDOFF_FLOW_SID",
    role: "Studio Flow SID for human handoff (optional)",
    required: false,
  },
];

export default function ConfigPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Effective configuration</h1>
        <p className="mt-1 text-sm text-muted">
          Read-only view of the starter&rsquo;s runtime configuration and env-var status.
          Change behaviour by editing{" "}
          <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs text-text-secondary">
            packages/shared/src/config.ts
          </code>{" "}
          (defaults) or{" "}
          <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs text-text-secondary">
            apps/agent/src/config.ts
          </code>{" "}
          (local overrides), then restart the agent.
        </p>
      </header>

      <Section title="Agent">
        <KV k="name" v={defaultConfig.agent.name} />
        <KV
          k="systemInstructions"
          v={defaultConfig.agent.systemInstructions}
          block
        />
        <KV
          k="channels"
          v={
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(defaultConfig.agent.channels).map(([name, on]) => (
                <span
                  key={name}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
                    on
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "bg-slate-100 text-muted line-through dark:bg-slate-800"
                  }`}
                >
                  {name}
                </span>
              ))}
            </div>
          }
        />
        <KV
          k="handoff.enabled"
          v={defaultConfig.agent.handoff.enabled ? "true" : "false"}
        />
        <KV
          k="handoff.studioFlowSidEnv"
          v={defaultConfig.agent.handoff.studioFlowSidEnv}
          mono
        />
      </Section>

      <Section title="LLM">
        <KV k="provider" v={defaultConfig.llm.provider} />
        <KV
          k="defaultModel"
          v={process.env["ANTHROPIC_MODEL"] ?? defaultConfig.llm.defaultModel}
          mono
          note={
            process.env["ANTHROPIC_MODEL"]
              ? "overridden via ANTHROPIC_MODEL"
              : "using config default"
          }
        />
        <KV k="maxTokens" v={defaultConfig.llm.maxTokens.toString()} />
        <KV k="temperature" v={defaultConfig.llm.temperature.toString()} />
      </Section>

      <Section title="Observability">
        <KV k="sink" v={defaultConfig.observability.sink} />
        <KV
          k="filePath"
          v={process.env["AGENT_EVENT_LOG"] ?? defaultConfig.observability.filePath}
          mono
          note={
            process.env["AGENT_EVENT_LOG"]
              ? "overridden via AGENT_EVENT_LOG"
              : "using config default"
          }
        />
        <KV
          k="memoryRingSize"
          v={defaultConfig.observability.memoryRingSize.toString()}
        />
        <KV
          k="dashboard.mode"
          v={process.env["DASHBOARD_MODE"] ?? "demo"}
          mono
        />
      </Section>

      <Section title="Environment variables">
        <div className="divide-y divide-border">
          {REQUIRED_ENV.map((row) => {
            const value = process.env[row.key];
            const present = value !== undefined && value !== "";
            return (
              <div key={row.key} className="flex items-start gap-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm text-text-secondary">{row.key}</code>
                    {row.required && (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-900 dark:bg-rose-900/40 dark:text-rose-200">
                        required
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{row.role}</div>
                </div>
                <div className="shrink-0">
                  {present ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      set
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.required
                          ? "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          row.required ? "bg-rose-500" : "bg-slate-400"
                        }`}
                      />
                      missing
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="rounded-xl border border-border bg-panel p-4 shadow-panel">
        <div className="text-sm font-medium">Validate before you run</div>
        <p className="mt-1 text-xs text-muted">
          Once your <code className="font-mono">.env</code> is filled in, run{" "}
          <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs text-text-secondary">
            npm run setup:check
          </code>{" "}
          from the repo root. It pings the Twilio + Anthropic APIs to confirm credentials
          authenticate before the agent tries to start.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-panel shadow-panel">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {title}
        </h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function KV({
  k,
  v,
  mono,
  block,
  note,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
  block?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`flex items-start gap-4 py-2 ${
        block ? "flex-col sm:flex-row" : ""
      }`}
    >
      <div className="w-48 shrink-0 font-mono text-xs text-muted">{k}</div>
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm ${mono ? "font-mono text-text-secondary" : "text-text"} ${
            block ? "whitespace-pre-wrap leading-relaxed" : ""
          }`}
        >
          {v}
        </div>
        {note && <div className="mt-0.5 text-[11px] text-muted">{note}</div>}
      </div>
    </div>
  );
}
