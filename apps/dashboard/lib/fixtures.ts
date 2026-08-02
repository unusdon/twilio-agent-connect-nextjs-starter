import type { TacEvent } from "@tac-starter/shared";

/**
 * Canned traces shown by the dashboard in demo mode. Four conversations, one
 * per behavioural pattern the starter supports:
 *
 *   1. WhatsApp · **simple chat** — one Memory recall, one LLM turn per message.
 *   2. SMS · **terminal tool handoff** — LLM calls `handoff`, agent stops the loop.
 *   3. Voice · **full call arc** — call.started → transcript → memory → LLM →
 *      TTS → interrupt → new transcript → LLM → TTS → call.ended.
 *   4. Chat · **agentic multi-tool loop** — LLM calls `search_knowledge_base`,
 *      reads the result, calls `lookup_order`, reads the result, finally answers.
 */
const conv1 = "CH11111111111111111111111111111111"; // WhatsApp · simple
const conv2 = "CH22222222222222222222222222222222"; // SMS · handoff
const conv3 = "CH33333333333333333333333333333333"; // Voice · arc + interrupt
const conv4 = "CH44444444444444444444444444444444"; // Chat · agentic multi-tool

export const demoEvents: TacEvent[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // Conversation 1 — WhatsApp, Maya Chen, order-status question
  // ═══════════════════════════════════════════════════════════════════════
  {
    type: "message.received",
    timestamp: "2026-08-01T09:12:03.100Z",
    conversationId: conv1,
    channel: "whatsapp",
    from: "+14155551234",
    message: "hey, is my order shipped yet?",
  },
  {
    type: "memory.recalled",
    timestamp: "2026-08-01T09:12:03.240Z",
    conversationId: conv1,
    channel: "whatsapp",
    query: "hey, is my order shipped yet?",
    observationCount: 3,
    observations: [
      { content: "Customer name is Maya Chen; prefers WhatsApp over SMS.", occurredAt: "2026-06-14T10:22:00Z" },
      { content: "Order #A-2947 placed 2026-07-30, standard shipping.", occurredAt: "2026-07-30T08:14:00Z" },
      { content: "Previously requested delivery-time SMS updates.", occurredAt: "2026-05-02T16:00:00Z" },
    ],
    latencyMs: 141,
  },
  {
    type: "llm.completed",
    timestamp: "2026-08-01T09:12:04.020Z",
    conversationId: conv1,
    channel: "whatsapp",
    cycleDepth: 0,
    model: "claude-sonnet-4-6",
    response:
      "Hi Maya — your order #A-2947 shipped this morning. Estimated arrival Wednesday. Want me to send tracking updates by SMS like last time?",
    invokedTool: false,
    usage: { inputTokens: 812, outputTokens: 46, cacheReadTokens: 640 },
    latencyMs: 780,
  },
  {
    type: "message.sent",
    timestamp: "2026-08-01T09:12:04.055Z",
    conversationId: conv1,
    channel: "whatsapp",
    message:
      "Hi Maya — your order #A-2947 shipped this morning. Estimated arrival Wednesday. Want me to send tracking updates by SMS like last time?",
  },
  {
    type: "rule.fired",
    timestamp: "2026-08-01T09:12:04.900Z",
    conversationId: conv1,
    channel: "whatsapp",
    ruleName: "positive_intent_detected",
    payload: { intent: "order_status", sentiment: 0.72 },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Conversation 2 — SMS, frustrated customer, terminal handoff
  // ═══════════════════════════════════════════════════════════════════════
  {
    type: "message.received",
    timestamp: "2026-08-01T09:44:12.000Z",
    conversationId: conv2,
    channel: "sms",
    from: "+14085557890",
    message: "your bot keeps repeating itself, i want a real person",
  },
  {
    type: "memory.recalled",
    timestamp: "2026-08-01T09:44:12.120Z",
    conversationId: conv2,
    channel: "sms",
    query: "your bot keeps repeating itself, i want a real person",
    observationCount: 1,
    observations: [
      {
        content: "Customer has 2 unresolved tickets in the past week; frustration signal high.",
        occurredAt: "2026-07-28T12:04:00Z",
      },
    ],
    latencyMs: 124,
  },
  {
    type: "llm.completed",
    timestamp: "2026-08-01T09:44:12.860Z",
    conversationId: conv2,
    channel: "sms",
    cycleDepth: 0,
    model: "claude-sonnet-4-6",
    response: "",
    invokedTool: true,
    usage: { inputTokens: 620, outputTokens: 18 },
    latencyMs: 720,
  },
  {
    type: "tool.called",
    timestamp: "2026-08-01T09:44:12.930Z",
    conversationId: conv2,
    channel: "sms",
    cycleDepth: 0,
    toolCallId: "toolu_handoff_01",
    tool: "handoff",
    input: { reason: "customer_explicit_request" },
    outcome: "succeeded",
    latencyMs: 340,
  },
  {
    type: "message.sent",
    timestamp: "2026-08-01T09:44:13.290Z",
    conversationId: conv2,
    channel: "sms",
    message:
      "Connecting you with a human agent now. Please hold — someone will be with you shortly.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Conversation 3 — Voice, full call arc with interrupt
  // ═══════════════════════════════════════════════════════════════════════
  {
    type: "call.started",
    timestamp: "2026-08-01T10:15:03.000Z",
    conversationId: conv3,
    channel: "voice",
    callSid: "CA9f7c3d2a1e0b4d5f6a7c8b9d0e1f2a3b",
    from: "+442071838750",
    to: "+441234567890",
  },
  {
    type: "message.received",
    timestamp: "2026-08-01T10:15:04.000Z",
    conversationId: conv3,
    channel: "voice",
    from: "+442071838750",
    message: "Hi, I'm calling to change the delivery address on my order please.",
  },
  {
    type: "memory.recalled",
    timestamp: "2026-08-01T10:15:04.180Z",
    conversationId: conv3,
    channel: "voice",
    query: "Hi, I'm calling to change the delivery address on my order please.",
    observationCount: 2,
    observations: [
      { content: "Customer name is James Okafor; verified via phone earlier this week.", occurredAt: "2026-07-27T14:12:00Z" },
      { content: "Order #A-3018 in warehouse status, shipping label not yet printed.", occurredAt: "2026-08-01T08:02:00Z" },
    ],
    latencyMs: 168,
  },
  {
    type: "llm.completed",
    timestamp: "2026-08-01T10:15:05.010Z",
    conversationId: conv3,
    channel: "voice",
    cycleDepth: 0,
    model: "claude-sonnet-4-6",
    response:
      "Of course, James. Order A-3018 hasn't shipped yet so we can update the address. What's the new one?",
    invokedTool: false,
    usage: { inputTokens: 743, outputTokens: 40, cacheReadTokens: 580 },
    latencyMs: 820,
  },
  {
    type: "message.sent",
    timestamp: "2026-08-01T10:15:05.040Z",
    conversationId: conv3,
    channel: "voice",
    message:
      "Of course, James. Order A-3018 hasn't shipped yet so we can update the address. What's the new one?",
  },
  {
    type: "interrupt.detected",
    timestamp: "2026-08-01T10:15:06.180Z",
    conversationId: conv3,
    channel: "voice",
    utteranceUntilInterrupt:
      "Of course, James. Order A-3018 hasn't shipped yet so we can update the address. What's",
    durationUntilInterruptMs: 2100,
  },
  {
    type: "message.received",
    timestamp: "2026-08-01T10:15:07.100Z",
    conversationId: conv3,
    channel: "voice",
    from: "+442071838750",
    message: "42 Baker Street, London, NW1 6XE.",
  },
  {
    type: "llm.completed",
    timestamp: "2026-08-01T10:15:07.780Z",
    conversationId: conv3,
    channel: "voice",
    cycleDepth: 0,
    model: "claude-sonnet-4-6",
    response:
      "Got it — 42 Baker Street, London, N W 1, 6 X E. Updating now. You'll get an SMS confirmation.",
    invokedTool: false,
    usage: { inputTokens: 890, outputTokens: 38, cacheReadTokens: 743 },
    latencyMs: 675,
  },
  {
    type: "message.sent",
    timestamp: "2026-08-01T10:15:07.810Z",
    conversationId: conv3,
    channel: "voice",
    message:
      "Got it — 42 Baker Street, London, N W 1, 6 X E. Updating now. You'll get an SMS confirmation.",
  },
  {
    type: "call.ended",
    timestamp: "2026-08-01T10:15:14.500Z",
    conversationId: conv3,
    channel: "voice",
    durationMs: 11500,
    reason: "customer_hangup",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Conversation 4 — Chat, AGENTIC multi-tool loop (knowledge → order → answer)
  // ═══════════════════════════════════════════════════════════════════════
  {
    type: "message.received",
    timestamp: "2026-08-01T11:02:00.000Z",
    conversationId: conv4,
    channel: "chat",
    from: "web-widget:sess_r7q2",
    message:
      "The order I got yesterday says NX-Pro but the box has NX-Studio. Are these actually the same thing or did I get the wrong item? My order is A-4210.",
  },
  {
    type: "memory.recalled",
    timestamp: "2026-08-01T11:02:00.140Z",
    conversationId: conv4,
    channel: "chat",
    query:
      "The order I got yesterday says NX-Pro but the box has NX-Studio. Are these actually the same thing or did I get the wrong item?",
    observationCount: 1,
    observations: [
      { content: "Customer Priya Nair; first-time buyer, arrived via marketing campaign 'summer-2026'.", occurredAt: "2026-07-24T18:11:00Z" },
    ],
    latencyMs: 132,
  },
  // Cycle 0 — LLM decides to search the knowledge base
  {
    type: "llm.completed",
    timestamp: "2026-08-01T11:02:01.010Z",
    conversationId: conv4,
    channel: "chat",
    cycleDepth: 0,
    model: "claude-sonnet-4-6",
    response: "Let me check our product catalogue on the NX-Pro / NX-Studio naming.",
    invokedTool: true,
    usage: { inputTokens: 860, outputTokens: 62, cacheReadTokens: 700 },
    latencyMs: 880,
  },
  {
    type: "tool.called",
    timestamp: "2026-08-01T11:02:01.080Z",
    conversationId: conv4,
    channel: "chat",
    cycleDepth: 0,
    toolCallId: "toolu_kb_01",
    tool: "search_knowledge_base",
    input: { query: "NX-Pro vs NX-Studio product naming" },
    outcome: "succeeded",
    latencyMs: 240,
  },
  {
    type: "tool.result",
    timestamp: "2026-08-01T11:02:01.325Z",
    conversationId: conv4,
    channel: "chat",
    cycleDepth: 0,
    toolCallId: "toolu_kb_01",
    tool: "search_knowledge_base",
    result:
      '{"chunks":[{"title":"NX product line naming","text":"NX-Studio was renamed to NX-Pro in July 2026. Existing boxed stock still carries the NX-Studio label; the products are identical. No SKU or firmware difference."},{"title":"NX-Pro release notes","text":"Feature-identical to NX-Studio 3.4+; marketed under new name for the pro-audio segment launch."}]}',
  },
  // Cycle 1 — LLM now needs the customer's specific order to answer with confidence
  {
    type: "llm.completed",
    timestamp: "2026-08-01T11:02:02.180Z",
    conversationId: conv4,
    channel: "chat",
    cycleDepth: 1,
    model: "claude-sonnet-4-6",
    response: "",
    invokedTool: true,
    usage: { inputTokens: 1140, outputTokens: 32, cacheReadTokens: 860 },
    latencyMs: 720,
  },
  {
    type: "tool.called",
    timestamp: "2026-08-01T11:02:02.230Z",
    conversationId: conv4,
    channel: "chat",
    cycleDepth: 1,
    toolCallId: "toolu_ord_01",
    tool: "lookup_order",
    input: { order_id: "A-4210" },
    outcome: "succeeded",
    latencyMs: 88,
  },
  {
    type: "tool.result",
    timestamp: "2026-08-01T11:02:02.320Z",
    conversationId: conv4,
    channel: "chat",
    cycleDepth: 1,
    toolCallId: "toolu_ord_01",
    tool: "lookup_order",
    result:
      '{"order_id":"A-4210","sku":"NX-PRO-STD","product":"NX-Pro Studio Monitor","shipped_at":"2026-07-31T09:22:00Z","warehouse":"UK-LDN-02"}',
  },
  // Cycle 2 — LLM has everything, returns final text
  {
    type: "llm.completed",
    timestamp: "2026-08-01T11:02:03.240Z",
    conversationId: conv4,
    channel: "chat",
    cycleDepth: 2,
    model: "claude-sonnet-4-6",
    response:
      "You got the right item, Priya — NX-Studio and NX-Pro are the same product. We renamed it in July, and the boxed stock still shipping is the older NX-Studio label; the unit inside is identical. Your order A-4210 is SKU NX-PRO-STD, confirmed. Nothing to do — enjoy it!",
    invokedTool: false,
    usage: { inputTokens: 1310, outputTokens: 88, cacheReadTokens: 1140 },
    latencyMs: 920,
  },
  {
    type: "message.sent",
    timestamp: "2026-08-01T11:02:03.280Z",
    conversationId: conv4,
    channel: "chat",
    message:
      "You got the right item, Priya — NX-Studio and NX-Pro are the same product. We renamed it in July, and the boxed stock still shipping is the older NX-Studio label; the unit inside is identical. Your order A-4210 is SKU NX-PRO-STD, confirmed. Nothing to do — enjoy it!",
  },
];
