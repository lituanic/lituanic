import { execSync } from "node:child_process";

interface Check {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

function env(key: string): boolean {
  return !!process.env[key];
}

function cmd(command: string): boolean {
  try {
    execSync(command, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function doctor(): Promise<Check[]> {
  const checks: Check[] = [];

  // Core
  checks.push({
    name: "ANTHROPIC_API_KEY",
    status: env("ANTHROPIC_API_KEY") ? "ok" : "fail",
    detail: env("ANTHROPIC_API_KEY") ? "Set" : "Missing — required for Claude",
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

  // 1Password
  const hasOp = cmd("op --version");
  checks.push({
    name: "op CLI",
    status: hasOp ? "ok" : "warn",
    detail: hasOp ? "Installed" : "Not found — install: https://1password.com/downloads/cli",
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
