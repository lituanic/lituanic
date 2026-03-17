#!/usr/bin/env bun

import { resolve, join } from "node:path";
import { readFileSync } from "node:fs";
import { loadConfig } from "./config.js";
import { createDaemon } from "./index.js";
import { doctor, printDoctor } from "./doctor.js";
import { init } from "./init.js";

const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf-8"));
const args = process.argv.slice(2);
const command = args[0] ?? "start";

async function main() {
  switch (command) {
    case "init": {
      const name = args[1] ?? ".";
      init(name);
      break;
    }

    case "start": {
      const configPath = args[1] ? resolve(args[1]) : undefined;
      const config = await loadConfig(configPath);
      const daemon = createDaemon(config);

      process.on("SIGINT", () => daemon.stop());
      process.on("SIGTERM", () => daemon.stop());

      await daemon.start();
      break;
    }

    case "doctor": {
      const checks = await doctor();
      printDoctor(checks);
      break;
    }

    case "health": {
      const port = args[1] ?? "9200";
      try {
        const res = await fetch(`http://localhost:${port}/health`);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
      } catch {
        console.error("Agent not reachable");
        process.exit(1);
      }
      break;
    }

    case "version": {
      console.log(`lituanic ${pkg.version}`);
      break;
    }

    default: {
      console.log(`
lituanic v${pkg.version} — agent daemon for single operators

Usage:
  lituanic init [name]      Scaffold a new agent project (or "." for current dir)
  lituanic start [config]   Start the agent daemon
  lituanic doctor           Check integrations and environment
  lituanic health [port]    Check agent health
  lituanic version          Print version

Quick start:
  bunx lituanic init my-agent
  cd my-agent
  nano .env                 # add your API keys
  bun start

Zero-config mode:
  Set SLACK_BOT_TOKEN + SLACK_APP_TOKEN + ANTHROPIC_API_KEY as env vars.
  Run "bun start" without a config file. Lituanic auto-detects everything.
      `);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
