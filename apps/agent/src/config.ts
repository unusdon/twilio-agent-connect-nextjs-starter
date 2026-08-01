import { defaultConfig, type StarterConfig } from "@tac-starter/shared";

/**
 * Local overrides go here — anything you tweak per-deployment beyond
 * the shared defaults. Ship this file with your fork; keep `defaultConfig`
 * in `packages/shared` as the reference implementation.
 */
export const config: StarterConfig = {
  ...defaultConfig,
  // Example override:
  // agent: { ...defaultConfig.agent, name: "Nova" },
};
