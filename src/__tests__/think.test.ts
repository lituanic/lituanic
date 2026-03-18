import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { ThinkOptions, ThinkResult } from "../think.js";

// Mock SDK message factories matching real SDK types
function makeInitMessage(overrides: Partial<{
  session_id: string;
  model: string;
  tools: string[];
}> = {}) {
  return {
    type: "system" as const,
    subtype: "init" as const,
    session_id: overrides.session_id ?? "sess-001",
    model: overrides.model ?? "claude-sonnet-4-6",
    tools: overrides.tools ?? ["Read", "Write", "Bash"],
    apiKeySource: "user" as const,
    betas: [],
    claude_code_version: "1.0.0",
    cwd: "/tmp",
    mcp_servers: [],
    permissionMode: "bypassPermissions" as const,
    slash_commands: [],
    output_style: "concise",
    skills: [],
    plugins: [],
    uuid: "00000000-0000-0000-0000-000000000001" as `${string}-${string}-${string}-${string}-${string}`,
  };
}

function makeAssistantMessage(content: Array<
  { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
>, overrides: Partial<{ input_tokens: number; output_tokens: number }> = {}) {
  return {
    type: "assistant" as const,
    message: {
      id: "msg-001",
      type: "message" as const,
      role: "assistant" as const,
      model: "claude-sonnet-4-6",
      content,
      stop_reason: "end_turn" as const,
      stop_sequence: null,
      usage: {
        input_tokens: overrides.input_tokens ?? 100,
        output_tokens: overrides.output_tokens ?? 50,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    },
    parent_tool_use_id: null,
    uuid: "00000000-0000-0000-0000-000000000002" as `${string}-${string}-${string}-${string}-${string}`,
    session_id: "sess-001",
  };
}

function makeSuccessResult(result: string, overrides: Partial<{
  total_cost_usd: number;
  num_turns: number;
  duration_ms: number;
  duration_api_ms: number;
}> = {}) {
  return {
    type: "result" as const,
    subtype: "success" as const,
    result,
    is_error: false,
    num_turns: overrides.num_turns ?? 3,
    total_cost_usd: overrides.total_cost_usd ?? 0.0123,
    duration_ms: overrides.duration_ms ?? 5000,
    duration_api_ms: overrides.duration_api_ms ?? 4500,
    stop_reason: "end_turn",
    usage: {
      input_tokens: 500,
      output_tokens: 200,
      cache_read_input_tokens: 100,
      cache_creation_input_tokens: 50,
    },
    modelUsage: {
      "claude-sonnet-4-6": {
        inputTokens: 500,
        outputTokens: 200,
        cacheReadInputTokens: 100,
        cacheCreationInputTokens: 50,
        webSearchRequests: 0,
        costUSD: 0.0123,
        contextWindow: 200000,
        maxOutputTokens: 16384,
      },
    },
    permission_denials: [],
    uuid: "00000000-0000-0000-0000-000000000003" as `${string}-${string}-${string}-${string}-${string}`,
    session_id: "sess-001",
  };
}

function makeErrorResult(subtype: "error_max_turns" | "error_max_budget_usd" | "error_during_execution") {
  return {
    type: "result" as const,
    subtype,
    is_error: true,
    num_turns: 50,
    total_cost_usd: 5.0,
    duration_ms: 60000,
    duration_api_ms: 55000,
    stop_reason: null,
    usage: {
      input_tokens: 10000,
      output_tokens: 5000,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    modelUsage: {},
    permission_denials: [],
    errors: ["max turns reached"],
    uuid: "00000000-0000-0000-0000-000000000004" as `${string}-${string}-${string}-${string}-${string}`,
    session_id: "sess-001",
  };
}

// Mock query to return an async generator of SDK messages
function mockQuery(messages: unknown[]) {
  return mock((_params: unknown) => {
    async function* gen() {
      for (const msg of messages) {
        yield msg;
      }
    }
    return gen();
  });
}

// Stub dependencies
function makeStubs() {
  const logs: string[] = [];
  const dailyLogs: string[] = [];
  const sessions = new Map<string, string>();

  return {
    logs,
    dailyLogs,
    sessions,
    memory: {
      read: () => "",
      write: () => {},
      appendDailyLog: (entry: string) => dailyLogs.push(entry),
      readDailyLog: () => "",
      readChannel: (_id: string) => "",
      writeChannel: () => {},
    },
    sessionStore: {
      get: (ch: string, ts: string) => sessions.get(`${ch}:${ts}`),
      set: (ch: string, ts: string, sid: string) => sessions.set(`${ch}:${ts}`, sid),
    },
    config: {
      name: "test-agent",
      model: "claude-sonnet-4-6",
      fallbackModel: "claude-haiku-4-5",
      data: "./data",
      maxBudgetUsd: 5.0,
      maxTurns: 50,
      sandbox: false,
      blockedPatterns: [/rm\s+-rf\s+[\/~]/],
      schedule: [],
      health: { port: 9200, endpoint: "/health" },
    },
  };
}

describe("think", () => {
  let queryMock: ReturnType<typeof mockQuery>;

  // Dynamic import with mocked query
  async function runThink(
    messages: unknown[],
    eventOverrides: Partial<ThinkOptions["event"]> = {},
    optOverrides: Partial<Pick<ThinkOptions, "onProgress" | "onNotification">> = {},
  ): Promise<ThinkResult> {
    queryMock = mockQuery(messages);

    // Use Bun's module mock
    mock.module("@anthropic-ai/claude-agent-sdk", () => ({
      query: queryMock,
      tool: () => {},
      createSdkMcpServer: () => ({}),
    }));

    // Re-import to get mocked version
    const { think } = await import("../think.js");
    const stubs = makeStubs();

    return think({
      config: stubs.config as ThinkOptions["config"],
      event: {
        source: "slack",
        channelId: "C123",
        threadTs: "1234.5678",
        text: "Hello agent",
        ...eventOverrides,
      },
      memory: stubs.memory,
      sessions: stubs.sessionStore,
      ...optOverrides,
    });
  }

  beforeEach(() => {
    // Clear module cache so mock.module takes effect
    mock.restore();
  });

  it("processes init → assistant → success result", async () => {
    const result = await runThink([
      makeInitMessage(),
      makeAssistantMessage([{ type: "text", text: "I'll help you with that." }]),
      makeSuccessResult("Done! I completed the task."),
    ]);

    expect(result.response).toBe("Done! I completed the task.");
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.sessionId).toBe("sess-001");
    expect(result.costUsd).toBe(0.0123);
    expect(result.turns).toBe(3);
    expect(result.stopReason).toBe("success");
    expect(result.durationMs).toBe(5000);
    expect(result.durationApiMs).toBe(4500);
  });

  it("extracts usage tokens from result", async () => {
    const result = await runThink([
      makeInitMessage(),
      makeSuccessResult("done"),
    ]);

    expect(result.usage).toEqual({
      inputTokens: 500,
      outputTokens: 200,
      cacheReadTokens: 100,
      cacheCreationTokens: 50,
    });
  });

  it("extracts modelUsage from result", async () => {
    const result = await runThink([
      makeInitMessage(),
      makeSuccessResult("done"),
    ]);

    expect(result.modelUsage).toBeDefined();
    expect(result.modelUsage!["claude-sonnet-4-6"]).toBeDefined();
    expect(result.modelUsage!["claude-sonnet-4-6"].costUSD).toBe(0.0123);
  });

  it("handles error_max_turns result", async () => {
    const result = await runThink([
      makeInitMessage(),
      makeErrorResult("error_max_turns"),
    ]);

    expect(result.response).toContain("Hit turn limit");
    expect(result.stopReason).toBe("error_max_turns");
  });

  it("handles error_max_budget_usd result", async () => {
    const result = await runThink([
      makeInitMessage(),
      makeErrorResult("error_max_budget_usd"),
    ]);

    expect(result.response).toContain("Hit budget limit");
    expect(result.stopReason).toBe("error_max_budget_usd");
  });

  it("handles error_during_execution result", async () => {
    const result = await runThink([
      makeInitMessage(),
      makeErrorResult("error_during_execution"),
    ]);

    expect(result.response).toContain("Agent stopped:");
    expect(result.stopReason).toBe("error_during_execution");
  });

  it("calls onProgress with text content", async () => {
    const progressCalls: string[] = [];

    await runThink(
      [
        makeInitMessage(),
        makeAssistantMessage([{ type: "text", text: "Working on it..." }]),
        makeSuccessResult("done"),
      ],
      {},
      { onProgress: (text) => progressCalls.push(text) },
    );

    expect(progressCalls).toHaveLength(1);
    expect(progressCalls[0]).toBe("Working on it...");
  });

  it("logs tool_use blocks from assistant messages", async () => {
    const consoleLogs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => consoleLogs.push(args.join(" "));

    try {
      await runThink([
        makeInitMessage(),
        makeAssistantMessage([
          { type: "tool_use", id: "tu-1", name: "Bash", input: { command: "ls -la" } },
        ]),
        makeSuccessResult("done"),
      ]);

      const toolLog = consoleLogs.find((l) => l.includes("↳ Bash:"));
      expect(toolLog).toBeDefined();
      expect(toolLog).toContain("ls -la");
    } finally {
      console.log = originalLog;
    }
  });

  it("stores session for thread continuity", async () => {
    const result = await runThink([
      makeInitMessage({ session_id: "sess-001" }),
      makeSuccessResult("done"),
    ]);

    // The session_id from the result message is stored
    expect(result.sessionId).toBe("sess-001");
  });

  it("uses lower effort for cron events", async () => {
    queryMock = mockQuery([
      makeInitMessage(),
      makeSuccessResult("checked"),
    ]);

    mock.module("@anthropic-ai/claude-agent-sdk", () => ({
      query: queryMock,
      tool: () => {},
      createSdkMcpServer: () => ({}),
    }));

    const { think } = await import("../think.js");
    const stubs = makeStubs();

    await think({
      config: stubs.config as ThinkOptions["config"],
      event: {
        source: "cron",
        text: "Check status",
      },
      memory: stubs.memory,
      sessions: stubs.sessionStore,
    });

    // Verify query was called with cron-specific options
    expect(queryMock).toHaveBeenCalled();
    const callArgs = queryMock.mock.calls[0][0] as { options: { effort: string; maxTurns: number } };
    expect(callArgs.options.effort).toBe("low");
    expect(callArgs.options.maxTurns).toBe(15); // min(50, 15)
  });

  it("canUseTool blocks dangerous bash commands", async () => {
    queryMock = mockQuery([
      makeInitMessage(),
      makeSuccessResult("done"),
    ]);

    mock.module("@anthropic-ai/claude-agent-sdk", () => ({
      query: queryMock,
      tool: () => {},
      createSdkMcpServer: () => ({}),
    }));

    const { think } = await import("../think.js");
    const stubs = makeStubs();

    await think({
      config: stubs.config as ThinkOptions["config"],
      event: { source: "slack", channelId: "C123", threadTs: "1234.5678", text: "test" },
      memory: stubs.memory,
      sessions: stubs.sessionStore,
    });

    // Extract canUseTool from the query call
    const callArgs = queryMock.mock.calls[0][0] as { options: { canUseTool: Function } };
    const canUseTool = callArgs.options.canUseTool;

    // Blocked: rm -rf /home
    const denied = await canUseTool("Bash", { command: "rm -rf /home" }, { signal: new AbortController().signal, toolUseID: "tu-1" });
    expect(denied.behavior).toBe("deny");

    // Allowed: ls -la
    const allowed = await canUseTool("Bash", { command: "ls -la" }, { signal: new AbortController().signal, toolUseID: "tu-2" });
    expect(allowed.behavior).toBe("allow");

    // Non-Bash tools always allowed
    const nonBash = await canUseTool("Read", { file_path: "/etc/passwd" }, { signal: new AbortController().signal, toolUseID: "tu-3" });
    expect(nonBash.behavior).toBe("allow");
  });

  it("writes daily log entry", async () => {
    const stubs = makeStubs();
    queryMock = mockQuery([
      makeInitMessage(),
      makeSuccessResult("Task completed successfully"),
    ]);

    mock.module("@anthropic-ai/claude-agent-sdk", () => ({
      query: queryMock,
      tool: () => {},
      createSdkMcpServer: () => ({}),
    }));

    const { think } = await import("../think.js");

    await think({
      config: stubs.config as ThinkOptions["config"],
      event: {
        source: "slack",
        channelId: "C123",
        threadTs: "1234.5678",
        text: "test",
      },
      memory: stubs.memory,
      sessions: stubs.sessionStore,
    });

    expect(stubs.dailyLogs).toHaveLength(1);
    expect(stubs.dailyLogs[0]).toContain("[slack]");
    expect(stubs.dailyLogs[0]).toContain("C123");
    expect(stubs.dailyLogs[0]).toContain("$0.0123");
  });

  it("returns empty response when no result message", async () => {
    const result = await runThink([
      makeInitMessage(),
      // No result message — stream ends early
    ]);

    expect(result.response).toBe("");
    expect(result.costUsd).toBeUndefined();
  });
});
