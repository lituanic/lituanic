# Lituanic

AI coworker for solo founders. Picks up Linear issues, writes code, sends email, and reports back to Slack — autonomously.

Named after the 1933 transatlantic flight by Steponas Darius and Stasys Girenas — two people, one plane, crossing the Atlantic with what they had.

## Thesis

Most agent frameworks build orchestration for teams of humans managing fleets of agents. Lituanic solves the opposite: **one person running an entire company through one agent.**

This is what smart contracts promised — code-first, zero-human operations. Lituanic delivers it with LLMs: an AI coworker that manages projects, writes code, ships products, handles email, and reports back to Slack.

Lituanic is a thin wiring layer on the Claude Agent SDK. The SDK does all the hard work — agent loop, tool calling, sessions, compaction, subagents, sandboxing. Lituanic wires it to Slack and adds opinionated defaults. When Anthropic ships an SDK update, Lituanic gets better for free.

**~1,300 lines of TypeScript. 4 built-in integrations. 3 dependencies.**

## Built-in integrations

| Integration | How | Env vars |
|---|---|---|
| **Slack** | Typed MCP tools + Bolt gateway | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` |
| **Linear** | SKILL.md + GraphQL API via curl | `LINEAR_API_KEY` |
| **1Password** | SKILL.md + `op` CLI via Bash | `OP_SERVICE_ACCOUNT_TOKEN` |
| **Google Workspace** | SKILL.md + `gws` CLI via Bash | `GWS_CLIENT_ID` + credentials |

Slack is the only typed MCP tool because mistakes are visible to humans. Linear uses its GraphQL API via curl (no CLI exists). 1Password and GWS use their respective CLI tools. The agent uses all of these via Bash, which the SDK provides for free.

Adding an integration = writing one SKILL.md file + adding env checks to `doctor.ts`.

## Quick start

```bash
mkdir my-agent && cd my-agent
bun init -y
bun add lituanic
```

```typescript
// lituanic.config.ts
import { defineConfig } from "lituanic";

export default defineConfig({
  name: "my-agent",
  model: "claude-sonnet-4-6",
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN!,
    appToken: process.env.SLACK_APP_TOKEN!,
  },
});
```

```bash
bun start
```

Your agent is live in Slack with access to: file system, shell, web search, subagents, and any CLI tool installed on the host.

### Check your setup

```
$ lituanic doctor

  ✓ ANTHROPIC_API_KEY: Set
  ✓ Slack bot token: Set
  ✓ Slack app token: Set
  ✓ Linear API key: Set
  ✓ op CLI: Installed
  ! gws CLI: Not found — install: npm i -g @googleworkspace/cli
  ! GWS credentials: Missing — Google Workspace disabled

  5 ok, 2 warnings, 0 failures
```

### Add a skill

```bash
mkdir -p .claude/skills/deploy
cat > .claude/skills/deploy/SKILL.md << 'EOF'
---
name: deploy
description: Deploy to production. Use when asked to "deploy", "ship it", or "push to prod".
---

1. Run tests: `bun test`
2. Push: `git push origin main`
3. Wait for CI, then check health
4. Report status in Slack
EOF
```

No code change. No restart. The agent immediately knows how to deploy.

### Add an MCP server

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       lituanic (~1,000 LOC)                   │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ gateway.ts  │  │ sessions.ts │  │ Claude Agent SDK     │ │
│  │             │  │             │  │ query()              │ │
│  │ Slack Bolt  │  │ thread →    │  │                      │ │
│  │ Webhooks    │──│ session_id  │─▶│ Built-in tools:      │ │
│  │ Cron        │  │ resume      │  │ Bash Read Write Edit │ │
│  │ Chan queue  │  │             │  │ Glob Grep WebFetch   │ │
│  └─────────────┘  └─────────────┘  │ WebSearch Agent Skill│ │
│                                    │                      │ │
│  ┌─────────────┐  ┌─────────────┐  │ SDK handles:         │ │
│  │ tools.ts    │  │ doctor.ts   │  │ • Agent loop         │ │
│  │             │  │             │  │ • Session persist     │ │
│  │ slack_reply │  │ env checks  │  │ • Compaction          │ │
│  │ slack_react │  │ CLI checks  │  │ • Subagents           │ │
│  │ (MCP tools) │  │ health      │  │ • Sandbox             │ │
│  └─────────────┘  └─────────────┘  │ • File checkpointing │ │
│                                    │ • Thinking            │ │
│  .claude/skills/ (loaded by SDK)   │ • Permissions         │ │
│  ├── slack/SKILL.md                │ • Notifications       │ │
│  ├── linear/SKILL.md               │ • Cost tracking       │ │
│  ├── op/SKILL.md                   └──────────────────────┘ │
│  └── gws/SKILL.md                                           │
└──────────────────────────────────────────────────────────────┘
```

### What Lituanic owns (the wiring)

| File | LOC | Purpose |
|---|---|---|
| `gateway.ts` | 299 | Slack Bolt + webhooks (Linear state machine) + cron + per-channel queue |
| `think.ts` | 188 | `query()` wrapper: session resume, effort routing, canUseTool, progress |
| `index.ts` | 163 | Daemon boot, typing indicator, notification forwarding |
| `doctor.ts` | 96 | Integration health checks |
| `config.ts` | 81 | Zod config with opinionated defaults |
| `cli.ts` | 66 | CLI: start, doctor, health, version |
| `memory.ts` | 65 | Daily logs + per-channel state |
| `sessions.ts` | 40 | Slack thread to SDK session_id mapping |
| `tools.ts` | 40 | Slack MCP tools (only typed integration) |
| **Total** | **~1,038** | |

### What the Agent SDK owns (delegated)

Every time Anthropic ships an SDK update, Lituanic gets better for free.

| SDK capability | What we skip building |
|---|---|
| Agent loop + tool calling | No custom loop code |
| Built-in Bash, Read, Write, Edit, Glob, Grep | No tool reimplementation |
| Built-in WebSearch, WebFetch | No HTTP wrappers |
| Skill tool + `.claude/skills/` loading | No skill discovery code |
| CLAUDE.md loading via `settingSources` | No system prompt assembly |
| System prompt (`claude_code` preset) | No prompt engineering |
| Session persistence + resume + fork | Just store the session_id |
| Context compaction | No manual context management |
| Subagent orchestration (Agent tool) | No multi-agent plumbing |
| Sandbox (filesystem + network isolation) | No Docker code |
| `canUseTool` callback | Inline security, no separate module |
| File checkpointing + rewind | Free rollback on error |
| Adaptive thinking | Automatic on Opus/Sonnet 4.6 |
| Effort control (low/medium/high/max) | One line: `effort: "high"` |
| Environment passthrough | `env: process.env` |
| Model fallback | `fallbackModel: "claude-haiku-4-5"` |
| Notification hooks | Forward to Slack |
| Cost tracking + budget limits | `maxBudgetUsd: 5.0` |
| MCP server management | Connect any MCP server |

### Integration philosophy

```
                    Typed MCP tools              SKILL.md + CLI via Bash
                    (mistakes are costly)        (CLI teams maintain their tools)
                    ────────────────────         ──────────────────────────────
Slack               ✓ slack_reply
                    ✓ slack_react
Linear                                           ✓ GraphQL API via curl
1Password                                        ✓ op CLI
Google Workspace                                 ✓ gws CLI
```

**Why Slack gets typed tools:** wrong-channel prevention, thread enforcement, Slack markdown formatting. Mistakes are immediately visible to humans.

**Why everything else is SKILL.md + CLI:** the `linear` CLI, `op` CLI, and `googleworkspace` CLI are well-designed, typed, maintained by their respective companies. When they ship updates, our agent uses new features immediately with zero code changes. We maintain knowledge (SKILL.md), not integration code.

## Session continuity

Slack thread = Agent SDK session. Follow-ups resume with full context.

```
User:  @agent set up the new API endpoint
Agent: [reads code, creates files, runs tests, reports back]
       └── session stored: channel:thread → sess_abc123

User:  (same thread) now add rate limiting
Agent: [resumes sess_abc123 — knows what was built, adds rate limiting]
```

The SDK handles context window management, compaction, and session persistence to disk. Lituanic just maps Slack threads to session IDs.

## Subagents

Claude spawns parallel workers via the built-in Agent tool:

```
User: @agent research competitors, build the landing page, and set up CI

Agent: Working on these in parallel.
  ├── [Subagent] Researching competitors via WebSearch...
  ├── [Subagent] Building landing page with Read/Write/Edit...
  └── [Subagent] Setting up CI with Bash...

Agent: All three done. Here's the summary.
```

Claude decides when to parallelize. No orchestration code needed.

## Skills

Skills are SKILL.md files in `.claude/skills/`. The SDK loads them via `settingSources: ["project"]` and invokes them via the `Skill` tool when the task matches the description.

```
.claude/skills/
├── slack/SKILL.md       # When to use Slack tools, formatting rules
├── linear/SKILL.md      # CLI commands, workpad pattern, autonomous work
├── op/SKILL.md          # Secret reading, security rules, patterns
└── gws/SKILL.md         # Email, calendar, drive commands
```

Add your own:
```
.claude/skills/
└── deploy/SKILL.md      # Your deployment procedure
```

The `description` in frontmatter is how Claude decides whether to load the skill. Write it like a search result — specific, with trigger phrases.

## Configuration

```typescript
// lituanic.config.ts
import { defineConfig } from "lituanic";

export default defineConfig({
  name: "my-agent",
  model: "claude-sonnet-4-6",
  fallbackModel: "claude-haiku-4-5",
  cwd: "/home/agent/workspace",

  slack: {
    botToken: process.env.SLACK_BOT_TOKEN!,
    appToken: process.env.SLACK_APP_TOKEN!,
    channel: "C0AKA6Y53D2",  // ops channel for errors + notifications
  },

  webhook: {
    port: 9100,
    routes: {
      "/webhook/linear": {
        secret: process.env.LINEAR_WEBHOOK_SECRET,
        verify: "hmac-sha256",
      },
    },
  },

  schedule: [
    { cron: "0 9,15 * * *", prompt: "Run the x-post skill.", timezone: "Europe/Madrid" },
    { cron: "*/15 * * * *", prompt: "Check Linear for assigned issues and work on them." },
  ],

  maxBudgetUsd: 5.0,
  maxTurns: 50,
  sandbox: false,
});
```

### Secrets

```bash
# Development
export ANTHROPIC_API_KEY=sk-ant-...
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_APP_TOKEN=xapp-...
bun start

# Production (1Password)
op run --env-file=.env.op -- bun start
```

## Deploy

```ini
# /etc/systemd/system/lituanic.service
[Service]
Type=simple
User=agent
WorkingDirectory=/home/agent/lituanic
ExecStart=/usr/local/bin/op run --env-file=.env.op -- /usr/local/bin/bun run src/cli.ts
Restart=on-failure
RestartSec=10
```

Health check built in: `GET :9200/health` returns JSON.

## Comparisons

### vs. Pi-mom

| | Pi-mom | Lituanic |
|---|---|---|
| Codebase | Closed-source npm + 8 monkey patches | ~1,000 LOC, open source |
| Concurrency | Serial per channel, no subagents | SDK subagents, parallel work |
| Sessions | context.jsonl (custom, fragile) | SDK session persist + resume |
| Integrations | Custom extensions in host process | Skills + CLI via Bash |
| Config | Undocumented settings.json | Zod-validated TypeScript |

### vs. NanoClaw

| | NanoClaw | Lituanic |
|---|---|---|
| Runtime | Node.js + Docker per group | Bun, single process |
| Parallelism | 5 containers, per-group serial | SDK subagents, Claude decides |
| Storage | SQLite | Filesystem |
| Channels | WhatsApp, Telegram, Discord, Slack, Gmail | Slack + webhooks |
| Design | Multi-group multi-container | Single operator |

### vs. OpenClaw

| | OpenClaw | Lituanic |
|---|---|---|
| Scope | 20+ channels, 5400+ skills, voice, canvas | Slack + 4 integrations |
| Codebase | 19,800+ commits | ~1,000 LOC |
| Security | 500+ open issues | Minimal surface, single tenant |
| Design | Everything for everyone | One founder, one company |

## Design decisions

**Why Claude only.** When you bet on one model, you use every feature: adaptive thinking, Agent SDK, skills, sessions, subagents, compaction. Multi-provider abstraction means lowest-common-denominator.

**Why Slack only.** Slack IS the control plane. Every founder already has it open. Adding 20 messaging platforms is OpenClaw's problem, not ours.

**Why no database.** Files are inspectable, portable, diffable, git-native. Directory structure = schema. The SDK persists sessions to `~/.claude/projects/`. We persist daily logs and thread mappings to `data/`.

**Why skills over typed tools.** CLI tools (`op`, `gws`) and APIs (Linear GraphQL) are maintained by their respective companies. When they ship updates, our agent benefits immediately. We maintain knowledge (SKILL.md), not integration code. Zero maintenance surface for 3 of 4 integrations.

**Why parasite architecture.** The Claude Agent SDK is backed by a $10B+ company investing heavily in making agents work. Every improvement to the SDK — better compaction, faster loop, new tools, improved sandbox — flows directly to Lituanic with a version bump. We write the thinnest possible wiring layer and get out of the way.

## Principles

1. **Parity.** Whatever a human can do through a UI, the agent achieves through tools.
2. **Atomic primitives.** Bash, Read, Write, Edit — not `analyze_and_publish`.
3. **Knowledge over code.** New capabilities = new SKILL.md files, not new TypeScript.
4. **Maximum parasitism.** Delegate everything possible to the Agent SDK. Own only the wiring.
5. **Files as interface.** Inspectable, portable, diffable, versioned.
6. **Single operator.** One agent, one owner, one Slack. Won't scale to 100 users. Doesn't need to.
7. **Timeless.** Small surface area. Version 1.0 should last years.

## License

MIT
