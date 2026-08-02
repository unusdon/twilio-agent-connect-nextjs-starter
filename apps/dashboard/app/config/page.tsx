import { defaultConfig, defaultModelPerProvider, llmProviders, type LlmProvider } from "@tac-starter/shared";

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
  { key: "LLM_PROVIDER", role: "Overrides the LLM provider from config", required: false },
  { key: "ANTHROPIC_API_KEY", role: "Required when LLM_PROVIDER=anthropic", required: false },
  { key: "ANTHROPIC_MODEL", role: "Anthropic model override", required: false },
  { key: "OPENAI_API_KEY", role: "Required when LLM_PROVIDER=openai", required: false },
  { key: "OPENAI_MODEL", role: "OpenAI model override", required: false },
  { key: "GEMINI_API_KEY", role: "Required when LLM_PROVIDER=gemini", required: false },
  { key: "GEMINI_MODEL", role: "Gemini model override", required: false },
  { key: "OLLAMA_BASE_URL", role: "Ollama endpoint (default localhost:11434/v1)", required: false },
  { key: "OLLAMA_MODEL", role: "Local Ollama model tag", required: false },
  { key: "LMSTUDIO_BASE_URL", role: "LM Studio endpoint (default localhost:1234/v1)", required: false },
  { key: "LMSTUDIO_MODEL", role: "Local LM Studio model", required: false },
  { key: "AGENT_PORT", role: "Agent HTTP port (default 3001)", required: false },
  {
    key: "AGENT_EVENT_LOG",
    role: "Where the agent writes the JSONL event log",
    required: false,
  },
  { key: "DASHBOARD_MODE", role: "\"demo\" for fixtures, \"live\" to tail agent log", required: false },
  {
    key: "TWILIO_STUDIO_HANDOFF_FLOW_SID",
    role: "Enables the handoff tool (Twilio Studio Flow SID)",
    required: false,
  },
  {
    key: "TAC_KNOWLEDGE_BASE_ID",
    role: "Enables the search_knowledge_base tool (RAG)",
    required: false,
  },
  {
    key: "TAC_ENABLE_MEMORY_RETRIEVAL_TOOL",
    role: "Enables the retrieve_profile_memory tool (set to 1)",
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
        <LlmProviderMatrix />
        <div className="mt-4 space-y-0 border-t border-border pt-3">
          <KV k="maxTokens" v={defaultConfig.llm.maxTokens.toString()} />
          <KV k="temperature" v={defaultConfig.llm.temperature.toString()} />
        </div>
      </Section>

      <Section title="Agent tools">
        <ToolsMatrix />
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

interface ToolRow {
  name: string;
  description: string;
  gateEnv: string;
  /** Human-readable value of the gate — e.g. "set to any value", "1", "SID". */
  gateHint: string;
  terminal?: boolean;
}

const TOOL_ROWS: ToolRow[] = [
  {
    name: "handoff",
    description: "Escalate the conversation to a human via a Twilio Studio Flow",
    gateEnv: "TWILIO_STUDIO_HANDOFF_FLOW_SID",
    gateHint: "Studio Flow SID (FWxxxx…)",
    terminal: true,
  },
  {
    name: "search_knowledge_base",
    description: "RAG search over a TAC Knowledge Base — auto-populated name/description",
    gateEnv: "TAC_KNOWLEDGE_BASE_ID",
    gateHint: "Knowledge Base ID from Twilio Console",
  },
  {
    name: "retrieve_profile_memory",
    description: "On-demand memory recall — for deeper lookups beyond the initial per-turn Recall",
    gateEnv: "TAC_ENABLE_MEMORY_RETRIEVAL_TOOL",
    gateHint: "set to 1",
  },
];

function ToolsMatrix() {
  return (
    <div>
      <div className="mb-3 text-[11px] text-muted">
        Built-in tools are opt-in via env vars — the tool is only exposed to the LLM
        when its gate is set. Add custom tools in{" "}
        <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs text-text-secondary">
          apps/agent/src/tools.ts
        </code>
        .
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        {TOOL_ROWS.map((row, i) => {
          const enabled = Boolean(process.env[row.gateEnv]);
          return (
            <div
              key={row.name}
              className={`flex items-start gap-3 px-3 py-2.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {enabled ? (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                    enabled
                  </span>
                ) : (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    off
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-text-secondary">{row.name}</span>
                  {row.terminal && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                      terminal
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted">{row.description}</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  gate: <span className="font-mono text-text-secondary">{row.gateEnv}</span> —{" "}
                  {row.gateHint}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ProviderRow {
  id: LlmProvider;
  label: string;
  modelEnv: string;
  keyEnv?: string;
  baseUrlEnv?: string;
  defaultBaseUrl?: string;
  isLocal: boolean;
}

const PROVIDER_ROWS: ProviderRow[] = [
  { id: "anthropic", label: "Anthropic (Claude)", modelEnv: "ANTHROPIC_MODEL", keyEnv: "ANTHROPIC_API_KEY", isLocal: false },
  { id: "openai", label: "OpenAI (GPT)", modelEnv: "OPENAI_MODEL", keyEnv: "OPENAI_API_KEY", isLocal: false },
  { id: "gemini", label: "Google Gemini", modelEnv: "GEMINI_MODEL", keyEnv: "GEMINI_API_KEY", isLocal: false },
  { id: "ollama", label: "Ollama (local)", modelEnv: "OLLAMA_MODEL", baseUrlEnv: "OLLAMA_BASE_URL", defaultBaseUrl: "http://localhost:11434/v1", isLocal: true },
  { id: "lmstudio", label: "LM Studio (local)", modelEnv: "LMSTUDIO_MODEL", baseUrlEnv: "LMSTUDIO_BASE_URL", defaultBaseUrl: "http://localhost:1234/v1", isLocal: true },
];

function LlmProviderMatrix() {
  const activeProvider =
    (process.env["LLM_PROVIDER"] as LlmProvider | undefined) ?? defaultConfig.llm.provider;
  const providerOverridden = Boolean(process.env["LLM_PROVIDER"]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            Active provider
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="rounded bg-accent-soft px-2 py-0.5 font-mono text-sm text-accent">
              {activeProvider}
            </span>
            <span className="font-mono text-sm text-muted">
              →{" "}
              {process.env[PROVIDER_ROWS.find((p) => p.id === activeProvider)?.modelEnv ?? ""] ??
                defaultModelPerProvider[activeProvider]}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {providerOverridden ? "overridden via LLM_PROVIDER" : "using config default"}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {llmProviders.map((provider, i) => {
          const row = PROVIDER_ROWS.find((p) => p.id === provider);
          if (!row) return null;
          const isActive = provider === activeProvider;
          const keySet = row.keyEnv ? Boolean(process.env[row.keyEnv]) : true; // local providers don't need a key
          const baseUrl = row.baseUrlEnv ? process.env[row.baseUrlEnv] ?? row.defaultBaseUrl : undefined;
          const model = process.env[row.modelEnv] ?? defaultModelPerProvider[provider];
          const isReady = row.isLocal ? true : keySet;

          return (
            <div
              key={provider}
              className={`flex items-start gap-3 px-3 py-2.5 ${
                i > 0 ? "border-t border-border" : ""
              } ${isActive ? "bg-accent-soft/40" : ""}`}
            >
              <div className="mt-0.5 shrink-0">
                {isActive ? (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    active
                  </span>
                ) : isReady ? (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                    ready
                  </span>
                ) : (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    not set up
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text-secondary">{provider}</span>
                  <span className="text-xs text-muted">·</span>
                  <span className="text-xs text-muted">{row.label}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
                  <span>
                    model:{" "}
                    <span className="font-mono text-text-secondary">{model}</span>
                  </span>
                  {baseUrl && (
                    <span>
                      base:{" "}
                      <span className="font-mono text-text-secondary">{baseUrl}</span>
                    </span>
                  )}
                  {row.keyEnv && (
                    <span>
                      <span className="font-mono">{row.keyEnv}</span>:{" "}
                      {keySet ? (
                        <span className="text-emerald-700 dark:text-emerald-400">set</span>
                      ) : (
                        <span className="text-rose-700 dark:text-rose-400">missing</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
