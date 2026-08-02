#!/usr/bin/env node
/**
 * Validate that .env has the credentials the agent needs to actually run.
 * Runs no network calls that cost money — a minimum-token probe is enough to
 * confirm the credentials authenticate.
 *
 * Usage: `npm run setup:check` from the repo root.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TWILIO_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TAC_MEMORY_STORE_SID",
  "TAC_CONVERSATION_CONFIGURATION_SID",
];

/** Env-var requirements per provider (used both for validation and probing). */
const PROVIDER_REQS = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY"],
  ollama: [], // local — connectivity is the check
  lmstudio: [], // local — connectivity is the check
};

function loadDotenv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    console.error("✗ .env file not found — copy .env.example to .env first.");
    process.exit(1);
  }
}

function isPlaceholder(v) {
  return !v || v.startsWith("your_") || v.includes("xxxxxxxx");
}

async function pingTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  return { ok: res.ok, status: res.status };
}

async function pingAnthropic() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  return { ok: res.ok, status: res.status };
}

async function pingOpenAICompat({ baseURL, apiKey, model }) {
  const url = `${baseURL.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  return { ok: res.ok, status: res.status };
}

async function pingProvider(provider) {
  switch (provider) {
    case "anthropic":
      return pingAnthropic();
    case "openai":
      return pingOpenAICompat({
        baseURL: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      });
    case "gemini":
      return pingOpenAICompat({
        baseURL:
          process.env.GEMINI_BASE_URL ??
          "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
      });
    case "ollama":
      return pingOpenAICompat({
        baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
        apiKey: "ollama",
        model: process.env.OLLAMA_MODEL ?? "llama3.2",
      });
    case "lmstudio":
      return pingOpenAICompat({
        baseURL: process.env.LMSTUDIO_BASE_URL ?? "http://localhost:1234/v1",
        apiKey: "lm-studio",
        model: process.env.LMSTUDIO_MODEL ?? "llama3.2",
      });
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
  }
}

async function main() {
  loadDotenv();

  const provider = process.env.LLM_PROVIDER ?? "anthropic";
  const providerReqs = PROVIDER_REQS[provider];
  if (!providerReqs) {
    console.error(`✗ Unknown LLM_PROVIDER: ${provider}. Set one of: anthropic, openai, gemini, ollama, lmstudio.`);
    process.exit(1);
  }

  const required = [...TWILIO_KEYS, ...providerReqs];
  const missing = required.filter((k) => isPlaceholder(process.env[k]));
  if (missing.length > 0) {
    console.error("✗ Missing or placeholder values in .env:");
    for (const k of missing) console.error(`  · ${k}`);
    process.exit(1);
  }
  console.log(`✓ All required .env keys present (provider: ${provider}).`);

  console.log("→ Pinging Twilio API…");
  const t = await pingTwilio();
  console.log(t.ok ? "✓ Twilio credentials valid." : `✗ Twilio returned ${t.status}.`);

  console.log(`→ Pinging ${provider} endpoint…`);
  const l = await pingProvider(provider);
  console.log(l.ok ? `✓ ${provider} endpoint reachable.` : `✗ ${provider} returned ${l.status}.`);

  if (!t.ok || !l.ok) process.exit(1);
  console.log("\nReady to run: npm run dev");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
