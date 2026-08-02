/**
 * One-stop, typed configuration for the starter.
 *
 * Buyers change this file (and the values in `.env`) to re-skin the starter
 * for their own use case. Every knob a buyer cares about lives here — nothing
 * is scattered across the codebase.
 */

export type LlmProvider =
  | "anthropic"
  | "openai"
  | "gemini"
  | "ollama"
  | "lmstudio";

export const llmProviders: readonly LlmProvider[] = [
  "anthropic",
  "openai",
  "gemini",
  "ollama",
  "lmstudio",
] as const;

/** Recommended default model per provider — override via env at runtime. */
export const defaultModelPerProvider: Record<LlmProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
  ollama: "llama3.2",
  lmstudio: "llama3.2",
};

export interface StarterConfig {
  /** The persona / system prompt the LLM uses on every turn. */
  agent: {
    name: string;
    /** Short — will be prefixed to the memory-composed system prompt. */
    systemInstructions: string;
    /** Which channels to register with TAC. */
    channels: {
      voice: boolean;
      sms: boolean;
      whatsapp: boolean;
      chat: boolean;
    };
    /** Escalate to a human via a Twilio Studio Flow when the LLM calls the handoff tool. */
    handoff: {
      enabled: boolean;
      /** Reads from TWILIO_STUDIO_HANDOFF_FLOW_SID at runtime. */
      studioFlowSidEnv: string;
    };
    /** Agentic runtime knobs. */
    loop: {
      /** Maximum LLM→tool→LLM cycles per customer message before we bail out. */
      maxCycles: number;
      /** Total ms budget for one customer message (across all cycles + tool exec). */
      turnTimeoutMs: number;
      /** Cap on assistant history pairs kept in memory per conversation. */
      maxHistoryTurns: number;
      /** Sent to the customer after a terminal handoff tool succeeds. */
      handoffFarewell: string;
      /** Sent when the tool loop runs out of cycles without a final text turn. */
      cycleCapFallback: string;
      /** Sent when the whole turn exceeds `turnTimeoutMs`. */
      timeoutFallback: string;
    };
  };
  /**
   * LLM adapter — five providers built in. Swap by editing `provider` here
   * (or set `LLM_PROVIDER` in `.env` to override without a code change).
   * Model defaults are per-provider; the adapter reads a provider-specific
   * env var (e.g. `OPENAI_MODEL`, `OLLAMA_MODEL`) at construction time.
   */
  llm: {
    provider: LlmProvider;
    /** Reads from the provider-specific env var if set; otherwise this default. */
    defaultModel: string;
    /** Max output tokens per turn. */
    maxTokens: number;
    /** Temperature for chat completions. */
    temperature: number;
  };
  /** Observability wiring — the dashboard reads from the event sink. */
  observability: {
    /**
     * "file" writes JSONL to disk; "memory" keeps events in-process only
     * (fine for a single agent+dashboard on the same machine); "none" disables.
     */
    sink: "file" | "memory" | "none";
    /** Only used when sink === "file". Path is resolved from repo root. */
    filePath: string;
    /** Maximum events to keep in the memory sink before evicting oldest. */
    memoryRingSize: number;
  };
}

export const defaultConfig: StarterConfig = {
  agent: {
    name: "Aria",
    systemInstructions:
      "You are Aria, a helpful assistant speaking with a customer over voice, SMS, or WhatsApp. " +
      "Keep responses short and conversational — a sentence or two. " +
      "Do not use markdown, asterisks, bullets, or emojis; your words will be spoken aloud or sent as plain text. " +
      "If the customer explicitly asks for a human, or you cannot adequately handle their request, invoke the handoff tool.",
    channels: {
      voice: true, // uses ConversationRelay (WebSocket streaming) under the hood
      sms: true,
      whatsapp: true,
      chat: true,
    },
    handoff: {
      enabled: true,
      studioFlowSidEnv: "TWILIO_STUDIO_HANDOFF_FLOW_SID",
    },
    loop: {
      maxCycles: 8,
      turnTimeoutMs: 45_000,
      maxHistoryTurns: 20,
      handoffFarewell:
        "Connecting you with a human agent now. Please hold — someone will be with you shortly.",
      cycleCapFallback:
        "Let me get back to you on that — I'm gathering the information now.",
      timeoutFallback:
        "Sorry, that's taking longer than expected on my end. Give me a moment and try again.",
    },
  },
  llm: {
    provider: "anthropic",
    defaultModel: "claude-sonnet-4-6",
    maxTokens: 512,
    temperature: 0.6,
  },
  observability: {
    sink: "file",
    filePath: "./data/events.jsonl",
    memoryRingSize: 500,
  },
};
