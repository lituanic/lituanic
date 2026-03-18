import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { doctor, type Check } from "../doctor.js";

describe("doctor", () => {
  let tmpDir: string;
  let savedEnv: Record<string, string | undefined>;

  const ENV_KEYS = [
    "ANTHROPIC_API_KEY",
    "SLACK_BOT_TOKEN",
    "SLACK_APP_TOKEN",
    "LINEAR_API_KEY",
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "GWS_CLIENT_ID",
    "OP_SERVICE_ACCOUNT_TOKEN",
  ];

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "lituanic-doctor-test-"));
    savedEnv = {};
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    for (const key of ENV_KEYS) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  function findCheck(checks: Check[], name: string): Check | undefined {
    return checks.find((c) => c.name === name);
  }

  it("fails when ANTHROPIC_API_KEY is missing", async () => {
    const checks = await doctor(tmpDir);
    const check = findCheck(checks, "ANTHROPIC_API_KEY");
    expect(check?.status).toBe("fail");
  });

  it("passes when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const checks = await doctor(tmpDir);
    const check = findCheck(checks, "ANTHROPIC_API_KEY");
    expect(check?.status).toBe("ok");
  });

  it("warns when Slack tokens are missing", async () => {
    const checks = await doctor(tmpDir);
    expect(findCheck(checks, "Slack bot token")?.status).toBe("warn");
    expect(findCheck(checks, "Slack app token")?.status).toBe("warn");
  });

  it("passes when Slack tokens are set", async () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_APP_TOKEN = "xapp-test";
    const checks = await doctor(tmpDir);
    expect(findCheck(checks, "Slack bot token")?.status).toBe("ok");
    expect(findCheck(checks, "Slack app token")?.status).toBe("ok");
  });

  it("warns when Linear API key is missing", async () => {
    const checks = await doctor(tmpDir);
    expect(findCheck(checks, "Linear API key")?.status).toBe("warn");
  });

  it("passes when Linear API key is set", async () => {
    process.env.LINEAR_API_KEY = "lin_test";
    const checks = await doctor(tmpDir);
    expect(findCheck(checks, "Linear API key")?.status).toBe("ok");
  });

  it("checks GH_TOKEN or GITHUB_TOKEN", async () => {
    const checks1 = await doctor(tmpDir);
    expect(findCheck(checks1, "GH_TOKEN")?.status).toBe("warn");

    process.env.GH_TOKEN = "ghp_test";
    const checks2 = await doctor(tmpDir);
    expect(findCheck(checks2, "GH_TOKEN")?.status).toBe("ok");

    delete process.env.GH_TOKEN;
    process.env.GITHUB_TOKEN = "ghp_test2";
    const checks3 = await doctor(tmpDir);
    expect(findCheck(checks3, "GH_TOKEN")?.status).toBe("ok");
  });

  it("warns when OP_SERVICE_ACCOUNT_TOKEN is missing", async () => {
    const checks = await doctor(tmpDir);
    const check = findCheck(checks, "OP_SERVICE_ACCOUNT_TOKEN");
    expect(check?.status).toBe("warn");
    expect(check?.detail).toContain("plaintext");
  });

  it("passes when OP_SERVICE_ACCOUNT_TOKEN is set", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "ops_test";
    const checks = await doctor(tmpDir);
    const check = findCheck(checks, "OP_SERVICE_ACCOUNT_TOKEN");
    expect(check?.status).toBe("ok");
  });

  it("warns when no backup marker exists", async () => {
    const checks = await doctor(tmpDir);
    const check = findCheck(checks, "Backup");
    expect(check?.status).toBe("warn");
    expect(check?.detail).toContain("not configured");
  });

  it("passes when backup marker is recent", async () => {
    const marker = join(tmpDir, ".last-backup");
    writeFileSync(marker, new Date().toISOString(), "utf-8");
    const checks = await doctor(tmpDir);
    const check = findCheck(checks, "Backup");
    expect(check?.status).toBe("ok");
    expect(check?.detail).toContain("0h ago");
  });

  it("warns when backup marker is stale (>48h)", async () => {
    const marker = join(tmpDir, ".last-backup");
    const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
    writeFileSync(marker, threeDaysAgo.toISOString(), "utf-8");
    const checks = await doctor(tmpDir);
    const check = findCheck(checks, "Backup");
    expect(check?.status).toBe("warn");
    expect(check?.detail).toContain("stale");
  });

  it("warns on corrupt backup marker", async () => {
    const marker = join(tmpDir, ".last-backup");
    writeFileSync(marker, "NOT A DATE", "utf-8");
    const checks = await doctor(tmpDir);
    const check = findCheck(checks, "Backup");
    expect(check?.status).toBe("warn");
  });

  it("returns checks for all integrations", async () => {
    const checks = await doctor(tmpDir);
    const names = checks.map((c) => c.name);
    expect(names).toContain("ANTHROPIC_API_KEY");
    expect(names).toContain("op CLI");
    expect(names).toContain("OP_SERVICE_ACCOUNT_TOKEN");
    expect(names).toContain("Slack bot token");
    expect(names).toContain("Slack app token");
    expect(names).toContain("Linear API key");
    expect(names).toContain("gh CLI");
    expect(names).toContain("GH_TOKEN");
    expect(names).toContain("Backup");
  });
});
