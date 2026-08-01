import { appendFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import type { StarterConfig, TacEvent } from "@tac-starter/shared";

/**
 * Sinks observability events. The dashboard tails the same file (in "live" mode)
 * or reads from fixtures (in "demo" mode). Keeping this abstraction thin on
 * purpose — a starter shouldn't ship a full event bus.
 */
export interface EventSink {
  emit(event: TacEvent): Promise<void>;
}

/**
 * Anchor relative paths at the monorepo root, not the current workspace cwd.
 * `npm --workspace X run Y` runs Y with cwd = X's dir, which would silently
 * split agent-writes from dashboard-reads. `npm_config_local_prefix` is the
 * workspace-root path npm exports for every workspace script.
 */
function repoRootAnchor(): string {
  return process.env["npm_config_local_prefix"] ?? process.cwd();
}

class FileSink implements EventSink {
  private readonly resolvedPath: string;
  private dirEnsured = false;

  constructor(filePath: string) {
    this.resolvedPath = isAbsolute(filePath) ? filePath : resolve(repoRootAnchor(), filePath);
  }

  async emit(event: TacEvent): Promise<void> {
    if (!this.dirEnsured) {
      await mkdir(dirname(this.resolvedPath), { recursive: true });
      this.dirEnsured = true;
    }
    await appendFile(this.resolvedPath, `${JSON.stringify(event)}\n`, "utf8");
  }
}

class MemorySink implements EventSink {
  private readonly ring: TacEvent[] = [];
  constructor(private readonly maxSize: number) {}

  async emit(event: TacEvent): Promise<void> {
    this.ring.push(event);
    if (this.ring.length > this.maxSize) this.ring.shift();
  }

  snapshot(): readonly TacEvent[] {
    return this.ring;
  }
}

class NullSink implements EventSink {
  async emit(): Promise<void> {}
}

export function createEventSink(observability: StarterConfig["observability"]): EventSink {
  switch (observability.sink) {
    case "file":
      return new FileSink(process.env["AGENT_EVENT_LOG"] ?? observability.filePath);
    case "memory":
      return new MemorySink(observability.memoryRingSize);
    case "none":
      return new NullSink();
  }
}
