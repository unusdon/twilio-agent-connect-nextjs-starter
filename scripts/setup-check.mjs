#!/usr/bin/env node
/**
 * Validate that .env has the credentials the agent needs to actually run.
 * Runs no network calls that cost money — a HEAD to Twilio's API root is
 * enough to confirm the SID + auth token authenticate.
 *
 * Usage: `npm run setup:check` from the repo root.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TAC_MEMORY_STORE_SID",
  "TAC_CONVERSATION_CONFIGURATION_SID",
  "ANTHROPIC_API_KEY",
];

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

async function pingTwilio(sid, token) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  return { ok: res.ok, status: res.status };
}

async function pingAnthropic(key) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  return { ok: res.ok, status: res.status };
}

async function main() {
  loadDotenv();

  const missing = REQUIRED_KEYS.filter((k) => !process.env[k] || process.env[k].startsWith("your_") || process.env[k].includes("xxxxxxxx"));
  if (missing.length > 0) {
    console.error("✗ Missing or placeholder values in .env:");
    for (const k of missing) console.error(`  · ${k}`);
    process.exit(1);
  }
  console.log("✓ All required .env keys present.");

  console.log("→ Pinging Twilio API…");
  const t = await pingTwilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log(t.ok ? "✓ Twilio credentials valid." : `✗ Twilio returned ${t.status}.`);

  console.log("→ Pinging Anthropic API…");
  const a = await pingAnthropic(process.env.ANTHROPIC_API_KEY);
  console.log(a.ok ? "✓ Anthropic credentials valid." : `✗ Anthropic returned ${a.status}.`);

  if (!t.ok || !a.ok) process.exit(1);
  console.log("\nReady to run: npm run dev");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
