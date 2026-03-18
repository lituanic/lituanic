import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKSystemMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKResultSuccess,
  HookInput,
} from "@anthropic-ai/claude-agent-sdk";
import type { LituanicConfig } from "./config.js";
import type { IncomingEvent } from "./gateway.js";
import type { MemoryManager } from "./memory.js";
import type { SessionStore } from "./sessions.js";
import { createSlackMcpServer } from "./tools.js";
import type { App } from "@slack/bolt";

export interface ThinkOptions {
  config: LituanicConfig;
  event: IncomingEvent;
  memory: MemoryManager;
  sessions: SessionStore;
  slack?: App;
  onNotification?: (message: string) => void;
  onProgress?: (text: string) => void;
}

export interface ThinkResult {
  response: string;
  model: string;
  sessionId?: string;
  costUsd?: number;
  turns?: number;
  stopReason?: string;
  durationMs?: number;
  durationApiMs?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  modelUsage?: Record<string, { costUSD: number; inputTokens: number; outputTokens: number }>;
}

export async function think(options: ThinkOptions): Promise<ThinkResult> {
  const { config, event, memory, sessions, slack, onNotification, onProgress } = options;

  // Session continuity: Slack thread = SDK session
  const existingSession =
    event.channelId && event.threadTs
      ? sessions.get(event.channelId, event.threadTs)
      : undefined;

  // Channel memory appended to system prompt
  let append = "";
  if (event.channelId) {
    const channelMemory = memory.readChannel(event.channelId);
    if (channelMemory) append = `\n\n## Channel Context\n\n${channelMemory}`;
  }

  // Effort: medium for interactive (saves 20-40% output tokens vs high), low for cron
  const effort = event.source === "cron" ? "low" as const : "medium" as const;

  const mcpServers: Record<string, ReturnType<typeof createSlackMcpServer>> = {};
  if (slack) mcpServers.slack = createSlackMcpServer(slack, event);

  let result = "";
  let sessionId: string | undefined;
  let costUsd: number | undefined;
  let turns: number | undefined;
  let stopReason: string | undefined;
  let durationMs: number | undefined;
  let durationApiMs: number | undefined;
  let usage: ThinkResult["usage"] | undefined;
  let modelUsage: ThinkResult["modelUsage"] | undefined;
  let resolvedModel = config.model;

  for await (const message of query({
    prompt: event.text,
    options: {
      // Session: resume existing thread or start fresh
      ...(existingSession ? { resume: existingSession } : {}),

      // Model
      model: config.model,
      fallbackModel: config.fallbackModel,
      effort,

      // Working directory
      cwd: config.cwd,

      // System prompt: Claude Code's battle-tested preset + our channel memory
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append,
      },

      // SDK loads CLAUDE.md + .claude/skills/ automatically
      settingSources: ["project"],

      // All built-in tools + subagents + skills
      allowedTools: [
        "Read", "Write", "Edit", "Bash", "Glob", "Grep",
        "WebFetch", "WebSearch", "Agent", "Skill",
      ],

      // Remove unused tool schemas from context (saves ~20K input tokens)
      // Unlike allowedTools which only controls approval, disallowedTools
      // actually removes the schemas from being sent to the model
      disallowedTools: [
        "NotebookEdit", "TodoRead", "TodoWrite",
        "EnterPlanMode", "ExitPlanMode",
        "EnterWorktree", "ExitWorktree",
      ],

      // Autonomous operation
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,

      // Safety caps: tighter limits for cron (routine checks don't need 50 turns)
      maxTurns: event.source === "cron" ? Math.min(config.maxTurns, 15) : config.maxTurns,
      maxBudgetUsd: event.source === "cron" ? Math.min(config.maxBudgetUsd, 1.0) : config.maxBudgetUsd,

      // Sandbox: SDK-native command isolation
      sandbox: config.sandbox
        ? { enabled: true, autoAllowBashIfSandboxed: true }
        : undefined,

      // Security: canUseTool for blocked patterns
      canUseTool: async (tool, input) => {
        if (tool === "Bash") {
          const command = String(input.command ?? "");
          for (const pattern of config.blockedPatterns) {
            if (pattern.test(command)) {
              return { behavior: "deny" as const, message: `Blocked: ${pattern}` };
            }
          }
        }
        return { behavior: "allow" as const, updatedInput: input };
      },

      // Environment: pass through all env vars (secrets from op run)
      // Cost optimization: 200K context window (cheaper cache fills vs 1M default)
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
        ),
        CLAUDE_CODE_DISABLE_1M_CONTEXT: "1",
      },

      // File checkpointing: free rewind on error
      enableFileCheckpointing: true,

      // MCP servers (Slack tools)
      mcpServers,

      // Notifications + progress hooks
      hooks: {
        ...(onNotification
          ? {
              Notification: [{
                hooks: [async (input: HookInput) => {
                  const msg = "message" in input ? String(input.message) : "";
                  onNotification(msg);
                  return {};
                }],
              }],
            }
          : {}),
      },
    },
  })) {
    // Init: log session + model
    if (message.type === "system" && message.subtype === "init") {
      const init = message as SDKSystemMessage;
      sessionId = init.session_id;
      resolvedModel = init.model;
      console.log(`[lituanic]   session: ${sessionId} model: ${resolvedModel} tools: ${init.tools.length}`);
    }

    // Stream progress + log tool calls + per-turn tokens
    if (message.type === "assistant") {
      const msg = message as SDKAssistantMessage;
      const content = msg.message.content;
      const msgUsage = msg.message.usage;
      for (const block of content) {
        if (block.type === "text" && block.text && onProgress) {
          onProgress(block.text.slice(0, 100));
        }
        if (block.type === "tool_use") {
          const input = block.input as Record<string, unknown>;
          const preview = block.name === "Bash"
            ? String(input.command ?? "").slice(0, 80)
            : JSON.stringify(input).slice(0, 80);
          const tokenInfo = msgUsage
            ? ` [in:${msgUsage.input_tokens} out:${msgUsage.output_tokens}]`
            : "";
          console.log(`[lituanic]   ↳ ${block.name}: ${preview}${tokenInfo}`);
        }
      }
    }

    // Final result
    if (message.type === "result") {
      const msg = message as SDKResultMessage;
      sessionId = msg.session_id ?? sessionId;
      costUsd = msg.total_cost_usd;
      turns = msg.num_turns;
      stopReason = msg.subtype;
      durationMs = msg.duration_ms;
      durationApiMs = msg.duration_api_ms;

      const u = msg.usage;
      usage = {
        inputTokens: u.input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
      };

      modelUsage = msg.modelUsage;

      // Terminal summary
      const ms = `${durationMs}ms`;
      const apiMs = `(api:${durationApiMs}ms)`;
      const tokStr = `in:${usage.inputTokens} out:${usage.outputTokens}` +
        (usage.cacheReadTokens ? ` cache↩:${usage.cacheReadTokens}` : "") +
        (usage.cacheCreationTokens ? ` cache✎:${usage.cacheCreationTokens}` : "");
      const costStr = ` $${costUsd.toFixed(4)}`;
      const modelsStr = modelUsage
        ? Object.keys(modelUsage).join("+")
        : resolvedModel;
      console.log(
        `[lituanic] → ${msg.subtype} | ${turns}t | ${ms} ${apiMs} | ${tokStr} | ${modelsStr}${costStr}`,
      );

      if (msg.subtype === "success") {
        result = (msg as SDKResultSuccess).result;
      } else if (msg.subtype === "error_max_turns") {
        result = `Hit turn limit (${config.maxTurns}). Session saved — follow up in this thread to continue.`;
      } else if (msg.subtype === "error_max_budget_usd") {
        result = `Hit budget limit ($${config.maxBudgetUsd}). Session saved — follow up to continue.`;
      } else {
        result = `Agent stopped: ${msg.subtype}`;
      }
    }
  }

  // Store session for thread continuity
  if (sessionId && event.channelId && event.threadTs) {
    sessions.set(event.channelId, event.threadTs, sessionId);
  }

  // Daily log with cost
  const summary = result.slice(0, 80).replace(/\n/g, " ");
  const costStr = costUsd !== undefined ? ` ($${costUsd.toFixed(4)})` : "";
  memory.appendDailyLog(
    `[${event.source}] ${event.channelId ?? "?"}: ${summary}${result.length > 80 ? "..." : ""}${costStr}`,
  );

  return { response: result, model: resolvedModel, sessionId, costUsd, turns, stopReason, durationMs, durationApiMs, usage, modelUsage };
}
