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
- `src/format.ts` — Markdown → Slack mrkdwn converter (shared by index + tools)
- `src/doctor.ts` — Integration health checks (env vars, CLI availability, backup status)
- `src/config.ts` — Zod config with opinionated defaults
- `src/index.ts` — Daemon boot + typing indicator + notification forwarding
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

deploy/
├── lituanic.service       # systemd unit (1Password + security hardening)
├── backup.sh              # rclone data backup script (cron)
├── backup.cron            # cron schedule for backup.sh
├── setup.sh               # VPS bootstrap (installs bun, op, rclone)
└── .env.op.template       # 1Password secret reference template

src/
├── __tests__/             # Bun test suite
│   ├── config.test.ts
│   ├── doctor.test.ts
│   ├── format.test.ts
│   ├── init.test.ts
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

## Production VPS deployment

### Authentication

Lituanic accepts either a Claude Pro/Max OAuth token or an Anthropic API key:

- **OAuth token (recommended):** Run `claude setup-token` in a browser, store the resulting `sk-ant-oat01-...` token as `CLAUDE_CODE_OAUTH_TOKEN`. Uses your subscription instead of pay-per-use API billing.
- **API key:** Set `ANTHROPIC_API_KEY` for traditional pay-per-use billing.

The Agent SDK reads `CLAUDE_CODE_OAUTH_TOKEN` natively — no custom auth code in Lituanic.

### Secret management — 1Password first

All secrets live in 1Password. Zero plaintext on disk.

1. Create a 1Password service account with access to a "Lituanic" vault
2. Store all secrets as items in the vault (Claude OAuth token or Anthropic API key, Slack, Linear, GitHub)
3. On the VPS, `.env.op` contains `op://` URI references (not secret values)
4. systemd runs `op run --env-file=.env.op -- bun start` to resolve secrets at process start
5. The only plaintext secret is `OP_SERVICE_ACCOUNT_TOKEN` in a root-only systemd override

### Quick VPS setup

```bash
# Run the setup script on a fresh Ubuntu/Debian VPS
bash deploy/setup.sh

# Then set the 1Password bootstrap token
sudo mkdir -p /etc/systemd/system/lituanic.service.d
sudo tee /etc/systemd/system/lituanic.service.d/override.conf <<EOF
[Service]
Environment=OP_SERVICE_ACCOUNT_TOKEN=ops_YOUR_TOKEN
EOF
sudo chmod 600 /etc/systemd/system/lituanic.service.d/override.conf
sudo systemctl daemon-reload
sudo systemctl start lituanic
```

### Backups

`deploy/backup.sh` runs via cron (daily 4 AM UTC), syncs `data/` to Google Drive via rclone.
Writes a `.last-backup` marker file that `lituanic doctor` checks for staleness (>48h = warning).

### What lives where

| Layer | What it stores | Backup |
|-------|---------------|--------|
| GitHub | Code, skills, workflows, CLAUDE.md | Git history |
| 1Password | All secrets | 1Password replication |
| Google Drive | data/ (memory, daily logs, sessions) | rclone daily sync |
| VPS | Runtime process only — fully reproducible | Disposable |
