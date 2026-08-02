import { defaultModelPerProvider, type LlmProvider, type StarterConfig } from "@tac-starter/shared";
import { AnthropicAdapter } from "./anthropic-adapter.js";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter.js";
import type { LlmAdapter } from "./llm-types.js";

/**
 * Build the LLM adapter for the configured provider. Providers dispatch to
 * either the Anthropic-native adapter (prompt caching enabled) or the shared
 * OpenAI-compatible adapter (GPT / Gemini / Ollama / LM Studio).
 *
 * Precedence for model name: env var → config default → provider default.
 * Precedence for provider: env var → config.
 */
export function createLlmAdapter(llm: StarterConfig["llm"]): LlmAdapter {
  const provider = (process.env["LLM_PROVIDER"] as LlmProvider | undefined) ?? llm.provider;
  const configuredModel = llm.defaultModel || defaultModelPerProvider[provider];

  switch (provider) {
    case "anthropic":
      return new AnthropicAdapter({
        ...llm,
        defaultModel: configuredModel,
      });

    case "openai": {
      const apiKey = process.env["OPENAI_API_KEY"];
      if (!apiKey) throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
      return new OpenAICompatibleAdapter(llm, {
        label: "openai",
        apiKey,
        model: process.env["OPENAI_MODEL"] ?? configuredModel,
      });
    }

    case "gemini": {
      const apiKey = process.env["GEMINI_API_KEY"];
      if (!apiKey) throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
      return new OpenAICompatibleAdapter(llm, {
        label: "gemini",
        baseURL:
          process.env["GEMINI_BASE_URL"] ??
          "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey,
        model: process.env["GEMINI_MODEL"] ?? configuredModel,
      });
    }

    case "ollama":
      return new OpenAICompatibleAdapter(llm, {
        label: "ollama",
        baseURL: process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434/v1",
        // Ollama ignores the API key but the openai SDK insists on one.
        apiKey: "ollama",
        model: process.env["OLLAMA_MODEL"] ?? configuredModel,
      });

    case "lmstudio":
      return new OpenAICompatibleAdapter(llm, {
        label: "lmstudio",
        baseURL: process.env["LMSTUDIO_BASE_URL"] ?? "http://localhost:1234/v1",
        apiKey: "lm-studio",
        model: process.env["LMSTUDIO_MODEL"] ?? configuredModel,
      });
  }
}
