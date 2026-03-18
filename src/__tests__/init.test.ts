import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// init() calls process.exit(1) on existing dir — we need to handle that
import { init } from "../init.js";

describe("init", () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "lituanic-init-test-"));
    origCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates project directory with a name", () => {
    init("test-agent");
    expect(existsSync(join(tmpDir, "test-agent"))).toBe(true);
  });

  it("creates project in current directory with '.'", () => {
    init(".");
    expect(existsSync(join(tmpDir, ".claude", "skills"))).toBe(true);
  });

  it("generates .env file", () => {
    init("test-agent");
    const envFile = join(tmpDir, "test-agent", ".env");
    expect(existsSync(envFile)).toBe(true);
    const content = readFileSync(envFile, "utf-8");
    expect(content).toContain("ANTHROPIC_API_KEY");
    expect(content).toContain("SLACK_BOT_TOKEN");
  });

  it("generates .env.op file with 1Password URIs", () => {
    init("test-agent");
    const envOpFile = join(tmpDir, "test-agent", ".env.op");
    expect(existsSync(envOpFile)).toBe(true);
    const content = readFileSync(envOpFile, "utf-8");
    expect(content).toContain("op://");
    expect(content).toContain("op://Lituanic/Anthropic/api-key");
    expect(content).toContain("op://Lituanic/Slack/bot-token");
    expect(content).toContain("op://Lituanic/Slack/app-token");
    expect(content).toContain("op://Lituanic/Linear/api-key");
    expect(content).toContain("op://Lituanic/GitHub/token");
  });

  it("generates lituanic.config.ts with project name", () => {
    init("my-bot");
    const configFile = join(tmpDir, "my-bot", "lituanic.config.ts");
    expect(existsSync(configFile)).toBe(true);
    const content = readFileSync(configFile, "utf-8");
    expect(content).toContain('name: "my-bot"');
  });

  it("generates CLAUDE.md for agent identity", () => {
    init("test-agent");
    const claudeMd = join(tmpDir, "test-agent", ".claude", "CLAUDE.md");
    expect(existsSync(claudeMd)).toBe(true);
    const content = readFileSync(claudeMd, "utf-8");
    expect(content).toContain("AI coworker");
  });

  it("generates data/memory/MEMORY.md", () => {
    init("test-agent");
    const memoryFile = join(tmpDir, "test-agent", "data", "memory", "MEMORY.md");
    expect(existsSync(memoryFile)).toBe(true);
  });

  it("generates .gitignore", () => {
    init("test-agent");
    const gitignore = join(tmpDir, "test-agent", ".gitignore");
    expect(existsSync(gitignore)).toBe(true);
    const content = readFileSync(gitignore, "utf-8");
    expect(content).toContain("node_modules/");
    expect(content).toContain(".env");
    expect(content).toContain(".env.op");
    expect(content).toContain("data/.last-backup");
  });

  it("copies built-in skills directory", () => {
    init("test-agent");
    const skillsDir = join(tmpDir, "test-agent", ".claude", "skills");
    expect(existsSync(skillsDir)).toBe(true);
  });

  it("does not overwrite existing .env", () => {
    init("test-agent");
    const envFile = join(tmpDir, "test-agent", ".env");
    const original = readFileSync(envFile, "utf-8");

    // Run init again in same dir (using '.')
    process.chdir(join(tmpDir, "test-agent"));
    init(".");
    const after = readFileSync(envFile, "utf-8");
    expect(after).toBe(original);
  });

  it("does not overwrite existing .env.op", () => {
    init("test-agent");
    const envOpFile = join(tmpDir, "test-agent", ".env.op");
    const original = readFileSync(envOpFile, "utf-8");

    process.chdir(join(tmpDir, "test-agent"));
    init(".");
    const after = readFileSync(envOpFile, "utf-8");
    expect(after).toBe(original);
  });

  it("uses 'my-agent' as name when using '.'", () => {
    init(".");
    const configFile = join(tmpDir, "lituanic.config.ts");
    expect(existsSync(configFile)).toBe(true);
    const content = readFileSync(configFile, "utf-8");
    expect(content).toContain('name: "my-agent"');
  });
});
