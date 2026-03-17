import { describe, expect, it } from "bun:test";
import { ConfigSchema, defineConfig } from "../config.js";

describe("ConfigSchema", () => {
  it("applies defaults for minimal config", () => {
    const config = ConfigSchema.parse({});
    expect(typeof config.name).toBe("string");
    expect(config.model).toBe("claude-sonnet-4-6");
    expect(config.fallbackModel).toBe("claude-haiku-4-5");
    expect(config.data).toBe("./data");
    expect(config.maxBudgetUsd).toBe(5.0);
    expect(config.maxTurns).toBe(50);
    expect(config.sandbox).toBe(false);
    expect(config.schedule).toEqual([]);
    expect(config.health.port).toBe(9200);
    expect(config.health.endpoint).toBe("/health");
  });

  it("accepts full slack config", () => {
    const config = ConfigSchema.parse({
      slack: { botToken: "xoxb-test", appToken: "xapp-test", channel: "C123" },
    });
    expect(config.slack?.botToken).toBe("xoxb-test");
    expect(config.slack?.appToken).toBe("xapp-test");
    expect(config.slack?.channel).toBe("C123");
  });

  it("accepts slack without optional channel", () => {
    const config = ConfigSchema.parse({
      slack: { botToken: "xoxb-test", appToken: "xapp-test" },
    });
    expect(config.slack?.channel).toBeUndefined();
  });

  it("rejects slack missing required fields", () => {
    expect(() => ConfigSchema.parse({ slack: { botToken: "xoxb-test" } })).toThrow();
    expect(() => ConfigSchema.parse({ slack: {} })).toThrow();
  });

  it("accepts webhook config with defaults", () => {
    const config = ConfigSchema.parse({ webhook: {} });
    expect(config.webhook?.port).toBe(9100);
    expect(config.webhook?.routes).toEqual({});
  });

  it("accepts webhook with custom route", () => {
    const config = ConfigSchema.parse({
      webhook: {
        port: 8080,
        routes: {
          "/webhook/linear": { secret: "whsec_test", verify: "hmac-sha256" },
        },
      },
    });
    expect(config.webhook?.port).toBe(8080);
    expect(config.webhook?.routes["/webhook/linear"].verify).toBe("hmac-sha256");
  });

  it("accepts schedule entries", () => {
    const config = ConfigSchema.parse({
      schedule: [{ cron: "0 9 * * *", prompt: "Check email", timezone: "America/New_York" }],
    });
    expect(config.schedule).toHaveLength(1);
    expect(config.schedule[0].timezone).toBe("America/New_York");
  });

  it("defaults schedule timezone to UTC", () => {
    const config = ConfigSchema.parse({
      schedule: [{ cron: "0 9 * * *", prompt: "Check email" }],
    });
    expect(config.schedule[0].timezone).toBe("UTC");
  });

  it("has blocked patterns by default", () => {
    const config = ConfigSchema.parse({});
    expect(config.blockedPatterns.length).toBeGreaterThan(0);
    expect(config.blockedPatterns[0]).toBeInstanceOf(RegExp);
  });

  it("overrides scalar fields", () => {
    const config = ConfigSchema.parse({
      name: "custom-agent",
      model: "claude-opus-4-6",
      maxBudgetUsd: 20,
      maxTurns: 100,
      sandbox: true,
    });
    expect(config.name).toBe("custom-agent");
    expect(config.model).toBe("claude-opus-4-6");
    expect(config.maxBudgetUsd).toBe(20);
    expect(config.maxTurns).toBe(100);
    expect(config.sandbox).toBe(true);
  });
});

describe("defineConfig", () => {
  it("returns parsed config", () => {
    const config = defineConfig({ name: "test-agent" });
    expect(config.name).toBe("test-agent");
    expect(config.health.port).toBe(9200);
  });

  it("throws on invalid config", () => {
    expect(() => defineConfig({ slack: {} } as any)).toThrow();
  });
});
