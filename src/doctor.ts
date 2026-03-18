import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CMD_TIMEOUT_MS = 5_000;

export interface Check {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

function env(key: string): boolean {
  return !!process.env[key];
}

function cmd(command: string): boolean {
  try {
    execSync(command, { stdio: "ignore", timeout: CMD_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

export async function doctor(dataDir?: string): Promise<Check[]> {
  const checks: Check[] = [];

  // Core
  checks.push({
    name: "ANTHROPIC_API_KEY",
    status: env("ANTHROPIC_API_KEY") ? "ok" : "fail",
    detail: env("ANTHROPIC_API_KEY") ? "Set" : "Missing — required for Claude",
  });

  // 1Password
  const hasOp = cmd("op --version");
  checks.push({
    name: "op CLI",
    status: hasOp ? "ok" : "warn",
    detail: hasOp ? "Installed" : "Not found — install: https://1password.com/downloads/cli",
  });

  const hasOpToken = env("OP_SERVICE_ACCOUNT_TOKEN");
  checks.push({
    name: "OP_SERVICE_ACCOUNT_TOKEN",
    status: hasOpToken ? "ok" : "warn",
    detail: hasOpToken
      ? "Set — 1Password secrets available"
      : "Not set — using plaintext env vars (consider op run --env-file=.env.op)",
  });

  // Slack
  checks.push({
    name: "Slack bot token",
    status: env("SLACK_BOT_TOKEN") ? "ok" : "warn",
    detail: env("SLACK_BOT_TOKEN") ? "Set" : "Missing — Slack gateway disabled",
  });
  checks.push({
    name: "Slack app token",
    status: env("SLACK_APP_TOKEN") ? "ok" : "warn",
    detail: env("SLACK_APP_TOKEN") ? "Set" : "Missing — Socket Mode disabled",
  });

  // Linear (GraphQL API via curl — no CLI needed)
  const hasLinear = env("LINEAR_API_KEY");
  checks.push({
    name: "Linear API key",
    status: hasLinear ? "ok" : "warn",
    detail: hasLinear ? "Set" : "Missing — Linear integration disabled",
  });

  // GitHub
  const hasGh = cmd("gh --version");
  checks.push({
    name: "gh CLI",
    status: hasGh ? "ok" : "warn",
    detail: hasGh ? "Installed" : "Not found — install: https://cli.github.com",
  });
  checks.push({
    name: "GH_TOKEN",
    status: env("GH_TOKEN") || env("GITHUB_TOKEN") ? "ok" : "warn",
    detail: env("GH_TOKEN") || env("GITHUB_TOKEN") ? "Set" : "Missing — GitHub integration disabled",
  });

  // Browser
  const hasBrowser = cmd("agent-browser --version");
  checks.push({
    name: "agent-browser CLI",
    status: hasBrowser ? "ok" : "warn",
    detail: hasBrowser ? "Installed" : "Not found — install: npm i -g agent-browser && agent-browser install",
  });

  // Google Workspace
  const hasGws = cmd("gws --version");
  checks.push({
    name: "gws CLI",
    status: hasGws ? "ok" : "warn",
    detail: hasGws ? "Installed" : "Not found — install: npm i -g @googleworkspace/cli",
  });
  checks.push({
    name: "GWS credentials",
    status: env("GWS_CLIENT_ID") ? "ok" : "warn",
    detail: env("GWS_CLIENT_ID") ? "Set" : "Missing — Google Workspace disabled",
  });

  // Backup health check
  const resolvedDataDir = dataDir ?? "./data";
  const markerFile = join(resolvedDataDir, ".last-backup");
  if (existsSync(markerFile)) {
    try {
      const timestamp = readFileSync(markerFile, "utf-8").trim();
      const lastBackup = new Date(timestamp);
      if (isNaN(lastBackup.getTime())) {
        throw new Error("Invalid date");
      }
      const hoursAgo = (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60);
      if (hoursAgo <= 48) {
        checks.push({
          name: "Backup",
          status: "ok",
          detail: `Last backup: ${timestamp} (${Math.floor(hoursAgo)}h ago)`,
        });
      } else {
        checks.push({
          name: "Backup",
          status: "warn",
          detail: `Last backup: ${timestamp} (${Math.floor(hoursAgo)}h ago — stale, check rclone cron)`,
        });
      }
    } catch {
      checks.push({
        name: "Backup",
        status: "warn",
        detail: "Corrupt .last-backup marker file",
      });
    }
  } else {
    checks.push({
      name: "Backup",
      status: "warn",
      detail: "No backup marker found — backups not configured (see deploy/backup.sh)",
    });
  }

  return checks;
}

export function printDoctor(checks: Check[]) {
  const icons = { ok: "\u2713", warn: "!", fail: "\u2717" };
  const colors = { ok: "\x1b[32m", warn: "\x1b[33m", fail: "\x1b[31m" };
  const reset = "\x1b[0m";

  console.log("\nlituanic doctor\n");

  for (const check of checks) {
    const icon = icons[check.status];
    const color = colors[check.status];
    console.log(`  ${color}${icon}${reset} ${check.name}: ${check.detail}`);
  }

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const oks = checks.filter((c) => c.status === "ok").length;

  console.log(`\n  ${oks} ok, ${warns} warnings, ${fails} failures\n`);

  if (fails > 0) process.exit(1);
}
