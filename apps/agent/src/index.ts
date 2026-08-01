import "dotenv/config";
import type Anthropic from "@anthropic-ai/sdk";
import {
  ChatChannel,
  MemoryPromptBuilder,
  SMSChannel,
  TAC,
  TACConfig,
  TACServer,
  WhatsAppChannel,
  createStudioHandoffTool,
} from "twilio-agent-connect";
import type { Channel, TacEvent } from "@tac-starter/shared";
import { ClaudeAdapter } from "./anthropic-adapter.js";
import { config } from "./config.js";
import { createEventSink } from "./event-sink.js";

/**
 * Per-conversation transcript. In-memory is fine for a single-instance starter;
 * multi-instance deployments should back this with Redis and hash on
 * conversationId (see docs/EP2_AGENT.md).
 */
const conversationHistory = new Map<
  string,
  Array<{ role: "user" | "assistant"; content: string }>
>();

/** After a handoff succeeds, this is what we tell the customer. */
const HANDOFF_FAREWELL =
  "Connecting you with a human agent now. Please hold — someone will be with you shortly.";

async function main(): Promise<void> {
  const sink = createEventSink(config.observability);
  const claude = new ClaudeAdapter(config.llm);

  const tac = await TAC.create({ config: TACConfig.fromEnv() });

  // Register channels declared as enabled in config.
  if (config.agent.channels.sms) tac.registerChannel(new SMSChannel(tac));
  if (config.agent.channels.whatsapp) tac.registerChannel(new WhatsAppChannel(tac));
  if (config.agent.channels.chat) tac.registerChannel(new ChatChannel(tac));
  // Voice is deferred to v1.1 — needs ConversationRelay wiring, see docs/EP2_AGENT.md.

  const handoffFlowSid = process.env[config.agent.handoff.studioFlowSidEnv];
  const handoffEnabled =
    config.agent.handoff.enabled && !!handoffFlowSid && handoffFlowSid.length > 0;

  tac.onMessageReady(async ({ conversationId, message, memory, session, channel }) => {
    const convId = String(conversationId);
    const history = conversationHistory.get(convId) ?? [];
    const now = () => new Date().toISOString();
    const ch = channel as Channel;

    await sink.emit({
      type: "message.received",
      timestamp: now(),
      conversationId: convId,
      channel: ch,
      message,
      from: session.authorInfo?.address ?? "unknown",
    });

    const systemPrompt = MemoryPromptBuilder.compose(
      config.agent.systemInstructions,
      memory,
      session,
    );

    // Log what Memory Recall returned this turn — the Ep 3 observability angle.
    // MemoryPromptBuilder already ran retrieval; we introspect what came back
    // so operators can see what the model actually saw.
    if (memory) {
      const observations = memory.observations;
      await sink.emit({
        type: "memory.recalled",
        timestamp: now(),
        conversationId: convId,
        channel: ch,
        query: message,
        observationCount: observations.length,
        observations: observations.slice(0, 10).map((o) => ({
          content: o.content,
          occurredAt: o.occurredAt,
        })),
        // TAC 2.x doesn't surface MemoryPromptBuilder's internal retrieval latency;
        // emit null rather than a fabricated 0 so the dashboard shows "n/a".
        latencyMs: null,
      });
    }

    // Build the handoff tool for this turn if configured. It's per-turn because
    // it captures the current session (needed for buildHandoffPayload).
    const handoffTool = handoffEnabled ? createStudioHandoffTool(tac, session) : null;
    const tools: Anthropic.Tool[] | undefined = handoffTool
      ? [handoffTool.toAnthropicFormat() as unknown as Anthropic.Tool]
      : undefined;

    const result = await claude.respond({
      systemPrompt,
      conversation: history,
      userMessage: message,
      tools,
    });

    // Branch on tool call vs plain text.
    if (result.type === "tool_use" && handoffTool && result.toolName === handoffTool.name) {
      const execStart = Date.now();
      const execution = await handoffTool.implementation(result.input as { reason: string });
      const succeeded = Boolean((execution as { success?: boolean }).success);
      const error = (execution as { error?: string }).error;

      await sink.emit({
        type: "llm.completed",
        timestamp: now(),
        conversationId: convId,
        channel: ch,
        model: result.model,
        response: `[tool_use: ${result.toolName}]`,
        usage: result.usage,
        latencyMs: result.latencyMs,
      });

      await sink.emit({
        type: "tool.called",
        timestamp: now(),
        conversationId: convId,
        channel: ch,
        tool: result.toolName,
        input: result.input,
        outcome: succeeded ? "succeeded" : "failed",
        ...(error ? { error } : {}),
      });

      // Voice's post-handoff flow is different (Studio takes over the call), so
      // we skip the farewell and let Studio drive from here.
      if (ch === "voice") return null;

      await sink.emit({
        type: "message.sent",
        timestamp: now(),
        conversationId: convId,
        channel: ch,
        message: HANDOFF_FAREWELL,
      });

      // Record the farewell in history so a follow-up turn (if any) has context.
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: HANDOFF_FAREWELL });
      conversationHistory.set(convId, history);
      // Referenced but suppress lint on the unused execStart timing — kept for
      // future latency breakdown in tool.called.
      void execStart;
      return HANDOFF_FAREWELL;
    }

    // Plain text response path.
    const text = result.type === "text" ? result.text : "";
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: text });
    conversationHistory.set(convId, history);

    await sink.emit({
      type: "llm.completed",
      timestamp: now(),
      conversationId: convId,
      channel: ch,
      model: result.model,
      response: text,
      usage: result.usage,
      latencyMs: result.latencyMs,
    });

    await sink.emit({
      type: "message.sent",
      timestamp: now(),
      conversationId: convId,
      channel: ch,
      message: text,
    });

    return text;
  });

  const server = new TACServer(tac);

  // Ep 3 hook: expose a webhook endpoint intelligence rules can POST to. The
  // starter simply logs the payload as a rule.fired event on the timeline so
  // operators can see the rule-eval → action linkage. Extend to trigger custom
  // side effects (Slack notify, escalation, etc.) as your needs grow.
  server.fastify.post<{
    Body: {
      conversationId?: string;
      channel?: Channel;
      rule?: string;
      [k: string]: unknown;
    };
  }>("/rule-webhook", async (req, reply) => {
    const body = req.body ?? {};
    const evt: Extract<TacEvent, { type: "rule.fired" }> = {
      type: "rule.fired",
      timestamp: new Date().toISOString(),
      conversationId: String(body.conversationId ?? "unknown"),
      channel: (body.channel ?? "chat") as Channel,
      ruleName: String(body.rule ?? "unknown"),
      payload: body,
    };
    await sink.emit(evt);
    return reply.code(204).send();
  });

  await server.start();

  const port = Number(process.env["AGENT_PORT"] ?? 3001);
  console.log(`[agent] ${config.agent.name} listening on :${port}`);
  console.log(
    `[agent] channels: ${Object.entries(config.agent.channels)
      .filter(([, on]) => on)
      .map(([n]) => n)
      .join(", ")}`,
  );
  console.log(
    `[agent] handoff: ${handoffEnabled ? "enabled (Studio flow " + handoffFlowSid + ")" : "disabled"}`,
  );
}

main().catch((err: unknown) => {
  console.error("[agent] fatal:", err);
  process.exit(1);
});
