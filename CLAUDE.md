# Lituanic

AI coworker for solo founders. Thin wiring layer on the Claude Agent SDK.

Ships with 5 built-in integrations: Slack, Linear, 1Password, Google Workspace, Browser.

## Commit convention

Every commit message MUST start with a conventional prefix: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, or `perf:`.

## Architecture — maximum parasitism

Lituanic owns only the Slack gateway wiring. Everything else is the Agent SDK or CLI tools.

### Lituanic owns (the wiring)

- `src/gateway.ts` — Slack Bolt + webhooks (with Linear state machine) + cron + per-channel queue
- `src/think.ts` — Thin `query()` wrapper: session resume, effort routing, canUseTool, progress streaming
- `src/tools.ts` — Slack MCP tools (slack_reply, slack_react) — the only typed tools
- `src/sessions.ts` — Slack thread → SDK session_id mapping
- `src/memory.ts` — Daily logs + per-channel state
- `src/doctor.ts` — Integration health checks (env vars, CLI availability)
- `src/config.ts` — Zod config with opinionated defaults
- `src/index.ts` — Daemon boot + typing indicator + notification forwarding
- `src/cli.ts` — CLI entry point (start, doctor, health, version)

### Agent SDK owns (delegated)

- Agent loop, tool calling, streaming, retries, compaction
- Built-in tools: Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
- Subagents (Agent tool), Skills (Skill tool), session persistence + resume + fork
- System prompt (Claude Code preset), CLAUDE.md + skills loading
- Sandbox, permissions (canUseTool), file checkpointing
- Adaptive thinking, effort control, environment passthrough
- Cost tracking, budget limits, model fallback, notifications

### Integration philosophy

Slack is the only typed MCP tool (mistakes are visible to humans).
Linear uses GraphQL API via curl (no CLI exists).
1Password uses `op` CLI, Google Workspace uses `gws` CLI — both via Bash.
Adding an integration = writing a SKILL.md + checking env vars in doctor.ts.

## Built-in integrations

| Integration | How it works | Env vars needed |
|-------------|-------------|-----------------|
| Slack | MCP tools (slack_reply, slack_react) + Bolt gateway | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` |
| Linear | SKILL.md + GraphQL API via curl | `LINEAR_API_KEY` |
| 1Password | SKILL.md + `op` CLI via Bash | `OP_SERVICE_ACCOUNT_TOKEN` |
| Google Workspace | SKILL.md + `gws` CLI via Bash | `GWS_CLIENT_ID`, GWS credentials |
| Browser | SKILL.md + `agent-browser` CLI via Bash | None (optional: `KERNEL_API_KEY` for cloud) |

## Directory layout

```
CLAUDE.md                  # This file (loaded by SDK at project root)
.claude/
├── skills/                # Built-in skills (loaded by SDK via settingSources)
│   ├── slack/SKILL.md
│   ├── linear/SKILL.md
│   ├── op/SKILL.md
│   ├── gws/SKILL.md
│   └── browser/SKILL.md

data/
├── memory/MEMORY.md       # Daily logs (runtime)
├── sessions/active.json   # Thread → session mapping (runtime, gitignored)
└── <channelId>/MEMORY.md  # Per-channel state (runtime, gitignored)
```

## Dependencies (3 + zod)

- `@anthropic-ai/claude-agent-sdk` — everything
- `@slack/bolt` — Slack gateway
- `croner` — cron scheduler
- `zod` — config validation + MCP tool schemas
