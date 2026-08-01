/**
 * One-stop, typed configuration for the starter.
 *
 * Buyers change this file (and the values in `.env`) to re-skin the starter
 * for their own use case. Every knob a buyer cares about lives here — nothing
 * is scattered across the codebase.
 */

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
  };
  /** LLM adapter — swap the adapter file to swap providers. */
  llm: {
    provider: "anthropic";
    /** Reads from ANTHROPIC_MODEL if set; otherwise this default. */
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
      voice: false, // deferred to v1.1 — Voice needs ConversationRelay wiring
      sms: true,
      whatsapp: true,
      chat: true,
    },
    handoff: {
      enabled: true,
      studioFlowSidEnv: "TWILIO_STUDIO_HANDOFF_FLOW_SID",
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
