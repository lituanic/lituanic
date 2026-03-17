import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSessionStore } from "../sessions.js";

describe("createSessionStore", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "lituanic-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates sessions directory", () => {
    createSessionStore(tmpDir);
    const { existsSync } = require("node:fs");
    expect(existsSync(join(tmpDir, "sessions"))).toBe(true);
  });

  it("stores and retrieves a session", () => {
    const store = createSessionStore(tmpDir);
    store.set("C123", "1234.5678", "sess_abc");
    expect(store.get("C123", "1234.5678")).toBe("sess_abc");
  });

  it("returns undefined for unknown session", () => {
    const store = createSessionStore(tmpDir);
    expect(store.get("C999", "0000.0000")).toBeUndefined();
  });

  it("overwrites existing session", () => {
    const store = createSessionStore(tmpDir);
    store.set("C123", "1234.5678", "sess_old");
    store.set("C123", "1234.5678", "sess_new");
    expect(store.get("C123", "1234.5678")).toBe("sess_new");
  });

  it("isolates sessions by channel and thread", () => {
    const store = createSessionStore(tmpDir);
    store.set("C1", "ts1", "sess_a");
    store.set("C1", "ts2", "sess_b");
    store.set("C2", "ts1", "sess_c");
    expect(store.get("C1", "ts1")).toBe("sess_a");
    expect(store.get("C1", "ts2")).toBe("sess_b");
    expect(store.get("C2", "ts1")).toBe("sess_c");
  });

  it("persists sessions to disk", () => {
    const store1 = createSessionStore(tmpDir);
    store1.set("C123", "1234.5678", "sess_persist");

    // Create a new store from the same directory — should read persisted data
    const store2 = createSessionStore(tmpDir);
    expect(store2.get("C123", "1234.5678")).toBe("sess_persist");
  });

  it("handles corrupt sessions file gracefully", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    const sessDir = join(tmpDir, "sessions");
    mkdirSync(sessDir, { recursive: true });
    writeFileSync(join(sessDir, "active.json"), "NOT VALID JSON", "utf-8");

    // Should not throw — starts fresh
    const store = createSessionStore(tmpDir);
    expect(store.get("C123", "any")).toBeUndefined();
  });

  it("migrates old format (plain string values)", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    const sessDir = join(tmpDir, "sessions");
    mkdirSync(sessDir, { recursive: true });
    writeFileSync(
      join(sessDir, "active.json"),
      JSON.stringify({ "C123:ts1": "sess_old_format" }),
      "utf-8",
    );

    const store = createSessionStore(tmpDir);
    expect(store.get("C123", "ts1")).toBe("sess_old_format");
  });
});
