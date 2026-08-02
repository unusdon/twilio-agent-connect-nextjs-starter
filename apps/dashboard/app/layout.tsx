import type { Metadata } from "next";
import Link from "next/link";
import { defaultConfig, defaultModelPerProvider, type LlmProvider } from "@tac-starter/shared";
import { ThemeToggle, themeBootstrapScript } from "./theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAC + Claude Starter — Observability",
  description:
    "Live conversation traces, memory recalls, and LLM turn inspection for the twilio-agent-connect-nextjs-starter.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-20 border-b border-border bg-panel/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-panel"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M12 2l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 9l6-1 3-6z" />
                </svg>
              </span>
              <div>
                <div className="text-sm font-semibold leading-tight tracking-tight">
                  TAC Agent Starter
                </div>
                <div className="text-xs leading-tight text-muted">Multi-LLM · Observability</div>
              </div>
            </Link>
            <nav className="ml-auto flex items-center gap-1 pr-3">
              <Link
                href="/"
                className="rounded-md px-2.5 py-1.5 text-sm text-muted transition hover:bg-panel-hover hover:text-text"
              >
                Traces
              </Link>
              <Link
                href="/config"
                className="rounded-md px-2.5 py-1.5 text-sm text-muted transition hover:bg-panel-hover hover:text-text"
              >
                Config
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <ProviderBadge />
              <ModeBadge />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted">
            twilio-agent-connect-nextjs-starter · MIT · built on{" "}
            <a
              href="https://github.com/twilio/twilio-agent-connect-typescript"
              className="text-accent hover:underline"
            >
              twilio-agent-connect
            </a>{" "}
            · 5 LLM providers (Anthropic · OpenAI · Gemini · Ollama · LM Studio)
          </div>
        </footer>
      </body>
    </html>
  );
}

const MODEL_ENV_PER_PROVIDER: Record<LlmProvider, string> = {
  anthropic: "ANTHROPIC_MODEL",
  openai: "OPENAI_MODEL",
  gemini: "GEMINI_MODEL",
  ollama: "OLLAMA_MODEL",
  lmstudio: "LMSTUDIO_MODEL",
};

function ProviderBadge() {
  const provider =
    (process.env["LLM_PROVIDER"] as LlmProvider | undefined) ?? defaultConfig.llm.provider;
  const model = process.env[MODEL_ENV_PER_PROVIDER[provider]] ?? defaultModelPerProvider[provider];
  return (
    <Link
      href="/config"
      className="hidden items-center gap-1.5 rounded-full border border-border bg-panel px-2.5 py-1 font-mono text-[11px] text-muted transition hover:border-border-strong hover:text-text sm:inline-flex"
      title="Active LLM provider — click to see the full provider matrix"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="text-text-secondary">{provider}</span>
      <span className="text-muted">·</span>
      <span>{model}</span>
    </Link>
  );
}

function ModeBadge() {
  const mode = process.env["DASHBOARD_MODE"] ?? "demo";
  const isDemo = mode === "demo";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        isDemo
          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isDemo ? "bg-amber-500" : "animate-pulse bg-emerald-500"
        }`}
      />
      {isDemo ? "demo mode" : "live"}
    </span>
  );
}
