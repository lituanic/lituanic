import { describe, expect, it } from "bun:test";

describe("smoke", () => {
  it("imports config module", async () => {
    const mod = await import("../config.js");
    expect(mod.ConfigSchema).toBeDefined();
    expect(mod.defineConfig).toBeFunction();
    expect(mod.loadConfig).toBeFunction();
  });

  it("imports sessions module", async () => {
    const mod = await import("../sessions.js");
    expect(mod.createSessionStore).toBeFunction();
  });

  it("imports memory module", async () => {
    const mod = await import("../memory.js");
    expect(mod.createMemoryManager).toBeFunction();
  });

  it("imports index module", async () => {
    const mod = await import("../index.js");
    expect(mod.defineConfig).toBeFunction();
    expect(mod.createDaemon).toBeFunction();
    expect(mod.createSessionStore).toBeFunction();
    expect(mod.createMemoryManager).toBeFunction();
  });
});
