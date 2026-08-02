import {
  type ConversationSession,
  type TAC,
  type TACTool,
  createKnowledgeSearchToolAsync,
  createMemoryRetrievalTool,
  createStudioHandoffTool,
} from "twilio-agent-connect";
import type { StarterConfig } from "@tac-starter/shared";
import type { LlmTool } from "./llm-types.js";

/**
 * A tool ready to expose to the LLM. Wraps a TACTool (or a custom
 * implementation) with the neutral schema the adapters expect.
 */
export interface RegisteredTool {
  /** Neutral tool schema exposed to the LLM. */
  schema: LlmTool;
  /**
   * Execute the tool. Returns whatever the tool wants the LLM to see next —
   * we serialise it to string before feeding into the tool_result item.
   */
  execute(input: Record<string, unknown>): Promise<{
    outcome: "succeeded" | "failed";
    result: unknown;
    error?: string;
    latencyMs: number;
  }>;
  /**
   * True when this tool is terminal — the loop stops after it runs and the
   * agent returns a farewell instead of another LLM turn. Handoff is the only
   * built-in terminal tool.
   */
  terminal?: boolean;
}

function wrapTacTool(tool: TACTool, terminal = false): RegisteredTool {
  return {
    schema: {
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Record<string, unknown>,
    },
    async execute(input) {
      const started = Date.now();
      try {
        const result = await tool.implementation(input);
        const success = Boolean((result as { success?: boolean }).success);
        const error = (result as { error?: string }).error;
        return {
          outcome: success ? "succeeded" : "failed",
          result,
          ...(error ? { error } : {}),
          latencyMs: Date.now() - started,
        };
      } catch (err) {
        return {
          outcome: "failed",
          result: null,
          error: err instanceof Error ? err.message : String(err),
          latencyMs: Date.now() - started,
        };
      }
    },
    terminal,
  };
}

/**
 * Build the tool registry for a single turn. Called once per `onMessageReady`
 * because some SDK tools capture the current session (e.g. handoff embeds
 * the session in its payload).
 *
 * Buyers extend this by adding entries at the bottom — either wrapping a
 * `defineTool(...)` from the SDK or authoring a fully custom `RegisteredTool`.
 */
export async function buildToolRegistry(
  tac: TAC,
  session: ConversationSession,
  config: StarterConfig["agent"],
): Promise<Record<string, RegisteredTool>> {
  const registry: Record<string, RegisteredTool> = {};

  // ── Handoff (terminal) ────────────────────────────────────────────────
  const handoffFlow = process.env[config.handoff.studioFlowSidEnv];
  if (config.handoff.enabled && handoffFlow) {
    try {
      const handoff = createStudioHandoffTool(tac, session);
      registry[handoff.name] = wrapTacTool(handoff, /* terminal */ true);
    } catch (err) {
      console.warn(`[tools] handoff registration skipped: ${err}`);
    }
  }

  // ── Knowledge base / RAG (opt-in via TAC_KNOWLEDGE_BASE_ID) ──────────
  const knowledgeId = process.env["TAC_KNOWLEDGE_BASE_ID"];
  const knowledgeClient = tac.getKnowledgeClient();
  if (knowledgeId && knowledgeClient) {
    try {
      const kb = await createKnowledgeSearchToolAsync(knowledgeClient, knowledgeId);
      registry[kb.name] = wrapTacTool(kb);
    } catch (err) {
      console.warn(`[tools] knowledge base ${knowledgeId} attach failed: ${err}`);
    }
  }

  // ── Memory retrieval on-demand (opt-in) ──────────────────────────────
  // The initial Recall runs before every turn via TAC's automatic memory
  // hydration. This tool gives the LLM a second-level lookup — useful when
  // the initial recall didn't return what the model needed. Session must
  // have a profileId (Memory always resolves one for known customers).
  if (process.env["TAC_ENABLE_MEMORY_RETRIEVAL_TOOL"] === "1") {
    const memoryClient = tac.getMemoryClient();
    if (memoryClient && session.profileId) {
      try {
        const mem = createMemoryRetrievalTool(
          memoryClient,
          session.profileId,
          session.conversationId,
        );
        registry[mem.name] = wrapTacTool(mem);
      } catch (err) {
        console.warn(`[tools] memory retrieval attach failed: ${err}`);
      }
    }
  }

  // ── Custom tools go here ──────────────────────────────────────────────
  // Example — a simple order-lookup tool wired to your own datastore:
  //
  //   registry["lookup_order"] = {
  //     schema: {
  //       name: "lookup_order",
  //       description: "Look up an order by its ID.",
  //       input_schema: {
  //         type: "object",
  //         properties: { order_id: { type: "string" } },
  //         required: ["order_id"],
  //       },
  //     },
  //     async execute(input) {
  //       const started = Date.now();
  //       const order = await yourDb.orders.find(input.order_id as string);
  //       return {
  //         outcome: order ? "succeeded" : "failed",
  //         result: order ?? { error: "not_found" },
  //         latencyMs: Date.now() - started,
  //       };
  //     },
  //   };

  return registry;
}
