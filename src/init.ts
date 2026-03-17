import { existsSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";

const AGENT_IDENTITY = `# Agent Identity

You are an AI coworker — not an assistant. You work autonomously, make decisions,
and report results. You have your own accounts, memory, and tools.

## How you work

- Check Linear for assigned issues and work on them without being asked.
- When you finish work, update the issue status and comment with a summary.
- Use Slack to communicate results, ask for approvals, and report blockers.
- Write daily logs to data/memory/ so you remember what you did.
- When working on code: read first, understand, then change. Run tests.

## Rules

- Never deploy to production without approval.
- Never post secrets, tokens, or API keys to Slack.
- Keep Slack messages concise — bullet points, not essays.
- When unsure, ask in Slack rather than guessing.
- Use reactions to acknowledge work: :eyes: (seen), :hourglass_flowing_sand: (working), :white_check_mark: (done).
`;

const CONFIG_TEMPLATE = `import { defineConfig } from "lituanic";

export default defineConfig({
  name: "{{NAME}}",

  // Slack — set env vars or configure here
  // slack: {
  //   botToken: process.env.SLACK_BOT_TOKEN!,
  //   appToken: process.env.SLACK_APP_TOKEN!,
  //   channel: "C0123456789", // ops channel
  // },

  // Uncomment to enable Linear webhooks
  // webhook: {
  //   port: 9100,
  //   routes: {
  //     "/webhook/linear": {
  //       secret: process.env.LINEAR_WEBHOOK_SECRET,
  //       verify: "hmac-sha256",
  //     },
  //   },
  // },

  // Uncomment to add scheduled tasks
  // schedule: [
  //   {
  //     cron: "*/15 * * * *",
  //     prompt: "Check Linear for assigned issues and work on them.",
  //     timezone: "UTC",
  //   },
  // ],
});
`;

const ENV_TEMPLATE = `# Required
ANTHROPIC_API_KEY=

# Slack (Socket Mode)
SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=

# Linear (optional)
LINEAR_API_KEY=
LINEAR_WEBHOOK_SECRET=

# 1Password (optional — or use op run --env-file=.env.op)
# OP_SERVICE_ACCOUNT_TOKEN=
`;

const MEMORY_TEMPLATE = `# Memory

Agent memory will be written here during operation.
`;

export function init(name: string) {
  const cwd = process.cwd();
  const projectDir = name === "." ? cwd : join(cwd, name);

  if (name !== "." && existsSync(projectDir)) {
    console.error(`Directory "${name}" already exists.`);
    process.exit(1);
  }

  console.log(`\nInitializing Lituanic agent: ${name === "." ? "current directory" : name}\n`);

  // Create directories
  const dirs = [
    projectDir,
    join(projectDir, ".claude", "skills"),
    join(projectDir, "data", "memory"),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  // Copy built-in skills from package
  const packageSkillsDir = join(import.meta.dir, "..", ".claude", "skills");
  if (existsSync(packageSkillsDir)) {
    cpSync(packageSkillsDir, join(projectDir, ".claude", "skills"), { recursive: true });
    console.log("  copied .claude/skills/ (slack, linear, op, gws, browser, github)");
  }

  // Write agent identity
  const claudeMd = join(projectDir, ".claude", "CLAUDE.md");
  if (!existsSync(claudeMd)) {
    writeFileSync(claudeMd, AGENT_IDENTITY);
    console.log("  created .claude/CLAUDE.md (agent identity)");
  }

  // Write config
  const configFile = join(projectDir, "lituanic.config.ts");
  if (!existsSync(configFile)) {
    writeFileSync(configFile, CONFIG_TEMPLATE.replace("{{NAME}}", name === "." ? "my-agent" : name));
    console.log("  created lituanic.config.ts");
  }

  // Write .env
  const envFile = join(projectDir, ".env");
  if (!existsSync(envFile)) {
    writeFileSync(envFile, ENV_TEMPLATE);
    console.log("  created .env (fill in your tokens)");
  }

  // Write memory
  const memoryFile = join(projectDir, "data", "memory", "MEMORY.md");
  if (!existsSync(memoryFile)) {
    writeFileSync(memoryFile, MEMORY_TEMPLATE);
    console.log("  created data/memory/MEMORY.md");
  }

  // Write .gitignore if not exists
  const gitignore = join(projectDir, ".gitignore");
  if (!existsSync(gitignore)) {
    writeFileSync(gitignore, `node_modules/\n.env\n.env.op\n*.log\ndata/memory/????-??-??.md\ndata/sessions/\ndata/*/MEMORY.md\n!data/memory/MEMORY.md\n`);
    console.log("  created .gitignore");
  }

  console.log(`
Done! Next steps:

  1. Fill in your API keys:
     ${name !== "." ? `cd ${name} && ` : ""}nano .env

  2. Start the agent:
     bun start

  Or with 1Password:
     op run --env-file=.env.op -- bun start

  Check your setup:
     bunx lituanic doctor
`);
}
