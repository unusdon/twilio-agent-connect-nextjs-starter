/**
 * Worked example — add your own tool to the LLM.
 *
 * This file isn't imported anywhere; it's a copy-paste template. Delete it or
 * keep it as a reference. See `README.md#custom-tools` for the walkthrough.
 *
 * To wire this up, add the `lookupOrderTool` factory below into
 * `buildToolRegistry()` in `apps/agent/src/tools.ts`:
 *
 *   registry["lookup_order"] = lookupOrderTool(deps.yourOrderDb);
 *
 * The tool becomes available to the LLM on the next customer message — no
 * other wiring, no config touch, no dashboard code required. The `tool.called`
 * and `tool.result` events on the timeline will render automatically with the
 * chain indent already in place.
 */

import type { RegisteredTool } from "./tools.js";

// Replace this with your real order-lookup adapter.
export interface OrderRepo {
  findById(id: string): Promise<{
    id: string;
    status: "pending" | "shipped" | "delivered";
    tracking?: string;
  } | null>;
}

/**
 * Wraps an order-lookup call as an LLM-callable tool. Returns a
 * `RegisteredTool` — the shape the loop consumes.
 *
 *   const tool = lookupOrderTool(myRepo);
 *   registry[tool.schema.name] = tool;
 */
export function lookupOrderTool(orderRepo: OrderRepo): RegisteredTool {
  return {
    schema: {
      name: "lookup_order",
      description:
        "Look up the current status of a customer order by its order ID. Returns the status (pending / shipped / delivered) and tracking number when available.",
      input_schema: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID, e.g. \"A-4210\"",
          },
        },
        required: ["order_id"],
      },
    },
    async execute(input) {
      const started = Date.now();
      const orderId = input["order_id"];
      if (typeof orderId !== "string" || orderId.length === 0) {
        return {
          outcome: "failed",
          result: null,
          error: "order_id_required",
          latencyMs: Date.now() - started,
        };
      }
      try {
        const order = await orderRepo.findById(orderId);
        if (!order) {
          return {
            outcome: "failed",
            result: { error: "order_not_found", order_id: orderId },
            error: "order_not_found",
            latencyMs: Date.now() - started,
          };
        }
        return {
          outcome: "succeeded",
          result: order,
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
  };
}
