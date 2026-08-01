import type { TacEvent } from "@tac-starter/shared";

/**
 * Canned trace shown by the dashboard in demo mode. Represents a realistic
 * three-turn WhatsApp conversation with a returning customer whose profile
 * Memory recalls mid-turn. Lets buyers see the observability UI without
 * needing a live Twilio account.
 */
const conv1 = "CH11111111111111111111111111111111";
const conv2 = "CH22222222222222222222222222222222";

export const demoEvents: TacEvent[] = [
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
    model: "claude-sonnet-4-6",
    response:
      "Hi Maya — your order #A-2947 shipped this morning. Estimated arrival Wednesday. Want me to send tracking updates by SMS like last time?",
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
    type: "message.received",
    timestamp: "2026-08-01T09:12:41.000Z",
    conversationId: conv1,
    channel: "whatsapp",
    from: "+14155551234",
    message: "yes please, sms is easier",
  },
  {
    type: "memory.recalled",
    timestamp: "2026-08-01T09:12:41.110Z",
    conversationId: conv1,
    channel: "whatsapp",
    query: "yes please, sms is easier",
    observationCount: 2,
    observations: [
      { content: "Customer name is Maya Chen; prefers WhatsApp over SMS.", occurredAt: "2026-06-14T10:22:00Z" },
      { content: "Order #A-2947 placed 2026-07-30, standard shipping.", occurredAt: "2026-07-30T08:14:00Z" },
    ],
    latencyMs: 118,
  },
  {
    type: "llm.completed",
    timestamp: "2026-08-01T09:12:41.720Z",
    conversationId: conv1,
    channel: "whatsapp",
    model: "claude-sonnet-4-6",
    response:
      "Done — SMS tracking updates for order #A-2947 are on. You'll get the next update when it's out for delivery.",
    usage: { inputTokens: 941, outputTokens: 32, cacheReadTokens: 812 },
    latencyMs: 605,
  },
  {
    type: "message.sent",
    timestamp: "2026-08-01T09:12:41.735Z",
    conversationId: conv1,
    channel: "whatsapp",
    message:
      "Done — SMS tracking updates for order #A-2947 are on. You'll get the next update when it's out for delivery.",
  },
  {
    type: "rule.fired",
    timestamp: "2026-08-01T09:12:41.900Z",
    conversationId: conv1,
    channel: "whatsapp",
    ruleName: "customer_preference_updated",
    payload: { preference: "delivery_updates_channel", from: "whatsapp", to: "sms" },
  },
  // Second conversation — SMS, escalates to human
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
    model: "claude-sonnet-4-6",
    response: "Understood — connecting you with a human agent now. Hold tight.",
    usage: { inputTokens: 620, outputTokens: 18 },
    latencyMs: 720,
  },
  {
    type: "tool.called",
    timestamp: "2026-08-01T09:44:12.930Z",
    conversationId: conv2,
    channel: "sms",
    tool: "handoff",
    input: { reason: "customer_explicit_request", context_summary: "two unresolved tickets" },
    outcome: "succeeded",
  },
  {
    type: "message.sent",
    timestamp: "2026-08-01T09:44:12.960Z",
    conversationId: conv2,
    channel: "sms",
    message: "Understood — connecting you with a human agent now. Hold tight.",
  },
];
