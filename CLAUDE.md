# Lituanic

AI coworker for solo founders. Thin wiring layer on the Claude Agent SDK.

Ships with 6 built-in integrations: Slack, Linear, 1Password, Google Workspace, Browser, GitHub.

## Commit convention

Every commit message MUST start with a conventional prefix: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, or `perf:`.

## Architecture — maximum parasitism

Lituanic owns only the Slack gateway wiring. Everything else is the Agent SDK or CLI tools.

### Lituanic owns (the wiring)

- `src/gateway.ts` — Slack Bolt + webhooks (with Linear state machine) + cron + per-channel queue
- `src/think.ts` — Thin `query()` wrapper: session resume, effort routing, canUseTool, progress streaming, debug logging (model, tokens, latency, cost)
- `src/tools.ts` — Slack MCP tools (slack_reply, slack_react, slack_upload_file) — the only typed tools
- `src/sessions.ts` — Slack thread → SDK session_id mapping
- `src/memory.ts` — Daily logs + per-channel state
- `src/doctor.ts` — Integration health checks (env vars, CLI availability)
- `src/config.ts` — Zod config with opinionated defaults
- `src/index.ts` — Daemon boot + typing indicator + notification forwarding + mrkdwn formatting
- `src/cli.ts` — CLI entry point (start, doctor, health, version)
- `src/init.ts` — `lituanic init` scaffolding (creates project from template)

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
| Slack | MCP tools (slack_reply, slack_react, slack_upload_file) + Bolt gateway | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` |
| Linear | SKILL.md + GraphQL API via curl | `LINEAR_API_KEY` |
| 1Password | SKILL.md + `op` CLI via Bash | `OP_SERVICE_ACCOUNT_TOKEN` |
| Google Workspace | SKILL.md + `gws` CLI via Bash | `GWS_CLIENT_ID`, GWS credentials |
| Browser | SKILL.md + `agent-browser` CLI via Bash | None (optional: `KERNEL_API_KEY` for cloud) |
| GitHub | SKILL.md + `gh` CLI via Bash | `GH_TOKEN` |

## Directory layout

```
CLAUDE.md                  # This file (loaded by SDK at project root)
.claude/
├── skills/                # Built-in skills (loaded by SDK via settingSources)
│   ├── slack/SKILL.md
│   ├── linear/SKILL.md
│   ├── op/SKILL.md
│   ├── gws/SKILL.md
│   ├── browser/SKILL.md
│   └── github/SKILL.md

.github/
├── workflows/
│   ├── ci.yml             # Lint + test on PR
│   ├── deploy.yml         # VPS deploy on push to main
│   └── release.yml        # npm publish on GitHub release

src/
├── __tests__/             # Bun test suite
│   ├── config.test.ts
│   ├── sessions.test.ts
│   └── smoke.test.ts

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
