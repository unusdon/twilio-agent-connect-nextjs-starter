import "dotenv/config";
import {
  ChatChannel,
  SMSChannel,
  TAC,
  TACConfig,
  TACServer,
  VoiceChannel,
  WhatsAppChannel,
} from "twilio-agent-connect";
import type { Channel, TacEvent } from "@tac-starter/shared";
import { config } from "./config.js";
import { createEventSink } from "./event-sink.js";
import { handleMessage, InMemoryHistoryStore } from "./handle-message.js";
import { createLlmAdapter } from "./llm-factory.js";
import { buildToolRegistry } from "./tools.js";

/** First voice message per conversation → synthesise call.started once. */
const seenConversations = new Set<string>();

async function main(): Promise<void> {
  const sink = createEventSink(config.observability);
  const llm = createLlmAdapter(config.llm);
  const history = new InMemoryHistoryStore();

  const tac = await TAC.create({ config: TACConfig.fromEnv() });

  if (config.agent.channels.sms) tac.registerChannel(new SMSChannel(tac));
  if (config.agent.channels.whatsapp) tac.registerChannel(new WhatsAppChannel(tac));
  if (config.agent.channels.chat) tac.registerChannel(new ChatChannel(tac));
  if (config.agent.channels.voice) tac.registerChannel(new VoiceChannel(tac));

  tac.onMessageReady(async ({ conversationId, message, memory, session, channel }) => {
    const convId = String(conversationId);
    const ch = channel as Channel;
    const from = session.authorInfo?.address ?? "unknown";

    // Synthesise call.started on the first message of a voice conversation.
    if (ch === "voice" && !seenConversations.has(convId)) {
      seenConversations.add(convId);
      await sink.emit({
        type: "call.started",
        timestamp: new Date().toISOString(),
        conversationId: convId,
        channel: ch,
        from,
      });
    }

    return handleMessage(
      {
        llm,
        sink,
        buildTools: (s) => buildToolRegistry(tac, s, config.agent),
        agent: config.agent,
        history,
      },
      { conversationId: convId, message, memory, session, channel: ch, from },
    );
  });

  tac.onInterrupt(async ({ conversationId, utteranceUntilInterrupt, durationUntilInterruptMs }) => {
    await sink.emit({
      type: "interrupt.detected",
      timestamp: new Date().toISOString(),
      conversationId: String(conversationId),
      channel: "voice",
      ...(utteranceUntilInterrupt ? { utteranceUntilInterrupt } : {}),
      ...(durationUntilInterruptMs !== undefined ? { durationUntilInterruptMs } : {}),
    });
  });

  tac.onConversationEnded(async ({ session }) => {
    const convId = session.conversationId;
    seenConversations.delete(convId);
    history.delete(convId);

    const startedAt = session.startedAt.getTime();
    await sink.emit({
      type: "call.ended",
      timestamp: new Date().toISOString(),
      conversationId: convId,
      channel: session.channel as Channel,
      durationMs: Date.now() - startedAt,
      reason: "unknown",
    });
  });

  const server = new TACServer(tac);

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
  console.log(`[agent] ${config.agent.name} · ${llm.id} · listening on :${port}`);
  console.log(
    `[agent] channels: ${Object.entries(config.agent.channels)
      .filter(([, on]) => on)
      .map(([n]) => n)
      .join(", ")}`,
  );
  console.log(
    `[agent] loop: maxCycles=${config.agent.loop.maxCycles} · turnTimeout=${config.agent.loop.turnTimeoutMs}ms · maxHistory=${config.agent.loop.maxHistoryTurns} pairs`,
  );
}

main().catch((err: unknown) => {
  console.error("[agent] fatal:", err);
  process.exit(1);
});
