import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TacEvent } from "@tac-starter/shared";
import { createEventSink } from "./event-sink.js";

describe("createEventSink", () => {
  const sampleEvent: TacEvent = {
    type: "message.received",
    timestamp: "2026-08-01T00:00:00.000Z",
    conversationId: "CHtest",
    channel: "sms",
    from: "+15550000000",
    message: "hi",
  };

  describe("file sink", () => {
    let tmp: string;
    let priorAnchor: string | undefined;

    beforeEach(async () => {
      tmp = await mkdtemp(join(tmpdir(), "tac-sink-"));
      priorAnchor = process.env["npm_config_local_prefix"];
      process.env["npm_config_local_prefix"] = tmp;
    });

    afterEach(async () => {
      if (priorAnchor === undefined) delete process.env["npm_config_local_prefix"];
      else process.env["npm_config_local_prefix"] = priorAnchor;
      await rm(tmp, { recursive: true, force: true });
      delete process.env["AGENT_EVENT_LOG"];
    });

    it("appends events as JSONL to the configured path", async () => {
      const sink = createEventSink({
        sink: "file",
        filePath: "./events.jsonl",
        memoryRingSize: 500,
      });

      await sink.emit(sampleEvent);
      await sink.emit({ ...sampleEvent, message: "second" });

      const raw = await readFile(join(tmp, "events.jsonl"), "utf8");
      const lines = raw.trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!)).toEqual(sampleEvent);
      expect(JSON.parse(lines[1]!).message).toBe("second");
    });

    it("respects AGENT_EVENT_LOG env override", async () => {
      process.env["AGENT_EVENT_LOG"] = "./custom-path.jsonl";
      const sink = createEventSink({
        sink: "file",
        filePath: "./ignored.jsonl",
        memoryRingSize: 500,
      });

      await sink.emit(sampleEvent);

      const raw = await readFile(join(tmp, "custom-path.jsonl"), "utf8");
      expect(raw.trim()).toBe(JSON.stringify(sampleEvent));
    });
  });

  describe("memory / none sinks", () => {
    it("memory sink accepts events without error", async () => {
      const sink = createEventSink({
        sink: "memory",
        filePath: "unused",
        memoryRingSize: 2,
      });
      await expect(sink.emit(sampleEvent)).resolves.toBeUndefined();
    });

    it("none sink is a no-op", async () => {
      const sink = createEventSink({
        sink: "none",
        filePath: "unused",
        memoryRingSize: 500,
      });
      await expect(sink.emit(sampleEvent)).resolves.toBeUndefined();
    });
  });
});
